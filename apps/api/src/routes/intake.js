const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate } = require('../middleware/auth');
const { classifySymptoms } = require('../services/ai');

router.use(authenticate);

// POST submit intake form
router.post('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    appointment_id,
    patient_id,
    chief_complaint,
    complaint_hindi,
    symptom_tags,
    current_medicines,
    allergies,
    filled_by
  } = req.body;

  try {
    // AI classify symptoms
    let ai_summary = '';
    let priority = 'routine';
    if (chief_complaint) {
      const result = await classifySymptoms(chief_complaint);
      ai_summary = result.summary;
      priority = result.priority;
    }

    const { data, error } = await supabase
      .from('intake_forms')
      .upsert({
        appointment_id,
        tenant_id: tenantId,
        patient_id,
        chief_complaint,
        complaint_hindi,
        symptom_tags,
        current_medicines,
        allergies,
        filled_by: filled_by || 'patient',
        ai_summary,
        priority,
        created_at: new Date().toISOString()
      }, { onConflict: 'appointment_id' })
      .select()
      .single();

    if (error) throw error;

    // Update appointment priority if critical
    if (priority === 'critical') {
      await supabase
        .from('appointments')
        .update({ priority: 'critical' })
        .eq('id', appointment_id);
    }

    res.json({ intake: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET intake form for an appointment
router.get('/appointment/:appointmentId', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('appointment_id', req.params.appointmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ intake: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all today's intake forms for doctor
router.get('/today', async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase
      .from('intake_forms')
      .select(`
        *,
        patient:users!intake_forms_patient_id_fkey(name, phone),
        appointment:appointments(appointment_date, slot_time, doctor_id)
      `)
      .eq('tenant_id', tenantId)
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ forms: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;