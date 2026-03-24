const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { queueWhatsAppSend } = require('../jobs/reminders');

router.use(authenticate);

// POST create follow-up after consultation
router.post('/', requireRole('doctor', 'clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    patient_id, doctor_id, queue_entry_id,
    appointment_id, follow_up_date, reason
  } = req.body;

  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .insert({
        tenant_id: tenantId,
        patient_id,
        doctor_id: doctor_id || req.user.id,
        queue_entry_id,
        appointment_id,
        follow_up_date,
        reason,
        status: 'pending'
      })
      .select(`
        *,
        patient:users!follow_ups_patient_id_fkey(name, phone),
        doctor:users!follow_ups_doctor_id_fkey(name),
        tenant:tenants(name, subdomain)
      `)
      .single();

    if (error) throw error;

    // Send WhatsApp immediately
    if (data.patient?.phone) {
      const formattedDate = new Date(follow_up_date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });

      queueWhatsAppSend(data.patient.phone,
`📅 *${data.tenant?.name} — Follow-up Reminder*

Hello ${data.patient?.name}!

Dr. ${data.doctor?.name} has recommended a follow-up visit.

📅 Suggested date: *${formattedDate}*
📋 Reason: ${reason || 'Routine follow-up'}

Book your slot here:
${process.env.FRONTEND_URL}/book/${data.tenant?.subdomain}

Take care and get well soon! 🙏`
  ).catch((waErr) => {
    console.error('Error queueing follow-up creation WhatsApp:', waErr.message);
  });
    }

    res.json({ followUp: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all follow-ups for clinic
router.get('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { status, days } = req.query;

  try {
    let query = supabase
      .from('follow_ups')
      .select(`
        *,
        patient:users!follow_ups_patient_id_fkey(name, phone),
        doctor:users!follow_ups_doctor_id_fkey(name)
      `)
      .eq('tenant_id', tenantId)
      .order('follow_up_date', { ascending: true });

    if (status) query = query.eq('status', status);

    if (days) {
      const future = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('follow_up_date', today).lte('follow_up_date', future);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ followUps: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark follow-up as completed
router.patch('/:id/complete', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .update({ status: 'completed' })
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json({ followUp: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH send reminder for follow-up
router.patch('/:id/remind', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data: fu } = await supabase
      .from('follow_ups')
      .select(`
        *,
        patient:users!follow_ups_patient_id_fkey(name, phone),
        doctor:users!follow_ups_doctor_id_fkey(name),
        tenant:tenants(name, subdomain)
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!fu?.patient?.phone) {
      return res.status(400).json({ error: 'No phone number found' });
    }

    const formattedDate = new Date(fu.follow_up_date).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    queueWhatsAppSend(fu.patient.phone,
`🔔 *${fu.tenant?.name} — Follow-up Reminder*

Hello ${fu.patient?.name}!

This is a reminder that Dr. ${fu.doctor?.name} has recommended a follow-up visit on *${formattedDate}*.

${fu.reason ? `Reason: ${fu.reason}` : ''}

Book your appointment:
${process.env.FRONTEND_URL}/book/${fu.tenant?.subdomain}`
    ).catch((waErr) => {
      console.error('Error queueing follow-up reminder WhatsApp:', waErr.message);
    });

    await supabase
      .from('follow_ups')
      .update({ reminder_sent: true })
      .eq('id', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;