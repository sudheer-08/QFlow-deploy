const router = require('express').Router();
const supabase = require('../models/supabase');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/health-records/my ──────────────────────
router.get('/my', async (req, res) => {
  try {
    const { data: visits } = await supabase
      .from('queue_entries')
      .select(`
        id, registered_at, status, symptoms, ai_summary, priority,
        doctors:users!doctor_id(name, specialization),
        tenants(name, address)
      `)
      .eq('patient_id', req.user.id)
      .eq('status', 'done')
      .order('registered_at', { ascending: false })
      .limit(50);

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, slot_time, status, symptoms, ai_summary,
        doctors:users!doctor_id(name, specialization),
        tenants(name, address)
      `)
      .eq('patient_id', req.user.id)
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .limit(50);

    const { data: notes } = await supabase
      .from('consultation_notes')
      .select('*, doctors:users!doctor_id(name)')
      .eq('patient_id', req.user.id)
      .order('created_at', { ascending: false });

    res.json({
      visits: visits || [],
      appointments: appointments || [],
      notes: notes || [],
      totalVisits: (visits?.length || 0) + (appointments?.length || 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health records' });
  }
});

// ─── POST /api/health-records/notes ──────────────────
router.post('/notes', async (req, res) => {
  try {
    const { patientId, queueEntryId, diagnosis, prescription, notes, followUpDate } = req.body;

    const { data } = await supabase
      .from('consultation_notes')
      .insert({
        id: uuidv4(),
        tenant_id: req.user.tenantId,
        doctor_id: req.user.id,
        patient_id: patientId,
        queue_entry_id: queueEntryId,
        diagnosis,
        prescription,
        notes,
        follow_up_date: followUpDate || null
      })
      .select()
      .single();

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

module.exports = router;
