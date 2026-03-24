const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET clinic profile
router.get('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
    res.json({ clinic: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update clinic profile
router.put('/', requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    name, address, phone, email, about,
    services, specializations, fee_range,
    opening_time, closing_time, working_days,
    logo_url
  } = req.body;

  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        name, address, phone, email, about,
        services, specializations, fee_range,
        opening_time, closing_time, working_days,
        logo_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json({ clinic: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;