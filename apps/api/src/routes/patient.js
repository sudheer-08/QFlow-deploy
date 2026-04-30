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
// Public — get active clinics with pagination & optional filters
// Query params: limit (default 10), offset (default 0), city, sortBy (wait|rating|combined)
router.get('/clinics', async (req, res) => {
  try {
    const today = getLocalDateString();
    const { start } = getDayBounds(today);
    
    // Pagination params
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // max 100
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const city = req.query.city ? req.query.city.toLowerCase() : '';
    const sortBy = req.query.sortBy || 'wait'; // wait, rating, combined

    // Build query
    let query = supabase
      .from('tenants')
      .select('id, name, subdomain, address, city, lat, lng, phone, open_time, close_time, specialization, rating, total_reviews', { count: 'exact' })
      .eq('is_active', true);

    if (city && city !== 'all') {
      query = query.ilike('city', `%${city}%`);
    }

    // Get total count first
    const { count: totalCount } = await query;

    // Apply ordering and pagination
    if (sortBy === 'rating') {
      query = query.order('rating', { ascending: false });
    } else if (sortBy === 'combined') {
      // Combined: ratings first, then by waiting (weighted)
      query = query.order('rating', { ascending: false });
    } else {
      // Default: by waiting (will be computed after fetching)
      query = query.order('name', { ascending: true });
    }

    const { data: clinics, error } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    const clinicIds = clinics.map((clinic) => clinic.id);

    // Fetch queue and doctor counts in parallel
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

    let enriched = clinics.map((clinic) => ({
      ...clinic,
      totalWaiting: waitingByClinic.get(clinic.id) || 0,
      doctorCount: doctorsByClinic.get(clinic.id) || 0
    }));

    // Sort by waiting if applicable
    if (sortBy === 'wait') {
      enriched.sort((a, b) => (a.totalWaiting || 0) - (b.totalWaiting || 0));
    } else if (sortBy === 'combined') {
      enriched.sort((a, b) => {
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.totalWaiting || 0) - (b.totalWaiting || 0);
      });
    }

    res.json({
      clinics: enriched,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < (totalCount || 0)
      }
    });
  } catch (err) {
    console.error('Clinics fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch clinics' });
  }
});

// ─── GET /api/patient/clinics/stats ──────────────────
// Get summary stats (clinic counts by city, total)
router.get('/clinics/stats', async (req, res) => {
  try {
    const { data: clinics, error } = await supabase
      .from('tenants')
      .select('city')
      .eq('is_active', true);

    if (error) throw error;

    const cityCounts = {};
    let total = 0;
    (clinics || []).forEach((clinic) => {
      const city = clinic.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
      total++;
    });

    res.json({
      stats: {
        total,
        byCity: cityCounts
      }
    });
  } catch (err) {
    console.error('Clinics stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/patient/search-clinics ─────────────────
// Search clinics by name, area, specialization, or doctor name
// Query: q (search term), limit (default 10)
router.get('/search-clinics', async (req, res) => {
  try {
    const today = getLocalDateString();
    const { start } = getDayBounds(today);
    const searchTerm = (req.query.q || '').toLowerCase().trim();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ results: [] });
    }

    // Search clinics and doctors in parallel
    const [{ data: clinics }, { data: doctors }] = await Promise.all([
      supabase
        .from('tenants')
        .select('id, name, subdomain, address, city, lat, lng, phone, open_time, close_time, specialization, rating, total_reviews')
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,specialization.ilike.%${searchTerm}%`)
        .limit(limit),
      supabase
        .from('users')
        .select('tenant_id, name')
        .eq('role', 'doctor')
        .eq('is_active', true)
        .ilike('name', `%${searchTerm}%`)
        .limit(20)
    ]);

    // If search by doctor name, also include their clinics
    let matchedClinicIds = new Set((clinics || []).map(c => c.id));
    if ((doctors || []).length > 0) {
      const doctorTenantIds = [...new Set((doctors || []).map(d => d.tenant_id))];
      const { data: clinicsByDoctor } = await supabase
        .from('tenants')
        .select('id, name, subdomain, address, city, lat, lng, phone, open_time, close_time, specialization, rating, total_reviews')
        .in('id', doctorTenantIds)
        .eq('is_active', true)
        .limit(limit);

      (clinicsByDoctor || []).forEach(c => matchedClinicIds.add(c.id));
    }

    const matchedClinicArray = Array.from(matchedClinicIds)
      .slice(0, limit)
      .map(id => (clinics || []).find(c => c.id === id) || { id })
      .filter(c => c.name); // filter out partial matches

    if (matchedClinicArray.length === 0) {
      return res.json({ results: [] });
    }

    const clinicIds = matchedClinicArray.map(c => c.id);

    // Fetch queue and doctor counts
    const [{ data: queueEntries }, { data: docList }] = await Promise.all([
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
    (docList || []).forEach((doctor) => {
      doctorsByClinic.set(doctor.tenant_id, (doctorsByClinic.get(doctor.tenant_id) || 0) + 1);
    });

    const enriched = matchedClinicArray.map((clinic) => ({
      ...clinic,
      totalWaiting: waitingByClinic.get(clinic.id) || 0,
      doctorCount: doctorsByClinic.get(clinic.id) || 0
    }));

    res.json({ results: enriched });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search clinics' });
  }
});
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
