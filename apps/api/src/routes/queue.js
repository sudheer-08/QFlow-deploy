const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { classifySymptoms } = require('../services/ai');
const { sendPositionAlerts, sendCalledAlert, sendCompletionAlert } = require('../services/alerts');
const { scheduleRatingRequest, queueWhatsAppSend } = require('../jobs/reminders');
const { getDayBounds, getLocalDateString } = require('../utils/date');
const { assert, isNonEmptyString, isPhone, isUuid, normalizePhone } = require('../utils/validation');

// All queue routes require authentication
router.use(authenticate);

// ─── Helper: generate token number ───────────────────
const generateToken = (type, count) => {
  const prefix = type === 'emergency' ? 'E' : type === 'remote' ? 'R' : 'W';
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
};

// ─── POST /api/queue/register (Receptionist registers walk-in patient) ───
router.post('/register', requireRole('receptionist', 'clinic_admin'), async (req, res) => {
  try {
    const { patientName, phone, symptoms, doctorId, visitType, isEmergency } = req.body;
    const cleanPatientName = typeof patientName === 'string' ? patientName.trim() : patientName;
    const cleanPhone = normalizePhone(phone);

    assert(isNonEmptyString(cleanPatientName, 100), 'patientName is required');
    assert(isPhone(cleanPhone), 'Valid phone is required');
    assert(isUuid(doctorId), 'doctorId must be a valid UUID');

    const tenantId = req.user.tenantId;
    const io = req.app.get('io');

    // 1. Count today's entries for this doctor to generate token
    const today = getLocalDateString();
    const { start, end } = getDayBounds(today);
    const { count } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('doctor_id', doctorId)
      .gte('registered_at', start)
      .lte('registered_at', end);

    // 2. AI triage — classify symptoms
    let priority = 'routine';
    let aiSummary = '';
    if (symptoms) {
      const result = await classifySymptoms(symptoms);
      priority = isEmergency ? 'critical' : result.priority;
      aiSummary = result.summary;
    }
    if (isEmergency) priority = 'critical';

    const tokenNumber = generateToken(isEmergency ? 'emergency' : 'walk_in', count || 0);
    const trackerToken = uuidv4().replace(/-/g, '');

    // 3. Create patient user if not exists, or find by phone
    let patientId = uuidv4();
    const { data: existingPatient } = await supabase
      .from('users')
      .select('id')
      .eq('phone', cleanPhone)
      .eq('tenant_id', tenantId)
      .single();

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      await supabase.from('users').insert({
        id: patientId,
        tenant_id: tenantId,
        name: cleanPatientName,
        phone: cleanPhone,
        role: 'patient',
        is_active: true
      });
    }

    // 4. Create queue entry
    const { data: entry, error } = await supabase
      .from('queue_entries')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        patient_id: patientId,
        doctor_id: doctorId,
        token_number: tokenNumber,
        registration_type: 'walk_in',
        status: 'waiting',
        arrival_status: 'arrived',  // Walk-in is already here
        priority,
        symptoms,
        ai_summary: aiSummary,
        registered_at: new Date().toISOString(),
        tracker_url_token: trackerToken
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Emit real-time event to all clinic dashboards
    io.to(`tenant:${tenantId}`).emit('queue:patient_added', {
      token: tokenNumber,
      name: cleanPatientName,
      priority,
      registrationType: 'walk_in',
      aiSummary,
      entryId: entry.id
    });

    // 6. Queue WhatsApp notification (non-blocking)
    if (cleanPhone) {
      queueWhatsAppSend(cleanPhone, `Hello ${cleanPatientName}! Your token is *${tokenNumber}*. Track your position: ${process.env.FRONTEND_URL}/track/${trackerToken}`).catch(err => {
        console.error('Error queueing WhatsApp:', err.message);
      });
    }

    res.status(201).json({
      token: tokenNumber,
      trackerUrl: `/track/${trackerToken}`,
      priority,
      aiSummary,
      entryId: entry.id
    });

  } catch (err) {
    console.error('Register patient error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Registration failed' });
  }
});

// ─── GET /api/queue/live (Get live queue for this clinic) ───
router.get('/live', async (req, res) => {
  try {
    const today = getLocalDateString();
    const { start } = getDayBounds(today);

    const { data: entries, error } = await supabase
      .from('queue_entries')
      .select(`
        id, token_number, status, priority, registration_type,
        arrival_status, ai_summary, registered_at, called_at,
        users!patient_id(name, phone),
        doctors:users!doctor_id(name)
      `)
      .eq('tenant_id', req.user.tenantId)
      .in('status', ['waiting', 'called', 'in_progress'])
      .gte('registered_at', start)
      .order('priority', { ascending: false })  // critical first
      .order('registered_at', { ascending: true });

    if (error) throw error;
    res.json(entries);

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// ─── PATCH /api/queue/:entryId/call (Doctor calls next patient) ───
router.patch('/:entryId/call', requireRole('doctor', 'clinic_admin'), async (req, res) => {
  try {
    const { entryId } = req.params;
    const io = req.app.get('io');

    const { data: entry, error } = await supabase
      .from('queue_entries')
      .update({ status: 'called', called_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('tenant_id', req.user.tenantId)  // ← Tenant isolation enforced
      .select('*, users!patient_id(name, phone)')
      .single();

    if (error) throw error;

    // Real-time update to all clinic screens
    io.to(`tenant:${req.user.tenantId}`).emit('queue:token_called', {
      token: entry.token_number,
      patientName: entry.users?.name,
      entryId: entry.id
    });

    // Real-time update to patient's personal tracker page
    io.to(`tracker:${entry.tracker_url_token}`).emit('patient:called', {
      message: 'The doctor is ready for you now!',
      token: entry.token_number
    });

    // Smart WhatsApp alert to called patient
    if (entry.users?.phone) {
      await sendCalledAlert(entry.users.phone, entry.users.name, entry.token_number, 'City Care Clinic');
    }

    // Send position alerts to remaining patients in queue
    await sendPositionAlerts(req.user.tenantId, entry.doctor_id);

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to call patient' });
  }
});

// ─── PATCH /api/queue/:entryId/complete ──────────────
router.patch('/:entryId/complete', requireRole('doctor', 'clinic_admin'), async (req, res) => {
  try {
    const { entryId } = req.params;
    const io = req.app.get('io');
    const completedAt = new Date().toISOString();

    const { data: entry } = await supabase
      .from('queue_entries')
      .select('registered_at, called_at')
      .eq('id', entryId)
      .single();

    // Calculate actual wait time in minutes
    const actualWait = entry?.called_at
      ? Math.round((new Date(entry.called_at) - new Date(entry.registered_at)) / 60000)
      : null;

    const { data: updated } = await supabase
      .from('queue_entries')
      .update({ status: 'done', completed_at: completedAt, actual_wait_mins: actualWait })
      .eq('id', entryId)
      .eq('tenant_id', req.user.tenantId)
      .select()
      .single();

    io.to(`tenant:${req.user.tenantId}`).emit('queue:entry_completed', {
      token: updated.token_number,
      entryId: updated.id
    });

    // Send thank you WhatsApp to patient
    const { data: patientData } = await supabase
      .from('queue_entries')
      .select('users!patient_id(name, phone), tenants(name), doctor_id')
      .eq('id', entryId)
      .single();

    if (patientData?.users?.phone) {
      await sendCompletionAlert(patientData.users.phone, patientData.users.name, patientData.tenants?.name || 'our clinic');

      // Schedule durable rating request with Bull so it survives process restarts.
      await scheduleRatingRequest(entryId, 5 * 60 * 1000);
    }

    // Send position alerts to remaining patients
    await sendPositionAlerts(req.user.tenantId, updated.doctor_id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete entry' });
  }
});

// ─── PATCH /api/queue/:entryId/skip ──────────────────
router.patch('/:entryId/skip', requireRole('doctor', 'receptionist', 'clinic_admin'), async (req, res) => {
  try {
    const { entryId } = req.params;
    const io = req.app.get('io');

    const { data: updated } = await supabase
      .from('queue_entries')
      .update({ status: 'skipped' })
      .eq('id', entryId)
      .eq('tenant_id', req.user.tenantId)
      .select()
      .single();

    io.to(`tenant:${req.user.tenantId}`).emit('queue:entry_skipped', {
      token: updated.token_number,
      entryId: updated.id
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to skip entry' });
  }
});

module.exports = router;
