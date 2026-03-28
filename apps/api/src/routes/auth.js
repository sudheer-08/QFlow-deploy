const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  assert,
  isEmail,
  isNonEmptyString,
  isPhone,
  isStrongPassword,
  isSubdomain,
  isTimeHHMM,
  normalizeEmail,
  normalizePhone
} = require('../utils/validation');
const { queueWhatsAppSend } = require('../jobs/reminders');

// ─── Helper: generate tokens ──────────────────────────
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email
  };

  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });

  return { accessToken, refreshToken };
};

// ─── POST /api/auth/register-clinic ──────────────────
// Onboard a brand new clinic as a tenant
router.post('/register-clinic', async (req, res) => {
  try {
    const {
      clinicName, subdomain, adminEmail, adminPassword, adminName,
      address, city, lat, lng, phone, specialization,
      openTime, closeTime, doctors
    } = req.body;

    const cleanSubdomain = typeof subdomain === 'string' ? subdomain.trim().toLowerCase() : '';
    const cleanAdminEmail = normalizeEmail(adminEmail);
    const cleanAdminPhone = phone ? normalizePhone(phone) : null;
    const cleanAdminName = typeof adminName === 'string' ? adminName.trim() : adminName;

    assert(isNonEmptyString(clinicName, 100), 'Clinic name is required');
    assert(isSubdomain(cleanSubdomain), 'Subdomain must be 3-50 chars using lowercase letters, numbers, or hyphen');
    assert(isEmail(cleanAdminEmail), 'Valid admin email is required');
    assert(isNonEmptyString(cleanAdminName, 100), 'Admin name is required');
    assert(isStrongPassword(adminPassword), 'Password must be 8+ chars with uppercase, lowercase, number, and special character');
    if (phone) {
      assert(isPhone(cleanAdminPhone), 'Phone number is invalid');
    }
    if (openTime) {
      assert(isTimeHHMM(openTime), 'openTime must be in HH:MM format');
    }
    if (closeTime) {
      assert(isTimeHHMM(closeTime), 'closeTime must be in HH:MM format');
    }

    // 1. Check subdomain is unique
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('subdomain', cleanSubdomain)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Clinic name already taken. Please try a different name.' });
    }

    // 2. Check email is unique
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanAdminEmail)
      .single();

    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered. Please sign in.' });
    }

    // 3. Create tenant (the clinic) with full details
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        id: uuidv4(),
        name: clinicName,
        subdomain: cleanSubdomain,
        is_active: true,
        address: address || null,
        city: city || 'Chandigarh',
        lat: lat || null,
        lng: lng || null,
        phone: cleanAdminPhone,
        specialization: specialization || 'Dental',
        open_time: openTime || '09:00',
        close_time: closeTime || '20:00',
        rating: 0,
        total_reviews: 0
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // 4. Create admin user
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        tenant_id: tenant.id,
        name: cleanAdminName,
        email: cleanAdminEmail,
        password_hash: passwordHash,
        role: 'clinic_admin',
        is_active: true
      })
      .select()
      .single();

    if (userError) throw userError;

    // 5. Create doctors
    if (doctors && doctors.length > 0) {
      const doctorRecords = doctors
        .filter(d => d.name)
        .map(d => ({
          id: uuidv4(),
          tenant_id: tenant.id,
          name: d.name,
          email: `doctor_${uuidv4().slice(0,8)}@${cleanSubdomain}.qflow`,
          password_hash: passwordHash,
          role: 'doctor',
          specialization: d.specialization || 'General Dentistry',
          experience_years: parseInt(d.experience) || 5,
          is_active: true
        }));

      const { data: insertedDoctors } = await supabase
        .from('users')
        .insert(doctorRecords)
        .select();

      // Create slot settings for each doctor
      if (insertedDoctors) {
        await supabase.from('doctor_slot_settings').insert(
          insertedDoctors.map(doc => ({
            id: uuidv4(),
            tenant_id: tenant.id,
            doctor_id: doc.id,
            slot_duration_mins: 20,
            consultation_fee: parseInt(doctors.find(d => d.name === doc.name)?.fee) || 300,
            is_accepting_appointments: true
          }))
        );
      }
    }

    // 6. Send welcome message
    if (cleanAdminPhone) {
      queueWhatsAppSend(
        cleanAdminPhone,
        `🎉 Welcome to QFlow!\n\n` +
        `*${clinicName}* is now registered.\n\n` +
        `Your clinic page: ${process.env.FRONTEND_URL}/clinic/${cleanSubdomain}\n` +
        `Admin dashboard: ${process.env.FRONTEND_URL}/admin\n\n` +
        `Login: ${cleanAdminEmail}\n\n` +
        `Start accepting appointments today! 🦷`
      ).catch((waErr) => {
        console.error('Error queueing welcome WhatsApp:', waErr.message);
      });
    }

    const tokens = generateTokens({ ...user, tenant_id: tenant.id });

    res.status(201).json({
      message: 'Clinic registered successfully',
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        clinicName: tenant.name
      },
      ...tokens
    });

  } catch (err) {
    console.error('Register clinic error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/register-patient ─────────────────
// Patient self-registration (called from PatientLoginPage)
router.post('/register-patient', async (req, res) => {
  try {
    const { name, phone, email, password, gender, dateOfBirth } = req.body;
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone ? normalizePhone(phone) : null;
    const cleanName = typeof name === 'string' ? name.trim() : name;

    assert(isNonEmptyString(cleanName, 100), 'Name is required');
    assert(isEmail(cleanEmail), 'Valid email is required');
    assert(isStrongPassword(password), 'Password must be 8+ chars with uppercase, lowercase, number, and special character');
    if (phone) {
      assert(isPhone(cleanPhone), 'Phone number is invalid');
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Please sign in.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        tenant_id: null,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'patient',
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
        profile_complete: true,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    const tokens = generateTokens(user);

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: 'patient', phone: user.phone },
      ...tokens
    });

  } catch (err) {
    console.error('Patient register error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = normalizeEmail(email);

    assert(isEmail(cleanEmail), 'Valid email is required');
    assert(isNonEmptyString(password, 128), 'Password is required');

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*, tenants(name, subdomain)')
      .eq('email', cleanEmail)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = generateTokens(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        clinicName: user.tenants?.name
      },
      ...tokens
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Login failed' });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Fetch fresh user data
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (!user) return res.status(401).json({ error: 'User not found' });

    const tokens = generateTokens(user);
    res.json(tokens);

  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── POST /api/auth/register-staff ───────────────────
// Clinic admin creates receptionist/doctor accounts for their clinic
router.post('/register-staff', authenticate, requireRole('clinic_admin'), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      specialization,
      experienceYears,
      consultationFee
    } = req.body;

    const tenantId = req.user.tenantId;
    const cleanName = typeof name === 'string' ? name.trim() : name;
    const cleanEmail = normalizeEmail(email);

    assert(isNonEmptyString(cleanName, 100), 'Name is required');
    assert(isEmail(cleanEmail), 'Valid email is required');
    assert(isStrongPassword(password), 'Password must be 8+ chars with uppercase, lowercase, number, and special character');
    assert(['receptionist', 'doctor'].includes(role), 'Role must be receptionist or doctor');

    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered. Use a different email.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        name: cleanName,
        email: cleanEmail,
        password_hash: passwordHash,
        role,
        specialization: role === 'doctor' ? (specialization || 'General Dentistry') : null,
        experience_years: role === 'doctor' ? (Number.parseInt(experienceYears, 10) || 5) : null,
        is_active: true
      })
      .select('id, name, email, role, tenant_id, specialization, experience_years')
      .single();

    if (createError) throw createError;

    if (role === 'doctor') {
      await supabase
        .from('doctor_slot_settings')
        .insert({
          id: uuidv4(),
          tenant_id: tenantId,
          doctor_id: createdUser.id,
          slot_duration_mins: 20,
          consultation_fee: Number.parseInt(consultationFee, 10) || 300,
          is_accepting_appointments: true
        });
    }

    res.status(201).json({
      message: 'Staff account created successfully',
      staff: createdUser
    });
  } catch (err) {
    console.error('Register staff error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to create staff account' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, role, tenant_id, tenants(name, subdomain)')
    .eq('id', req.user.id)
    .single();

  res.json(user);
});

module.exports = router;