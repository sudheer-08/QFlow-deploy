const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET full patient brief before consultation
router.get('/patient/:patientId', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { patientId } = req.params;
  const { appointmentId, queueEntryId } = req.query;

  try {
    // 1. Patient basic info
    const { data: patient } = await supabase
      .from('users')
      .select('id, name, phone, email, date_of_birth, gender, blood_group')
      .eq('id', patientId)
      .single();

    // 2. Today's intake form
    let intake = null;
    if (appointmentId) {
      const { data } = await supabase
        .from('intake_forms')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single();
      intake = data;
    }

    // 3. Past visits (last 5)
    const { data: pastVisits } = await supabase
      .from('consultation_notes')
      .select(`
        id, diagnosis, medicines, instructions, 
        follow_up_date, created_at,
        doctor:users!consultation_notes_doctor_id_fkey(name)
      `)
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. Past appointments count
    const { count: totalVisits } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed');

    // 5. Queue entry info
    let queueEntry = null;
    if (queueEntryId) {
      const { data } = await supabase
        .from('queue_entries')
        .select('id, token_number, priority, symptoms, ai_summary, arrival_status')
        .eq('id', queueEntryId)
        .single();
      queueEntry = data;
    }

    res.json({
      patient,
      intake,
      pastVisits: pastVisits || [],
      totalVisits: totalVisits || 0,
      queueEntry
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all today's queue with intake status for doctor
router.get('/queue/today', requireRole('doctor', 'clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const doctorId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: queue } = await supabase
      .from('queue_entries')
      .select(`
        id, token_number, status, priority, symptoms, 
        ai_summary, arrival_status, registered_at,
        patient:users!queue_entries_patient_id_fkey(id, name, phone)
      `)
      .eq('tenant_id', tenantId)
      .eq('doctor_id', doctorId)
      .in('status', ['waiting', 'called', 'in_progress'])
      .gte('registered_at', `${today}T00:00:00`)
      .order('registered_at', { ascending: true });

    // Check which patients have filled intake forms
    const patientIds = queue?.map(q => q.patient?.id).filter(Boolean);
    
    let intakeFilled = [];
    if (patientIds?.length > 0) {
      const { data: intakes } = await supabase
        .from('intake_forms')
        .select('patient_id')
        .in('patient_id', patientIds)
        .gte('created_at', `${today}T00:00:00`);
      intakeFilled = intakes?.map(i => i.patient_id) || [];
    }

    const enriched = queue?.map(q => ({
      ...q,
      has_intake: intakeFilled.includes(q.patient?.id)
    }));

    res.json({ queue: enriched || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;