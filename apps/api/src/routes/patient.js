const router = require('express').Router();
const supabase = require('../models/supabase');
const { authenticate } = require('../middleware/auth');
const { getDayBounds, getLocalDateString } = require('../utils/date');
const {
  assert,
  isEmail,
  isNonEmptyString,
  isPhone,
  isStrongPassword,
  isIsoDate,
  normalizeEmail,
  normalizePhone
} = require('../utils/validation');

// ─── GET /api/patient/clinics ─────────────────────────
// Public — get all active clinics with live queue counts
router.get('/clinics', async (req, res) => {
  try {
    const today = getLocalDateString();
    const { start } = getDayBounds(today);

    // Get all active clinics
    const { data: clinics, error } = await supabase
      .from('tenants')
      .select('id, name, subdomain, address, city, lat, lng, phone, open_time, close_time, specialization, rating, total_reviews')
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (error) throw error;

    const clinicIds = clinics.map((clinic) => clinic.id);

    const [{ data: queueEntries }, { data: doctors }] = await Promise.all([
      supabase
        .from('queue_entries')
        .select('tenant_id')
        .in('tenant_id', clinicIds)
        .eq('status', 'waiting')
        .gte('registered_at', start),
      supabase
        .from('users')
        .select('tenant_id')
        .in('tenant_id', clinicIds)
        .eq('role', 'doctor')
        .eq('is_active', true)
    ]);

    const waitingByClinic = new Map();
    (queueEntries || []).forEach((entry) => {
      waitingByClinic.set(entry.tenant_id, (waitingByClinic.get(entry.tenant_id) || 0) + 1);
    });

    const doctorsByClinic = new Map();
    (doctors || []).forEach((doctor) => {
      doctorsByClinic.set(doctor.tenant_id, (doctorsByClinic.get(doctor.tenant_id) || 0) + 1);
    });

    const enriched = clinics.map((clinic) => ({
      ...clinic,
      totalWaiting: waitingByClinic.get(clinic.id) || 0,
      doctorCount: doctorsByClinic.get(clinic.id) || 0
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Clinics fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch clinics' });
  }
});

// ─── GET /api/patient/clinics/:subdomain ─────────────
// Public — get single clinic detail with doctors and queue counts
router.get('/clinics/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const today = getLocalDateString();
    const { start } = getDayBounds(today);

    // Get clinic
    const { data: clinic, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single();

    if (error || !clinic) return res.status(404).json({ error: 'Clinic not found' });

    // Get doctors with queue counts and slot settings
    const { data: doctors } = await supabase
      .from('users')
      .select('id, name, specialization, experience_years, bio, photo_url')
      .eq('tenant_id', clinic.id)
      .eq('role', 'doctor')
      .eq('is_active', true);

    // Get slot settings for all doctors in this clinic
    const { data: slotSettings } = await supabase
      .from('doctor_slot_settings')
      .select('*')
      .eq('tenant_id', clinic.id);

    const slotMap = {};
    (slotSettings || []).forEach(s => { slotMap[s.doctor_id] = s; });

    const doctorsWithQueue = await Promise.all(
      (doctors || []).map(async (doc) => {
        const { count } = await supabase
          .from('queue_entries')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', clinic.id)
          .eq('doctor_id', doc.id)
          .eq('status', 'waiting')
          .gte('registered_at', start);

        const slot = slotMap[doc.id] || {};
        return {
          ...doc,
          queueCount: count || 0,
          consultationFee: slot.consultation_fee || 300,
          slotDuration: slot.slot_duration_mins || 20,
          morningStart: slot.morning_start || '09:00',
          morningEnd: slot.morning_end || '13:00',
          eveningStart: slot.evening_start || '17:00',
          eveningEnd: slot.evening_end || '20:00',
          isAcceptingAppointments: slot.is_accepting_appointments !== false
        };
      })
    );

    // Total waiting
    const totalWaiting = doctorsWithQueue.reduce((sum, d) => sum + d.queueCount, 0);

    // Get recent reviews
    const { data: reviews } = await supabase
      .from('clinic_reviews')
      .select('rating, comment, created_at, users!patient_id(name)')
      .eq('tenant_id', clinic.id)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      ...clinic,
      doctors: doctorsWithQueue,
      totalWaiting,
      reviews: reviews || []
    });
  } catch (err) {
    console.error('Clinic detail error:', err);
    res.status(500).json({ error: 'Failed to fetch clinic' });
  }
});

// ─── POST /api/patient/register ──────────────────────
// Patient creates their own account
router.post('/register', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const { v4: uuidv4 } = require('uuid');
    const { name, phone, email, password, gender, dateOfBirth } = req.body;
    const cleanName = typeof name === 'string' ? name.trim() : name;
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone ? normalizePhone(phone) : null;

    assert(isNonEmptyString(cleanName, 100), 'Name is required');
    assert(isEmail(cleanEmail), 'Valid email is required');
    assert(isStrongPassword(password), 'Password must be 8+ chars with uppercase, lowercase, number, and special character');
    if (phone) {
      assert(isPhone(cleanPhone), 'Phone number is invalid');
    }
    if (dateOfBirth) {
      assert(isIsoDate(dateOfBirth), 'dateOfBirth must be in YYYY-MM-DD format');
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        tenant_id: null,  // patients don't belong to a specific clinic
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'patient',
        gender,
        date_of_birth: dateOfBirth || null,
        profile_complete: true,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    const accessToken = jwt.sign(
      { id: user.id, tenantId: null, role: 'patient', email: user.email },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { id: user.id, tenantId: null, role: 'patient', email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: 'patient', phone: user.phone },
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error('Patient register error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Registration failed' });
  }
});

router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, gender, dateOfBirth, bloodGroup, allergies, emergencyContact } = req.body;
    const updates = {};

    if (name !== undefined) {
      assert(isNonEmptyString(name, 100), 'Name is required');
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      if (phone === null || phone === '') {
        updates.phone = null;
      } else {
        const cleanPhone = normalizePhone(phone);
        assert(isPhone(cleanPhone), 'Phone number is invalid');
        updates.phone = cleanPhone;
      }
    }

    if (gender !== undefined) {
      assert(['male', 'female', 'other', 'prefer_not_to_say'].includes(String(gender).toLowerCase()), 'gender is invalid');
      updates.gender = String(gender).toLowerCase();
    }

    if (dateOfBirth !== undefined) {
      if (dateOfBirth === null || dateOfBirth === '') {
        updates.date_of_birth = null;
      } else {
        assert(isIsoDate(dateOfBirth), 'dateOfBirth must be in YYYY-MM-DD format');
        updates.date_of_birth = dateOfBirth;
      }
    }

    assert(Object.keys(updates).length > 0, 'No valid profile fields provided');

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ message: 'Profile updated', user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
