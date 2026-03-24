const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendWaitlistSlotAvailable } = require('../services/whatsapp');
const { queueWhatsAppSend } = require('../jobs/reminders');

router.use(authenticate);

// Helper — notify first person on waitlist
const notifyWaitlist = async (tenantId, doctorId, date) => {
  try {
    const { data: next } = await supabase
      .from('waitlist')
      .select(`
        *,
        patient:users!waitlist_patient_id_fkey(name, phone),
        tenant:tenants(name, subdomain)
      `)
      .eq('tenant_id', tenantId)
      .eq('doctor_id', doctorId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!next) return;

    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    await supabase
      .from('waitlist')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        expires_at: expiresAt
      })
      .eq('id', next.id);

    if (next.patient?.phone) {
      await sendWaitlistSlotAvailable(next.patient.phone, {
        clinicName: next.tenant?.name,
        patientName: next.patient?.name,
        slot: `${date}`,
        subdomain: next.tenant?.subdomain
      });
    }

    console.log(`✅ Waitlist notified: ${next.patient?.name}`);
  } catch (err) {
    console.error('Waitlist notify error:', err.message);
  }
};

// PATCH mark queue entry as no-show
router.patch('/queue/:entryId/no-show',
  requireRole('receptionist', 'doctor', 'clinic_admin'),
  async (req, res) => {
    const tenantId = req.user.tenantId;
    const { entryId } = req.params;
    try {
      const { data: entry, error } = await supabase
        .from('queue_entries')
        .update({
          status: 'no_show',
          completed_at: new Date().toISOString()
        })
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          patient:users!queue_entries_patient_id_fkey(name, phone),
          tenant:tenants(name, subdomain)
        `)
        .single();

      if (error) throw error;

      if (entry.patient?.phone) {
        queueWhatsAppSend(entry.patient.phone,
`⚠️ *${entry.tenant?.name}*

Hello ${entry.patient?.name}, you were marked as no-show for token *${entry.token_number}*.

To rebook: ${process.env.FRONTEND_URL}/book/${entry.tenant?.subdomain || ''}`
        ).catch((waErr) => {
          console.error('Error queueing no-show queue-entry WhatsApp:', waErr.message);
        });
      }

      const io = req.app.get('io');
      io.to(`tenant:${tenantId}`).emit('queue:no_show', {
        entryId: entry.id,
        token: entry.token_number
      });

      const today = new Date().toISOString().split('T')[0];
      await notifyWaitlist(tenantId, entry.doctor_id, today);

      res.json({ entry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH mark appointment as no-show
router.patch('/appointments/:id/no-show',
  requireRole('receptionist', 'clinic_admin'),
  async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    try {
      const { data: appt, error } = await supabase
        .from('appointments')
        .update({ status: 'no_show' })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          patient:users!appointments_patient_id_fkey(name, phone),
          tenant:tenants(name, subdomain)
        `)
        .single();

      if (error) throw error;

      if (appt.patient?.phone) {
        queueWhatsAppSend(appt.patient.phone,
`⚠️ *${appt.tenant?.name}*

Hello ${appt.patient?.name}, you missed your appointment on ${appt.appointment_date} at ${appt.slot_time?.slice(0, 5)}.

Rebook here: ${process.env.FRONTEND_URL}/book/${appt.tenant?.subdomain}`
        ).catch((waErr) => {
          console.error('Error queueing no-show appointment WhatsApp:', waErr.message);
        });
      }

      await notifyWaitlist(tenantId, appt.doctor_id, appt.appointment_date);

      res.json({ appointment: appt });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET waitlist
router.get('/waitlist', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select(`
        *,
        patient:users!waitlist_patient_id_fkey(name, phone),
        doctor:users!waitlist_doctor_id_fkey(name)
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['waiting', 'notified'])
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ waitlist: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add to waitlist
router.post('/waitlist', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { patient_id, doctor_id, appointment_date, preferred_time } = req.body;
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .insert({
        tenant_id: tenantId,
        patient_id,
        doctor_id,
        appointment_date,
        preferred_time,
        status: 'waiting'
      })
      .select(`
        *,
        patient:users!waitlist_patient_id_fkey(name, phone),
        doctor:users!waitlist_doctor_id_fkey(name)
      `)
      .single();

    if (error) throw error;

    if (data.patient?.phone) {
      queueWhatsAppSend(data.patient.phone,
`📋 *Waitlist Confirmed*

Hello ${data.patient?.name}! You have been added to the waitlist.

Doctor: ${data.doctor?.name}
Date: ${appointment_date}

We will notify you immediately if a slot opens up! ⚡`
      ).catch((waErr) => {
        console.error('Error queueing waitlist confirmation WhatsApp:', waErr.message);
      });
    }

    res.json({ entry: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE remove from waitlist
router.delete('/waitlist/:id', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await supabase
      .from('waitlist')
      .update({ status: 'removed' })
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET no-show report for today
router.get('/no-show-report', async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase
      .from('queue_entries')
      .select(`
        id, token_number, completed_at,
        patient:users!queue_entries_patient_id_fkey(name, phone),
        doctor:users!queue_entries_doctor_id_fkey(name)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'no_show')
      .gte('registered_at', `${today}T00:00:00`)
      .order('completed_at', { ascending: false });

    if (error) throw error;
    res.json({ noShows: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;