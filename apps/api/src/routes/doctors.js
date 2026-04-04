const router = require('express').Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/doctors — list doctors for this clinic
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('tenant_id', req.user.tenantId)
      .eq('role', 'doctor')
      .eq('is_active', true);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// PATCH /api/doctors/:id/toggle — toggle doctor availability
router.patch('/:id/toggle', requireRole('clinic_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: doctor } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const { data: updated } = await supabase
      .from('users')
      .update({ is_active: !doctor.is_active })
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .select()
      .single();

    const io = req.app.get('io');
    io.to(`tenant:${req.user.tenantId}`).emit('doctor:status_changed', {
      doctorId: id,
      isActive: updated.is_active
    });

    res.json({
      message: `Doctor is now ${updated.is_active ? 'available' : 'unavailable'}`,
      isActive: updated.is_active
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
});

module.exports = router;
