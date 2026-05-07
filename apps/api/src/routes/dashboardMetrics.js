const router = require('express').Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDayBounds, getLocalDateString } = require('../utils/date');

router.use(authenticate);

// GET /api/dashboard-metrics/summary/today - Real-time summary
router.get('/summary/today', requireRole('clinic_admin', 'super_admin', 'receptionist'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const today = getLocalDateString();
    const { start, end } = getDayBounds(today);

    // Queue entries for today
    const { data: queueEntries } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('registered_at', start)
      .lte('registered_at', end);

    // Appointments for today
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('slot_date', today);

    // Calculate metrics
    const total = queueEntries?.length || 0;
    const waiting = queueEntries?.filter(e => e.status === 'waiting').length || 0;
    const inProgress = queueEntries?.filter(e => e.status === 'in_progress').length || 0;
    const done = queueEntries?.filter(e => e.status === 'done').length || 0;
    const remote = queueEntries?.filter(e => e.registration_type === 'self_registered').length || 0;
    const totalAppointments = appointments?.length || 0;
    const confirmedAppointments = appointments?.filter(a => a.status === 'confirmed').length || 0;

    // Calculate average wait time
    const completedEntries = queueEntries?.filter(e => e.status === 'done' && e.completed_at) || [];
    const waitTimes = completedEntries
      .map(e => {
        const registered = new Date(e.registered_at);
        const completed = new Date(e.completed_at);
        return Math.round((completed - registered) / 60000);
      })
      .filter(t => t > 0);

    const avgWaitMins = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    res.json({
      total,
      waiting,
      inProgress,
      done,
      remote,
      totalAppointments,
      confirmedAppointments,
      avgWaitMins,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-metrics/wait-times - Last 14 days
router.get('/wait-times', requireRole('clinic_admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const days = parseInt(req.query.days) || 14;

    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const { start, end } = getDayBounds(dateStr);

      const { data: entries } = await supabase
        .from('queue_entries')
        .select('registered_at, completed_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'done')
        .gte('registered_at', start)
        .lte('registered_at', end);

      const waitTimes = entries
        ?.map(e => {
          const reg = new Date(e.registered_at);
          const comp = new Date(e.completed_at);
          return Math.round((comp - reg) / 60000);
        })
        .filter(t => t > 0) || [];

      const avgWait = waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

      data.push({
        date: new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        avgWait,
        count: entries?.length || 0
      });
    }

    res.json(data);
  } catch (err) {
    console.error('Wait times error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-metrics/revenue/today - Today's revenue
router.get('/revenue/today', requireRole('clinic_admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const today = getLocalDateString();
    const { start, end } = getDayBounds(today);

    // Completed queue entries with payment
    const { data: queueData } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .gte('registered_at', start)
      .lte('registered_at', end);

    // Completed appointments with payment
    const { data: appointmentData } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .eq('slot_date', today);

    const queueRevenue = queueData?.reduce((sum, e) => sum + (e.payment_amount || 0), 0) || 0;
    const appointmentRevenue = appointmentData?.reduce((sum, a) => sum + (a.payment_amount || 0), 0) || 0;
    const totalRevenue = queueRevenue + appointmentRevenue;

    res.json({
      totalRevenue,
      queueRevenue,
      appointmentRevenue,
      completedCount: (queueData?.length || 0) + (appointmentData?.length || 0),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Revenue error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
