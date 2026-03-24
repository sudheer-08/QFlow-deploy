const router = require('express').Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('clinic_admin', 'super_admin'));

// ─── GET /api/advanced-analytics/overview ────────────
router.get('/overview', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const today = new Date().toISOString().split('T')[0];
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [
      { count: totalPatients },
      { count: todayPatients },
      { count: totalAppointments },
      { data: waitTimes },
      { data: noShows },
      { data: byDoctor }
    ] = await Promise.all([
      supabase.from('queue_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('queue_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('registered_at', `${today}T00:00:00`),
      supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('queue_entries').select('actual_wait_mins').eq('tenant_id', tenantId).eq('status', 'done').gte('registered_at', `${last30}T00:00:00`).not('actual_wait_mins', 'is', null),
      supabase.from('queue_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'no_show'),
      supabase.from('queue_entries').select('doctor_id, status, actual_wait_mins, doctors:users!doctor_id(name)').eq('tenant_id', tenantId).gte('registered_at', `${last30}T00:00:00`)
    ]);

    const avgWait = waitTimes?.length
      ? Math.round(waitTimes.reduce((s, e) => s + e.actual_wait_mins, 0) / waitTimes.length)
      : 0;

    // Doctor efficiency
    const doctorStats = {};
    byDoctor?.forEach(e => {
      const id = e.doctor_id;
      if (!doctorStats[id]) doctorStats[id] = { name: e.doctors?.name, total: 0, done: 0, noShow: 0, totalWait: 0 };
      doctorStats[id].total++;
      if (e.status === 'done') { doctorStats[id].done++; if (e.actual_wait_mins) doctorStats[id].totalWait += e.actual_wait_mins; }
      if (e.status === 'no_show') doctorStats[id].noShow++;
    });

    const doctors = Object.values(doctorStats).map(d => ({
      name: d.name,
      totalPatients: d.total,
      completionRate: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
      avgWait: d.done > 0 ? Math.round(d.totalWait / d.done) : 0,
      noShowRate: d.total > 0 ? Math.round((d.noShow / d.total) * 100) : 0
    }));

    // Peak hours
    const { data: hourlyData } = await supabase
      .from('queue_entries')
      .select('registered_at')
      .eq('tenant_id', tenantId)
      .gte('registered_at', `${last30}T00:00:00`);

    const peakHours = Array(24).fill(0);
    hourlyData?.forEach(e => {
      const hour = new Date(e.registered_at).getHours();
      peakHours[hour]++;
    });

    res.json({
      totalPatients: totalPatients || 0,
      todayPatients: todayPatients || 0,
      totalAppointments: totalAppointments || 0,
      avgWaitMins: avgWait,
      noShowCount: noShows || 0,
      doctors,
      peakHours: peakHours.map((count, hour) => ({
        hour: `${hour}:00`,
        patients: count
      }))
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
