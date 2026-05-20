const router = require('express').Router();
const supabase = require('../models/supabase');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { classifySymptoms } = require('../services/ai');
const { scheduleReminders, cancelReminders, queueNotificationSend } = require('../jobs/reminders');
const { getLocalDateString, getNowInTimezoneDate } = require('../utils/date');
const {
  assert,
  isEmail,
  isIsoDate,
  isNonEmptyString,
  isPhone,
  isTimeHHMM,
  isUuid,
  normalizeEmail,
} = require('../utils/validation');
const { validateBookingAvailability, getAvailableSlots } = require('../utils/bookingValidation');
const { updateDoctorStats } = require('../services/stats');

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

const slotToMinutes = (time) => {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// ─── GET /api/appointments/slots ──────────────────────
router.get('/slots', async (req, res) => {
  try {
    const rawDoctorId = req.query?.doctorId ?? req.query?.doctorid ?? req.query?.doctor_id ?? '';
    const rawDoctorName = req.query?.doctorName ?? req.query?.doctorname ?? req.query?.doctor_name ?? '';
    const rawSubdomain = req.query?.subdomain ?? req.query?.clinicSubdomain ?? req.query?.clinic_subdomain ?? '';
    const rawDate = req.query?.date;

    const doctorName = Array.isArray(rawDoctorName) ? String(rawDoctorName[0] || '').trim() : String(rawDoctorName || '').trim();
    const subdomain = Array.isArray(rawSubdomain) ? String(rawSubdomain[0] || '').trim() : String(rawSubdomain || '').trim();
    const date = Array.isArray(rawDate) ? String(rawDate[0] || '').trim() : String(rawDate || '').trim();
    let resolvedDoctorId = Array.isArray(rawDoctorId)
      ? String(rawDoctorId[0] || '').trim()
      : String(rawDoctorId || '').trim();

    if (!isNonEmptyString(resolvedDoctorId, 1) && isNonEmptyString(doctorName, 100) && isNonEmptyString(subdomain, 100)) {
      const { data: doctorByName } = await supabase
        .from('users')
        .select('id, tenants!inner(subdomain)')
        .eq('role', 'doctor')
        .eq('is_active', true)
        .eq('tenants.subdomain', subdomain)
        .ilike('name', `%${doctorName}%`)
        .limit(1)
        .maybeSingle();

      if (doctorByName?.id) {
        resolvedDoctorId = doctorByName.id;
      }
    }

    assert(isNonEmptyString(resolvedDoctorId), 'doctorId is required');
    assert(isIsoDate(date), 'date must be in YYYY-MM-DD format');

    let { data: settings } = await supabase
      .from('doctor_slot_settings')
      .select('*')
      .eq('doctor_id', resolvedDoctorId)
      .single();

    if (!settings) {
      const { data: doctor } = await supabase
        .from('users')
        .select('tenant_id, tenants(open_time, close_time)')
        .eq('id', resolvedDoctorId)
        .single();

      if (!doctor?.tenant_id) {
        return res.status(404).json({ error: 'Selected doctor not found' });
      }

      const openTime = doctor?.tenants?.open_time || '09:00';
      const closeTime = doctor?.tenants?.close_time || '20:00';

      const { data: created } = await supabase
        .from('doctor_slot_settings')
        .insert({
          id: uuidv4(),
          tenant_id: doctor?.tenant_id,
          doctor_id: resolvedDoctorId,
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
    const today = getLocalDateString();
    const currentTime = getNowInTimezoneDate();
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
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
      .eq('doctor_id', resolvedDoctorId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    const bookedTimes = (booked || []).map(b => b.slot_time?.slice(0, 5)).filter(Boolean);

    const isSameDay = date === today;
    const slots = isSameDay
      ? allSlots.filter(time => {
          const slotMinutes = slotToMinutes(time);
          return slotMinutes !== null && slotMinutes >= currentMinutes;
        })
      : allSlots;

    // Apply buffer time consideration for available slots
    const availableSlots = getAvailableSlots(slots, bookedTimes, duration);

    const slotData = availableSlots.map(time => ({
      time,
      available: true,
      consultationFee: settings?.consultation_fee || 300
    })).concat(
      bookedTimes.map(time => ({
        time,
        available: false,
        consultationFee: settings?.consultation_fee || 300
      }))
    ).sort((a, b) => a.time.localeCompare(b.time));

    res.json({
      slots: slotData,
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
      clinic_id, doctor_id, appointment_time,
      patient_name, patient_phone, patient_email,
      symptoms, visit_type, booked_by_patient_id,
      booking_for, family_member_name, family_member_relation
    } = req.body;

    const isBookingForOther = booking_for === 'other';
    const nameForRecord = isBookingForOther ? family_member_name : patient_name;

    const cleanPatientName = typeof nameForRecord === 'string' ? nameForRecord.trim() : nameForRecord;
    const cleanPhone = normalizePhone(patient_phone);
    const cleanEmail = patient_email ? normalizeEmail(patient_email) : null;

    assert(isUuid(clinic_id), 'clinic_id must be a valid UUID');
    assert(isNonEmptyString(doctor_id), 'doctor_id is required');
    if (booked_by_patient_id) {
      assert(isUuid(booked_by_patient_id), 'booked_by_patient_id must be a valid UUID');
    }
    assert(isNonEmptyString(cleanPatientName, 100), 'Patient name is required');
    if (isBookingForOther) {
      assert(isNonEmptyString(family_member_relation, 50), 'Family member relation is required');
    }
    assert(isPhone(cleanPhone), 'Valid phone is required');
    if (patient_email) {
      assert(isEmail(cleanEmail), 'Invalid email format');
    }
    assert(isIsoDate(appointment_time), 'appointment_time must be a valid ISO string');

    const appointmentDate = getLocalDateString(new Date(appointment_time));
    const appointmentTime = new Date(appointment_time).toTimeString().slice(0, 5);


    const { data: doctorRecord, error: doctorError } = await supabase
      .from('users')
      .select('id, tenant_id, name, tenants(name, subdomain)')
      .eq('id', doctor_id)
      .eq('tenant_id', clinic_id)
      .eq('role', 'doctor')
      .eq('is_active', true)
      .single();

    if (doctorError || !doctorRecord) {
      return res.status(400).json({ error: 'Selected doctor does not belong to this clinic' });
    }

    const io = req.app.get('io');

    // 1. Find an existing patient by phone/email/id, otherwise create a new patient account.
    let patientIdToBook = null;
    let bookingUserId = booked_by_patient_id; // The user making the booking

    // If a logged-in user is booking for someone else, we need to find/create the patient record
    // for that 'someone else', but associate the booking with the logged-in user.
    if (isBookingForOther && bookingUserId) {
        // First, ensure the user making the booking exists
        const { data: bookingUserExists } = await supabase.from('users').select('id').eq('id', bookingUserId).single();
        if (!bookingUserExists) {
            return res.status(404).json({ error: 'The user making the booking was not found.' });
        }
    }


    // Find or create the patient profile for whom the appointment is being booked.
    // This could be the logged-in user OR the family member.
    const { data: existingPatient, error: existingPatientErr } = await supabase
      .from('users')
      .select('id')
      .eq('phone', cleanPhone)
      .eq('role', 'patient')
      .eq('is_active', true)
      .maybeSingle();

    if (existingPatientErr) throw existingPatientErr;

    if (existingPatient) {
      patientIdToBook = existingPatient.id;
    } else {
      const { data: newPatient, error: patientError } = await supabase.from('users').insert({
        tenant_id: clinic_id,
        name: cleanPatientName,
        phone: cleanPhone,
        email: cleanEmail,
        role: 'patient',
        is_active: true
      }).select('id').single();

      if (patientError) throw patientError;
      patientIdToBook = newPatient.id;
    }

    // If booking for other, and a user is logged in, create the family link
    if (isBookingForOther && bookingUserId && patientIdToBook) {
        // Avoid creating duplicate links
        const { data: existingLink } = await supabase.from('family_members')
            .select('id')
            .eq('user_id', bookingUserId)
            .eq('member_patient_id', patientIdToBook)
            .maybeSingle();

        if (!existingLink) {
            const { error: familyError } = await supabase.from('family_members').insert({
                user_id: bookingUserId,
                member_patient_id: patientIdToBook,
                relationship: family_member_relation,
                member_name: cleanPatientName,
            });
            if (familyError) {
                console.error("Error creating family link:", familyError);
                // Non-critical, so we just log it and continue
            }
        }
    }


    // 2. Fetch doctor's slot settings (duration/fee)
    const { data: slotSettings } = await supabase
      .from('doctor_slot_settings')
      .select('consultation_fee, slot_duration_mins')
      .eq('doctor_id', doctorRecord.id)
      .maybeSingle();

    // No exact slot overlapping checks for Queue system.

    // 3. Create the booking
    const appointmentId = uuidv4();
    const { data: appointment, error: apptError } = await supabase.from('bookings').insert({
      id: appointmentId,
      tenant_id: clinic_id,
      doctor_id: doctor_id,
      patient_id: patientIdToBook,
      appointment_time: appointment_time,
      status: 'scheduled',
      source: 'web',
      visit_type: visit_type,
      patient_name_cache: cleanPatientName,
      patient_phone_cache: cleanPhone,
    }).select('id, token_number').single();

    if (apptError) throw apptError;

    io.to(`queue:${doctor_id}:${appointmentDate}`).emit('queue:state_change');

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointmentId: appointmentId,
      patientId: patientIdToBook,
      trackerToken: appointmentId,
      clinicName: doctorRecord.tenants?.name,
      doctorName: doctorRecord.name,
      date: appointment_time,
      estimatedTime: 'To be calculated on check-in',
      consultationFee: slotSettings?.consultation_fee || 0
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
        tenants(name, address, subdomain)
      `)
      .eq('patient_id', req.user.id)
      .order('appointment_date', { ascending: false })
      .range(from, to);

    res.json({ page, pageSize, data: appointments || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ─── GET /api/appointments/:id ──────────────────────
// Get a single appointment by ID (for reschedule flow)
// Returns appointment with doctor details
router.get('/:id', authenticate, async (req, res) => {
  try {
    assert(isUuid(req.params.id), 'id must be a valid UUID');

    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, doctor_id, patient_id,
        tenants(id, name, address, subdomain),
        doctors:users!doctor_id(id, name)
      `)
      .eq('id', req.params.id)
      .eq('patient_id', req.user.id)
      .single();

    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appt);
  } catch (err) {
    console.error('Fetch appointment error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to fetch appointment' });
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
      queueNotificationSend({
        phone: appt.users.phone,
        title: 'Appointment Cancelled',
        body: `${appt.tenants?.name || 'Clinic'} • ${appt.appointment_date} • ${appt.slot_time?.slice(0, 5)}`,
        message: `❌ Your appointment at *${appt.tenants?.name}* on ${appt.appointment_date} at ${appt.slot_time?.slice(0, 5)} has been cancelled.\n\nBook again at: ${process.env.FRONTEND_URL}`
      }).catch(err => console.error('Error queueing cancellation notification:', err.message));
    }

    await cancelReminders(req.params.id);
    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ─── GET /api/appointments/clinic/by-date?date=YYYY-MM-DD ───
router.get('/clinic/by-date', authenticate, async (req, res) => {
  try {
    const date = req.query.date || getLocalDateString();
    assert(isIsoDate(date), 'date must be in YYYY-MM-DD format');

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, slot_time, status, priority, visit_type, symptoms, ai_summary, payment_amount,
        users!patient_id(name, phone),
        doctors:users!doctor_id(id, name)
      `)
      .eq('tenant_id', req.user.tenantId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending', 'completed', 'cancelled'])
      .order('slot_time', { ascending: true });

    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to fetch appointments' });
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

    cancelReminders(req.params.id)
      .catch(err => console.error('Cancel reminders error on reschedule:', err.message));
    scheduleReminders(updated)
      .catch(err => console.error('Schedule reminders error on reschedule:', err.message));

    if (appt.users?.phone) {
      const newDate = new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      queueNotificationSend({
        phone: appt.users.phone,
        title: 'Appointment Rescheduled',
        body: `${appt.tenants?.name || 'Clinic'} • ${newDate} • ${slotTime}`,
        message: `✅ Appointment Rescheduled!\n\n🏥 ${appt.tenants?.name}\n📅 ${newDate}\n⏰ ${slotTime}\n\nSee you then!`
      }).catch(err => console.error('Error queueing reschedule notification:', err.message));
    }

    res.json({ message: 'Appointment rescheduled successfully', appointment: updated });
  } catch (err) {
    console.error('Reschedule error:', err);
    res.status(500).json({ error: 'Failed to reschedule' });
  }
});

// When a booking is marked as 'completed'
// This could be in a route handler like PUT /api/bookings/:id/status
// or triggered by a Supabase DB trigger/function.

// Example: In a route handler
router.put('/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // ... logic to update booking status in DB ...
  const { data: updatedBooking, error } = await supabase
    .from('bookings')
    .update({ status, ended_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to update booking' });
  }

  // If the booking is completed, calculate duration and update stats
  if (status === 'completed' && updatedBooking.started_at) {
    const startedAt = new Date(updatedBooking.started_at);
    const endedAt = new Date(updatedBooking.ended_at);
    const actualDurationSeconds = (endedAt - startedAt) / 1000;

    if (actualDurationSeconds > 0) {
      await updateDoctorStats(
        updatedBooking.doctor_id,
        updatedBooking.visit_type,
        actualDurationSeconds
      );
    }
  }

  res.json(updatedBooking);
});

module.exports = router;