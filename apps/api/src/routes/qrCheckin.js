const router = require('express').Router();
const supabase = require('../models/supabase');

// ─── GET /api/qr/appointment/:token ──────────────────
// Returns appointment data when QR is scanned at reception
router.get('/appointment/:token', async (req, res) => {
  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, status, symptoms, priority,
        users!patient_id(name, phone),
        doctors:users!doctor_id(name, specialization),
        tenants(name)
      `)
      .eq('tracker_url_token', req.params.token)
      .single();

    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    res.json({
      appointmentId: appt.id,
      patientName: appt.users?.name,
      patientPhone: appt.users?.phone,
      doctorName: appt.doctors?.name,
      date: appt.appointment_date,
      time: appt.slot_time?.slice(0, 5),
      status: appt.status,
      symptoms: appt.symptoms,
      priority: appt.priority
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch QR data' });
  }
});

// ─── POST /api/qr/checkin/:token ─────────────────────
// Mark patient as arrived via QR scan
router.post('/checkin/:token', async (req, res) => {
  try {
    const { data: appt } = await supabase
      .from('appointments')
      .update({ status: 'confirmed', payment_status: 'paid' })
      .eq('tracker_url_token', req.params.token)
      .select('*, users!patient_id(name), tenants(id)')
      .single();

    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    // Notify clinic dashboard
    const io = req.app.get('io');
    io.to(`tenant:${appt.tenants?.id}`).emit('patient:qr_checkin', {
      patientName: appt.users?.name,
      appointmentId: appt.id,
      time: appt.slot_time?.slice(0, 5)
    });

    res.json({ message: `${appt.users?.name} checked in successfully!`, appointment: appt });
  } catch (err) {
    res.status(500).json({ error: 'Check-in failed' });
  }
});

module.exports = router;
