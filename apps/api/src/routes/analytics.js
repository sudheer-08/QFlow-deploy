const router = require('express').Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/analytics/summary/today ────────────────
router.get('/summary/today', requireRole('receptionist', 'doctor', 'clinic_admin', 'super_admin'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tenantId = req.user.tenantId;

    const { data: entries } = await supabase
      .from('queue_entries')
      .select('status, registration_type, arrival_status, actual_wait_mins')
      .eq('tenant_id', tenantId)
      .gte('registered_at', `${today}T00:00:00`);

    const total = entries?.length || 0;
    const waiting = entries?.filter(e => e.status === 'waiting').length || 0;
    const inProgress = entries?.filter(e => e.status === 'in_progress').length || 0;
    const done = entries?.filter(e => e.status === 'done').length || 0;
    const remote = entries?.filter(e => e.registration_type === 'self_registered').length || 0;
    const enRoute = entries?.filter(e => e.arrival_status === 'en_route').length || 0;

    const waitTimes = entries?.filter(e => e.actual_wait_mins).map(e => e.actual_wait_mins) || [];
    const avgWait = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    res.json({ total, waiting, inProgress, done, remote, enRoute, avgWaitMins: avgWait });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ─── GET /api/analytics/wait-times ───────────────────
router.get('/wait-times', requireRole('clinic_admin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('queue_entries')
      .select('registered_at, actual_wait_mins')
      .eq('tenant_id', req.user.tenantId)
      .eq('status', 'done')
      .gte('registered_at', from)
      .not('actual_wait_mins', 'is', null);

    // Group by date and calculate daily average
    const byDate = {};
    data?.forEach(entry => {
      const date = entry.registered_at.split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(entry.actual_wait_mins);
    });

    const result = Object.entries(byDate).map(([date, times]) => ({
      date,
      avgWaitMins: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      patientCount: times.length
    }));

    res.json(result.sort((a, b) => a.date.localeCompare(b.date)));

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wait times' });
  }
});

module.exports = router;
