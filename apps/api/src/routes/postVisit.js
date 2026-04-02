const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { queueNotificationSend, scheduleRatingRequest } = require('../jobs/reminders');

router.use(authenticate);

// POST complete visit — send prescription + trigger post-visit flow
router.post('/complete/:entryId', requireRole('doctor', 'clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const {
    diagnosis, medicines, instructions,
    follow_up_date, follow_up_reason,
    send_prescription
  } = req.body;

  try {
    // Get queue entry with patient info
    const { data: entry } = await supabase
      .from('queue_entries')
      .select(`
        *,
        patient:users!queue_entries_patient_id_fkey(id, name, phone),
        tenant:tenants(name, subdomain)
      `)
      .eq('id', entryId)
      .eq('tenant_id', tenantId)
      .single();

    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });

    // Save consultation notes
    const { data: notes } = await supabase
      .from('consultation_notes')
      .upsert({
        tenant_id: tenantId,
        patient_id: entry.patient_id,
        doctor_id: req.user.id,
        queue_entry_id: entryId,
        diagnosis,
        medicines: Array.isArray(medicines)
          ? medicines.map(m => `${m.name} - ${m.dosage} (${m.duration})`).join('\n')
          : medicines,
        instructions,
        follow_up_date: follow_up_date || null,
        follow_up_reason: follow_up_reason || null,
        prescription_sent: !!send_prescription,
        created_at: new Date().toISOString()
      }, { onConflict: 'queue_entry_id' })
      .select()
      .single();

    // Send prescription via notification
    if (send_prescription && entry.patient?.phone) {
      const medList = Array.isArray(medicines)
        ? medicines.map(m => `• ${m.name} — ${m.dosage} (${m.duration})`).join('\n')
        : medicines;

      queueNotificationSend({
        phone: entry.patient.phone,
        message:
`💊 *${entry.tenant?.name} — Your Prescription*

Patient: ${entry.patient?.name}
Date: ${new Date().toLocaleDateString('en-IN')}

📋 *Diagnosis:* ${diagnosis}

💊 *Medicines:*
${medList}

📝 *Instructions:*
${instructions || 'Take medicines as prescribed. Contact us if symptoms persist.'}

${follow_up_date ? `📅 *Follow-up:* ${new Date(follow_up_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}

Get well soon! 🙏
— ${entry.tenant?.name}`
      }).catch((err) => {
        console.error('Error queueing prescription notification:', err.message);
      });
    }

    // Create follow-up if date set
    if (follow_up_date) {
      await supabase.from('follow_ups').insert({
        tenant_id: tenantId,
        patient_id: entry.patient_id,
        doctor_id: req.user.id,
        queue_entry_id: entryId,
        follow_up_date,
        reason: follow_up_reason || 'Doctor recommended follow-up',
        status: 'pending'
      });
    }

    // Schedule rating request after 2 hours (Bull queue)
    await scheduleRatingRequest(entryId, 2 * 60 * 60 * 1000);

    res.json({ notes, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET patient's post-visit summary
router.get('/summary/:patientId', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('consultation_notes')
      .select(`
        *,
        doctor:users!consultation_notes_doctor_id_fkey(name)
      `)
      .eq('tenant_id', tenantId)
      .eq('patient_id', req.params.patientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ visits: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;