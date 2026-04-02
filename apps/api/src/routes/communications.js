const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { queueNotificationSend } = require('../jobs/reminders');

const BULK_MESSAGE_CONCURRENCY = Number(process.env.BULK_MESSAGE_CONCURRENCY || 5);

function dedupePatientsByPhone(patients) {
  const seen = new Set();
  return (patients || []).filter((patient) => {
    if (!patient?.phone || seen.has(patient.phone)) return false;
    seen.add(patient.phone);
    return true;
  });
}

async function sendBulkNotifications(patients, message) {
  const results = [];

  for (let i = 0; i < patients.length; i += BULK_MESSAGE_CONCURRENCY) {
    const chunk = patients.slice(i, i + BULK_MESSAGE_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(async (patient) => {
      try {
        const status = await queueNotificationSend({ phone: patient.phone, message });
        return {
          name: patient.name,
          phone: patient.phone,
          queued: !!status?.success,
          mode: status?.mode,
          error: status?.success ? undefined : (status?.error || 'Failed to queue/send')
        };
      } catch (error) {
        return { name: patient.name, phone: patient.phone, queued: false, error: error.message };
      }
    }));

    results.push(...chunkResults);

    if (i + BULK_MESSAGE_CONCURRENCY < patients.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return results;
}

async function queueBulkNotifications(patients, message) {
  const results = [];

  for (const patient of patients) {
    try {
      const status = await queueNotificationSend({ phone: patient.phone, message });
      results.push({
        name: patient.name,
        phone: patient.phone,
        queued: !!status?.success,
        mode: status?.mode,
        error: status?.success ? undefined : (status?.error || 'Failed to queue/send')
      });
    } catch (error) {
      results.push({ name: patient.name, phone: patient.phone, queued: false, error: error.message });
    }
  }

  return results;
}

router.use(authenticate);

router.post('/bulk/today', requireRole('clinic_admin', 'receptionist'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { message } = req.body;
  const today = new Date().toISOString().split('T')[0];

  if (!message || String(message).trim().length < 3) {
    return res.status(400).json({ error: 'Message is required and must be at least 3 characters' });
  }

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    const { data: appointments } = await supabase
      .from('appointments')
      .select('patient:users!appointments_patient_id_fkey(name, phone)')
      .eq('tenant_id', tenantId)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'pending']);

    const { data: queuePatients } = await supabase
      .from('queue_entries')
      .select('patient:users!queue_entries_patient_id_fkey(name, phone)')
      .eq('tenant_id', tenantId)
      .gte('registered_at', `${today}T00:00:00`)
      .neq('status', 'no_show');

    const allPatients = [
      ...(appointments || []).map(a => a.patient),
      ...(queuePatients || []).map(q => q.patient)
    ].filter(Boolean);

    const unique = dedupePatientsByPhone(allPatients);
    const fullMessage = `*${tenant?.name}*\n\n${message}`;

    const results = await sendBulkNotifications(unique, fullMessage);

    const sent = results.filter(r => r.queued).length;
    res.json({ sent, total: unique.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk/date', requireRole('clinic_admin', 'receptionist'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { message, date } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }
  if (!message || String(message).trim().length < 3) {
    return res.status(400).json({ error: 'Message is required and must be at least 3 characters' });
  }

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    const { data: appointments } = await supabase
      .from('appointments')
      .select('patient:users!appointments_patient_id_fkey(name, phone)')
      .eq('tenant_id', tenantId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    const patients = (appointments || [])
      .map(a => a.patient)
      .filter(Boolean);

    const unique = dedupePatientsByPhone(patients);
    const fullMessage = `*${tenant?.name}*\n\n${message}`;

    const results = await sendBulkNotifications(unique, fullMessage);

    const sent = results.filter(r => r.queued).length;
    res.json({ sent, total: unique.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/emergency-closure', requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { reason, date } = req.body;

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, subdomain')
      .eq('id', tenantId)
      .single();

    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, patient:users!appointments_patient_id_fkey(name, phone)')
      .eq('tenant_id', tenantId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    const results = [];
    for (const appt of (appointments || [])) {
      if (appt.patient?.phone) {
        const status = await queueNotificationSend({
          phone: appt.patient.phone,
          message:
`⚠️ *${tenant?.name} — Important Notice*

Hello ${appt.patient?.name}, we regret to inform you that the clinic will be closed on ${date}.

Reason: ${reason}

Please rebook your appointment:
${process.env.FRONTEND_URL}/book/${tenant?.subdomain}

We sincerely apologize for the inconvenience. 🙏`
        });
        results.push({ name: appt.patient.name, success: !!status?.success });
      }
    }

    res.json({
      cancelled: appointments?.length || 0,
      notified: results.filter(r => r.success).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/remind/:appointmentId', requireRole('clinic_admin', 'receptionist'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { appointmentId } = req.params;

  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        appointment_date, slot_time,
        patient:users!appointments_patient_id_fkey(name, phone),
        doctor:users!appointments_doctor_id_fkey(name),
        tenant:tenants(name)
      `)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (!appt?.patient?.phone) {
      return res.status(400).json({ error: 'No phone number found' });
    }

    queueNotificationSend({
      phone: appt.patient.phone,
      message:
`⏰ *${appt.tenant?.name} — Appointment Reminder*

Hello ${appt.patient?.name}!

Your appointment details:
👨‍⚕️ Doctor: ${appt.doctor?.name}
📅 Date: ${appt.appointment_date}
⏰ Time: ${appt.slot_time?.slice(0, 5)}

Please arrive 5 minutes early. See you soon! 🙏`
    }).catch(err => console.error('Error queueing reminder notification:', err.message));

    res.json({ success: true, message: 'Reminder sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
