const router = require('express').Router();
const supabase = require('../models/supabase');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { classifySymptoms } = require('../services/ai');
const { scheduleReminders, cancelReminders, queueWhatsAppSend } = require('../jobs/reminders');
const { getLocalDateString } = require('../utils/date');
const {
  assert,
  isEmail,
  isIsoDate,
  isNonEmptyString,
  isPhone,
  isTimeHHMM,
  isUuid,
  normalizeEmail,
  normalizePhone
} = require('../utils/validation');

// ─── Helper: generate time slots ─────────────────────
const generateSlots = (start, end, durationMins) => {
  const slots = [];
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  let current = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  while (current + durationMins <= endTotal) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    current += durationMins;
  }
  return slots;
};

// ─── GET /api/appointments/slots ──────────────────────
router.get('/slots', async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    assert(isUuid(doctorId), 'doctorId must be a valid UUID');
    assert(isIsoDate(date), 'date must be in YYYY-MM-DD format');

    let { data: settings } = await supabase
      .from('doctor_slot_settings')
      .select('*')
      .eq('doctor_id', doctorId)
      .single();

    if (!settings) {
      const { data: doctor } = await supabase
        .from('users')
        .select('tenant_id, tenants(open_time, close_time)')
        .eq('id', doctorId)
        .single();

      const openTime = doctor?.tenants?.open_time || '09:00';
      const closeTime = doctor?.tenants?.close_time || '20:00';

      const { data: created } = await supabase
        .from('doctor_slot_settings')
        .insert({
          id: uuidv4(),
          tenant_id: doctor?.tenant_id,
          doctor_id: doctorId,
          slot_duration_mins: 20,
          morning_start: openTime,
          morning_end: '13:00',
          evening_start: '17:00',
          evening_end: closeTime,
          consultation_fee: 300,
          is_accepting_appointments: true
        })
        .select()
        .single();

      settings = created;
    }

    const duration = settings?.slot_duration_mins || 20;
    const morningSlots = generateSlots(
      settings?.morning_start || '09:00',
      settings?.morning_end || '13:00',
      duration
    );
    const eveningSlots = generateSlots(
      settings?.evening_start || '17:00',
      settings?.evening_end || '20:00',
      duration
    );
    const allSlots = [...morningSlots, ...eveningSlots];

    const { data: booked } = await supabase
      .from('appointments')
      .select('slot_time')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    const bookedTimes = new Set(booked?.map(b => b.slot_time?.slice(0, 5)) || []);

    const slots = allSlots.map(time => ({
      time,
      available: !bookedTimes.has(time),
      consultationFee: settings?.consultation_fee || 300
    }));

    res.json({
      slots,
      duration,
      consultationFee: settings?.consultation_fee || 300
    });
  } catch (err) {
    console.error('Slots error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to fetch slots' });
  }
});

// ─── POST /api/appointments/book ──────────────────────
// Book an appointment — public, no auth needed
// ✅ Accepts patientId from frontend if patient is logged in
router.post('/book', async (req, res) => {
  try {
    const {
      tenantId, doctorId, patientName, phone, email,
      date, slotTime, symptoms, visitType,
      patientId: loggedInPatientId  // ✅ sent by frontend when patient is logged in
    } = req.body;

    const cleanPatientName = typeof patientName === 'string' ? patientName.trim() : patientName;
    const cleanPhone = normalizePhone(phone);
    const cleanEmail = email ? normalizeEmail(email) : null;

    assert(isUuid(tenantId), 'tenantId must be a valid UUID');
    assert(isUuid(doctorId), 'doctorId must be a valid UUID');
    if (loggedInPatientId) {
      assert(isUuid(loggedInPatientId), 'patientId must be a valid UUID');
    }
    assert(isNonEmptyString(cleanPatientName, 100), 'patientName is required');
    assert(isPhone(cleanPhone), 'Valid phone is required');
    if (email) {
      assert(isEmail(cleanEmail), 'Invalid email format');
    }
    assert(isIsoDate(date), 'date must be in YYYY-MM-DD format');
    assert(isTimeHHMM(slotTime), 'slotTime must be in HH:MM format');

    const io = req.app.get('io');

    // 1. Check slot is still available
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .eq('slot_time', slotTime)
      .in('status', ['confirmed', 'pending'])
      .single();

    if (existing) {
      return res.status(400).json({ error: 'This slot was just booked. Please pick another time.' });
    }

    // 2. ✅ Use logged-in patient ID if available, else find/create by phone
    let patientId = loggedInPatientId || null;

    if (!patientId) {
      // Try to find existing patient by phone
      const { data: existingPatient } = await supabase
        .from('users')
        .select('id')
        .eq('phone', cleanPhone)
        .eq('role', 'patient')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .single();

      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        // Create new patient account
        patientId = uuidv4();
        await supabase.from('users').insert({
          id: patientId,
          tenant_id: tenantId,
          name: cleanPatientName,
          phone: cleanPhone,
          email: cleanEmail,
          role: 'patient',
          is_active: true
        });
      }
    }

    // 3. AI triage
    let priority = 'routine';
    let aiSummary = '';
    if (symptoms) {
      try {
        const result = await classifySymptoms(symptoms);
        priority = result.priority;
        aiSummary = result.summary;
      } catch (e) {
        console.warn('AI triage failed:', e.message);
      }
    }

    // 4. Get slot settings for fee
    const { data: settings } = await supabase
      .from('doctor_slot_settings')
      .select('consultation_fee')
      .eq('doctor_id', doctorId)
      .single();

    const trackerToken = uuidv4().replace(/-/g, '');

    // 5. Create appointment
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: date,
        slot_time: slotTime,
        visit_type: visitType || 'first_visit',
        symptoms,
        ai_summary: aiSummary,
        priority,
        status: 'confirmed',
        payment_status: 'pending',
        payment_amount: settings?.consultation_fee || 300,
        tracker_url_token: trackerToken
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This slot was just booked. Please pick another time.' });
      }
      throw error;
    }

    // 6. Get clinic + doctor name
    const { data: doctorData } = await supabase
      .from('users')
      .select('name, tenants(name, subdomain)')
      .eq('id', doctorId)
      .single();

    const clinicName = doctorData?.tenants?.name || 'the clinic';
    const clinicSubdomain = doctorData?.tenants?.subdomain || null;
    const doctorName = doctorData?.name || 'the doctor';

    // 7. Send WhatsApp confirmation
    const appointmentDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    const confirmationMessage =
      `✅ *Appointment Confirmed!*\n\n` +
      `🏥 *${clinicName}*\n` +
      `👨‍⚕️ ${doctorName}\n` +
      `📅 ${appointmentDate}\n` +
      `⏰ ${slotTime}\n` +
      `💰 Fee: ₹${settings?.consultation_fee || 300}\n\n` +
      `Track your appointment:\n${process.env.FRONTEND_URL}/track-appointment/${trackerToken}\n\n` +
      `We'll remind you 1 hour before. 🦷`;

    if (cleanPhone) {
      queueWhatsAppSend(cleanPhone, confirmationMessage).catch((waErr) => {
        console.warn('WhatsApp confirmation failed:', waErr.message);
      });
    }

    // 8. Schedule reminders
    try {
      await scheduleReminders(appointment);
    } catch (reminderErr) {
      console.warn('⚠️ Could not schedule reminders:', reminderErr.message);
    }

    // 9. Notify clinic dashboard
    io.to(`tenant:${tenantId}`).emit('appointment:new', {
      patientName: cleanPatientName,
      date,
      slotTime,
      doctorName,
      priority
    });

    // Also notify public clinic pages so patient-facing views refresh instantly.
    if (clinicSubdomain) {
      io.to(`clinic:${clinicSubdomain}`).emit('clinic:updated', {
        type: 'appointment_booked',
        date,
        doctorId,
        slotTime
      });
    }

    res.status(201).json({
      appointmentId: appointment.id,
      trackerToken,
      trackerUrl: `/track-appointment/${trackerToken}`,
      date,
      slotTime,
      consultationFee: settings?.consultation_fee || 300,
      clinicName,
      doctorName,
      message: `Appointment confirmed for ${appointmentDate} at ${slotTime}`
    });

  } catch (err) {
    console.error('Book appointment error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Booking failed' });
  }
});

// ─── GET /api/appointments/track/:token ───────────────
router.get('/track/:token', async (req, res) => {
  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, status, payment_status,
        visit_type, symptoms, priority, payment_amount,
        users!patient_id(name, phone),
        doctors:users!doctor_id(name),
        tenants(name, address, phone)
      `)
      .eq('tracker_url_token', req.params.token)
      .single();

    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    res.json({
      date: appt.appointment_date,
      time: appt.slot_time?.slice(0, 5),
      status: appt.status,
      paymentStatus: appt.payment_status,
      priority: appt.priority,
      patientName: appt.users?.name,
      doctorName: appt.doctors?.name,
      clinicName: appt.tenants?.name,
      clinicAddress: appt.tenants?.address,
      clinicPhone: appt.tenants?.phone,
      consultationFee: appt.payment_amount,
      visitType: appt.visit_type
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// ─── GET /api/appointments/my ─────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '20', 10), 1), 50);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, status, payment_status,
        priority, tracker_url_token,
        doctors:users!doctor_id(name),
        tenants(name, address)
      `)
      .eq('patient_id', req.user.id)
      .order('appointment_date', { ascending: false })
      .range(from, to);

    res.json({ page, pageSize, data: appointments || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ─── PATCH /api/appointments/:id/cancel ───────────────
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { data: appt } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('patient_id', req.user.id)
      .select('*, users!patient_id(name, phone), tenants(name)')
      .single();

    if (appt?.users?.phone) {
      queueWhatsAppSend(
        appt.users.phone,
        `❌ Your appointment at *${appt.tenants?.name}* on ${appt.appointment_date} at ${appt.slot_time?.slice(0, 5)} has been cancelled.\n\nBook again at: ${process.env.FRONTEND_URL}`
      ).catch(err => console.error('Error queueing cancellation WhatsApp:', err.message));
    }

    await cancelReminders(req.params.id);
    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ─── GET /api/appointments/clinic/today ───────────────
router.get('/clinic/today', authenticate, async (req, res) => {
  try {
    const today = getLocalDateString();
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, slot_time, status, priority, visit_type, symptoms, ai_summary,
        users!patient_id(name, phone),
        doctors:users!doctor_id(name)
      `)
      .eq('tenant_id', req.user.tenantId)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'completed'])
      .order('slot_time', { ascending: true });

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ─── PATCH /api/appointments/:id/reschedule ───────────
router.patch('/:id/reschedule', authenticate, async (req, res) => {
  try {
    const { date, slotTime } = req.body;
    assert(isIsoDate(date), 'date must be in YYYY-MM-DD format');
    assert(isTimeHHMM(slotTime), 'slotTime must be in HH:MM format');

    const { data: appt } = await supabase
      .from('appointments')
      .select('doctor_id, tenant_id, users!patient_id(name, phone), tenants(name)')
      .eq('id', req.params.id)
      .eq('patient_id', req.user.id)
      .single();

    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', appt.doctor_id)
      .eq('appointment_date', date)
      .eq('slot_time', slotTime)
      .in('status', ['confirmed', 'pending'])
      .single();

    if (existing) {
      return res.status(400).json({ error: 'This slot is already booked. Please pick another.' });
    }

    const { data: updated } = await supabase
      .from('appointments')
      .update({
        appointment_date: date,
        slot_time: slotTime,
        reminder_sent_1day: false,
        reminder_sent_1hour: false
      })
      .eq('id', req.params.id)
      .select()
      .single();

    await cancelReminders(req.params.id);
    await scheduleReminders(updated);

    if (appt.users?.phone) {
      const newDate = new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      queueWhatsAppSend(
        appt.users.phone,
        `✅ Appointment Rescheduled!\n\n🏥 ${appt.tenants?.name}\n📅 ${newDate}\n⏰ ${slotTime}\n\nSee you then!`
      ).catch(err => console.error('Error queueing reschedule WhatsApp:', err.message));
    }

    res.json({ message: 'Appointment rescheduled successfully', appointment: updated });
  } catch (err) {
    console.error('Reschedule error:', err);
    res.status(500).json({ error: 'Failed to reschedule' });
  }
});

module.exports = router;