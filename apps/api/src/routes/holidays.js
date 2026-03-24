const router = require('express').Router();
const supabase = require('../models/supabase');
const { v4: uuidv4 } = require('uuid');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/holidays ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data } = await supabase
      .from('clinic_holidays')
      .select('*')
      .eq('tenant_id', req.user.tenantId)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// ─── POST /api/holidays ───────────────────────────────
router.post('/', requireRole('clinic_admin'), async (req, res) => {
  try {
    const { date, reason } = req.body;
    const { data } = await supabase
      .from('clinic_holidays')
      .insert({
        id: uuidv4(),
        tenant_id: req.user.tenantId,
        date,
        reason: reason || 'Holiday'
      })
      .select()
      .single();
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

// ─── DELETE /api/holidays/:id ─────────────────────────
router.delete('/:id', requireRole('clinic_admin'), async (req, res) => {
  try {
    await supabase
      .from('clinic_holidays')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenantId);
    res.json({ message: 'Holiday removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove holiday' });
  }
});

module.exports = router;
