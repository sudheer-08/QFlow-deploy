const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// POST login with PIN (public — no auth needed)
router.post('/login', async (req, res) => {
  const { pin, tenant_id } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }

  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select('id, name, role, tenant_id, pin_enabled')
      .eq('tenant_id', tenant_id)
      .eq('pin', pin)
      .eq('pin_enabled', true)
      .in('role', ['receptionist', 'doctor', 'clinic_admin'])
      .single();

    if (error || !staff) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Get clinic info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, subdomain')
      .eq('id', tenant_id)
      .single();

    // Generate short-lived token (8 hours)
    const token = jwt.sign(
      {
        id: staff.id,
        role: staff.role,
        tenantId: staff.tenant_id,
        clinicName: tenant?.name,
        subdomain: tenant?.subdomain,
        loginMethod: 'pin'
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        tenantId: staff.tenant_id,
        clinicName: tenant?.name,
        subdomain: tenant?.subdomain
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST set PIN for a staff member (admin only)
router.post('/set', authenticate, requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { staff_id, pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }

  try {
    // Check PIN not already used by another staff
    const { data: existing } = await supabase
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('pin', pin)
      .neq('id', staff_id)
      .single();

    if (existing) {
      return res.status(400).json({
        error: `PIN already used by ${existing.name}. Choose a different PIN.`
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ pin, pin_enabled: true })
      .eq('id', staff_id)
      .eq('tenant_id', tenantId)
      .select('id, name, role, pin_enabled')
      .single();

    if (error) throw error;
    res.json({ staff: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE disable PIN for a staff member
router.delete('/disable/:staffId', authenticate, requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await supabase
      .from('users')
      .update({ pin: null, pin_enabled: false })
      .eq('id', req.params.staffId)
      .eq('tenant_id', tenantId);

    res.json({ message: 'PIN disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all staff with PIN status
router.get('/staff', authenticate, requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, pin_enabled')
      .eq('tenant_id', tenantId)
      .in('role', ['receptionist', 'doctor', 'clinic_admin'])
      .order('role', { ascending: true });

    if (error) throw error;
    res.json({ staff: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;