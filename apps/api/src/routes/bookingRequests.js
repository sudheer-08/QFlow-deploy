const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  sendAppointmentConfirmed,
  sendAppointmentDeclined,
  sendSuggestedSlot
} = require('../services/whatsapp');
const { queueWhatsAppSend } = require('../jobs/reminders');

router.use(authenticate);

// GET all pending bookings
router.get('/pending', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, status, symptoms, notes,
        visit_type, payment_status, payment_amount, decline_reason,
        patient:users!appointments_patient_id_fkey(id, name, phone, email),
        doctor:users!appointments_doctor_id_fkey(id, name)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('appointment_date', { ascending: true });

    if (error) throw error;
    res.json({ bookings: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all bookings with filter — no date restriction
router.get('/all', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { status } = req.query;
  try {
    let query = supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, status, symptoms, notes,
        visit_type, payment_status, payment_amount, decline_reason,
        patient:users!appointments_patient_id_fkey(id, name, phone, email),
        doctor:users!appointments_doctor_id_fkey(id, name)
      `)
      .eq('tenant_id', tenantId)
      .order('appointment_date', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ bookings: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH accept
router.patch('/:id/accept', requireRole('receptionist', 'clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const staffId = req.user.id;
  const { id } = req.params;
  try {
    const { data: appt, error } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: staffId
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(`
        id, appointment_date, slot_time, token_number,
        patient:users!appointments_patient_id_fkey(name, phone, email),
        doctor:users!appointments_doctor_id_fkey(name),
        tenant:tenants(name)
      `)
      .single();

    if (error) throw error;

    const date = new Date(appt.appointment_date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const time = appt.slot_time?.slice(0, 5);

    if (appt.patient?.phone) {
      await sendAppointmentConfirmed(appt.patient.phone, {
        clinicName: appt.tenant?.name,
        patientName: appt.patient?.name,
        doctorName: appt.doctor?.name,
        date,
        time,
        token: appt.token_number
      });
    }

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH decline
router.patch('/:id/decline', requireRole('receptionist', 'clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const staffId = req.user.id;
  const { id } = req.params;
  const { reason, suggested_slot } = req.body;

  try {
    const { data: appt, error } = await supabase
      .from('appointments')
      .update({
        status: 'declined',
        decline_reason: reason,
        suggested_slot: suggested_slot || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: staffId
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(`
        id, appointment_date, slot_time,
        patient:users!appointments_patient_id_fkey(name, phone, email),
        tenant:tenants(name, subdomain)
      `)
      .single();

    if (error) throw error;

    const altSlot = suggested_slot
      ? new Date(suggested_slot).toLocaleString('en-IN', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : null;

    if (appt.patient?.phone) {
      await sendAppointmentDeclined(appt.patient.phone, {
        clinicName: appt.tenant?.name,
        patientName: appt.patient?.name,
        reason,
        alternateSlot: altSlot,
        subdomain: appt.tenant?.subdomain
      });
    }

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH suggest slot
router.patch('/:id/suggest', requireRole('receptionist', 'clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;
  const { suggested_slot } = req.body;

  try {
    const { data: appt, error } = await supabase
      .from('appointments')
      .update({
        status: 'pending_patient',
        suggested_slot,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(`
        id,
        patient:users!appointments_patient_id_fkey(name, phone),
        tenant:tenants(name)
      `)
      .single();

    if (error) throw error;

    const altSlot = new Date(suggested_slot).toLocaleString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    if (appt.patient?.phone) {
      await sendSuggestedSlot(appt.patient.phone, {
        clinicName: appt.tenant?.name,
        patientName: appt.patient?.name,
        altSlot,
        token: appt.id
      });
    }

    if (appt.patient?.phone) {
      queueWhatsAppSend(
        appt.patient.phone,
`📋 *${appt.tenant?.name}*

Hello ${appt.patient?.name}!

Appointment confirm ho gaya ✅

Doctor se milne se pehle yeh form bharen:
${process.env.FRONTEND_URL}/intake/${appt.token_number}

Sirf 1 minute lagega! / Takes only 1 minute!`
      ).catch((waErr) => {
        console.error('Error queueing intake WhatsApp:', waErr.message);
      });
    }

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;