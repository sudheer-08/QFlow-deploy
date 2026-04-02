const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../models/supabase');
const { classifySymptoms } = require('../services/ai');
const { queueNotificationSend } = require('../jobs/reminders');

// ─── GET /api/public/:subdomain/info ─────────────────
// Patient opens join page — get clinic info before registering
router.get('/:subdomain/info', async (req, res) => {
  try {
    const { subdomain } = req.params;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, subdomain')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single();

    if (!tenant) return res.status(404).json({ error: 'Clinic not found' });

    // Get available doctors with their current queue counts
    const today = new Date().toISOString().split('T')[0];
    const { data: doctors } = await supabase
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('role', 'doctor')
      .eq('is_active', true);

    // For each doctor, get their current queue count
    const doctorsWithQueue = await Promise.all(
      (doctors || []).map(async (doc) => {
        const { count } = await supabase
          .from('queue_entries')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('doctor_id', doc.id)
          .in('status', ['waiting', 'called', 'in_progress'])
          .gte('registered_at', `${today}T00:00:00`);

        return { ...doc, currentQueueCount: count || 0, estimatedWaitMins: (count || 0) * 8 };
      })
    );

    res.json({
      clinic: { name: tenant.name, subdomain: tenant.subdomain },
      doctors: doctorsWithQueue
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clinic info' });
  }
});

// ─── POST /api/public/:subdomain/register ─────────────
// Patient self-registers from their phone — NO login required
router.post('/:subdomain/register', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const { patientName, phone, symptoms, doctorId, visitType } = req.body;
    const io = req.app.get('io');

    // 1. Find the clinic by subdomain
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single();

    if (!tenant) return res.status(404).json({ error: 'Clinic not found' });

    // 2. Count today's remote entries for token numbering
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('doctor_id', doctorId)
      .gte('registered_at', `${today}T00:00:00`);

    // 3. AI triage
    let priority = 'routine';
    let aiSummary = '';
    if (symptoms) {
      const result = await classifySymptoms(symptoms);
      priority = result.priority;
      aiSummary = result.summary;
    }

    const tokenNumber = `R-${String((count || 0) + 1).padStart(3, '0')}`;
    const trackerToken = uuidv4().replace(/-/g, '');

    // 4. Create or find patient
    let patientId = uuidv4();
    const { data: existingPatient } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .eq('tenant_id', tenant.id)
      .single();

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      await supabase.from('users').insert({
        id: patientId,
        tenant_id: tenant.id,
        name: patientName,
        phone,
        role: 'patient',
        is_active: true
      });
    }

    // 5. Create queue entry — arrival_status is 'at_home' for remote
    const { data: entry } = await supabase
      .from('queue_entries')
      .insert({
        id: uuidv4(),
        tenant_id: tenant.id,
        patient_id: patientId,
        doctor_id: doctorId,
        token_number: tokenNumber,
        registration_type: 'self_registered',
        status: 'waiting',
        arrival_status: 'at_home',  // ← Patient is at home, not yet at clinic
        priority,
        symptoms,
        ai_summary: aiSummary,
        visit_type: visitType || 'first_visit',
        registered_at: new Date().toISOString(),
        tracker_url_token: trackerToken
      })
      .select()
      .single();

    // 6. Notify all clinic dashboards in real-time
    io.to(`tenant:${tenant.id}`).emit('queue:patient_added', {
      token: tokenNumber,
      name: patientName,
      priority,
      registrationType: 'self_registered',
      arrivalStatus: 'at_home',
      aiSummary,
      entryId: entry.id
    });

    // 7. Queue notification confirmation to patient (non-blocking)
    const trackerUrl = `${process.env.FRONTEND_URL}/track/${trackerToken}`;
    queueNotificationSend({
      phone,
      message: `✅ *${tenant.name}* — You're registered!\n\n` +
        `Token: *${tokenNumber}*\n` +
        `Status: Waiting\n\n` +
        `Track your position live:\n${trackerUrl}\n\n` +
        `We'll notify you when to head to the clinic. 🏥`
    }).catch(err => console.error('Error queueing confirmation notification:', err.message));

    res.status(201).json({
      token: tokenNumber,
      trackerUrl: `/track/${trackerToken}`,
      priority,
      clinicName: tenant.name,
      message: `You're registered! Token ${tokenNumber}. Track your position on the link sent to your notification app.`
    });

  } catch (err) {
    console.error('Self-register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── GET /api/public/track/:trackerToken ──────────────
// Patient's live tracker page — no login required
router.get('/track/:trackerToken', async (req, res) => {
  try {
    const { trackerToken } = req.params;

    const { data: entry } = await supabase
      .from('queue_entries')
      .select(`
        id, token_number, status, priority, arrival_status,
        registered_at, called_at, predicted_wait_mins,
        users!patient_id(name),
        doctors:users!doctor_id(name),
        tenants(name)
      `)
      .eq('tracker_url_token', trackerToken)
      .single();

    if (!entry) return res.status(404).json({ error: 'Token not found' });

    // Count how many people are ahead in queue
    const { count: ahead } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', entry.tenant_id)
      .eq('doctor_id', entry.doctor_id)
      .eq('status', 'waiting')
      .lt('registered_at', entry.registered_at);

    res.json({
      token: entry.token_number,
      status: entry.status,
      arrivalStatus: entry.arrival_status,
      priority: entry.priority,
      patientName: entry.users?.name,
      doctorName: entry.doctors?.name,
      clinicName: entry.tenants?.name,
      position: (ahead || 0) + 1,
      tokensAhead: ahead || 0,
      estimatedWaitMins: (ahead || 0) * 8,
      registeredAt: entry.registered_at,
      calledAt: entry.called_at
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tracker data' });
  }
});

// ─── POST /api/public/track/:trackerToken/arrived ─────
// Patient taps "I Have Arrived" on their tracker page
router.post('/track/:trackerToken/arrived', async (req, res) => {
  try {
    const { trackerToken } = req.params;
    const io = req.app.get('io');

    const { data: entry } = await supabase
      .from('queue_entries')
      .update({
        arrival_status: 'arrived',
        arrival_confirmed_at: new Date().toISOString()
      })
      .eq('tracker_url_token', trackerToken)
      .select('*, users!patient_id(name), tenants(id)')
      .single();

    if (!entry) return res.status(404).json({ error: 'Token not found' });

    // Notify reception dashboard that this patient has arrived
    io.to(`tenant:${entry.tenants?.id}`).emit('patient:arrived', {
      token: entry.token_number,
      patientName: entry.users?.name,
      entryId: entry.id
    });

    res.json({ message: 'Arrival confirmed! Please check in with reception.' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm arrival' });
  }
});

module.exports = router;
