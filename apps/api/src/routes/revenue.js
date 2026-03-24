const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET today's revenue summary
router.get('/today', async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Queue entries (walk-ins) revenue
    const { data: queueRevenue } = await supabase
      .from('queue_entries')
      .select('consultation_fee, fee_collected, payment_method, status')
      .eq('tenant_id', tenantId)
      .eq('fee_collected', true)
      .gte('registered_at', `${today}T00:00:00`);

    // Appointment revenue
    const { data: apptRevenue } = await supabase
      .from('appointments')
      .select('consultation_fee, fee_collected, payment_method, payment_amount')
      .eq('tenant_id', tenantId)
      .eq('fee_collected', true)
      .eq('appointment_date', today);

    const allRevenue = [
      ...(queueRevenue || []).map(r => ({
        fee: r.consultation_fee || 0,
        method: r.payment_method || 'cash'
      })),
      ...(apptRevenue || []).map(r => ({
        fee: r.consultation_fee || r.payment_amount || 0,
        method: r.payment_method || 'cash'
      }))
    ];

    const total = allRevenue.reduce((sum, r) => sum + r.fee, 0);
    const cash = allRevenue.filter(r => r.method === 'cash').reduce((sum, r) => sum + r.fee, 0);
    const upi = allRevenue.filter(r => r.method === 'upi').reduce((sum, r) => sum + r.fee, 0);
    const card = allRevenue.filter(r => r.method === 'card').reduce((sum, r) => sum + r.fee, 0);

    // Doctor-wise breakdown
    const { data: doctorBreakdown } = await supabase
      .from('queue_entries')
      .select(`
        consultation_fee, fee_collected, payment_method,
        doctor:users!queue_entries_doctor_id_fkey(id, name)
      `)
      .eq('tenant_id', tenantId)
      .eq('fee_collected', true)
      .gte('registered_at', `${today}T00:00:00`);

    const byDoctor = {};
    (doctorBreakdown || []).forEach(e => {
      const name = e.doctor?.name || 'Unknown';
      if (!byDoctor[name]) byDoctor[name] = { name, total: 0, count: 0 };
      byDoctor[name].total += e.consultation_fee || 0;
      byDoctor[name].count += 1;
    });

    // No-show count
    const { count: noShows } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('appointment_date', today)
      .eq('status', 'no_show');

    // Hourly breakdown
    const { data: hourlyData } = await supabase
      .from('queue_entries')
      .select('consultation_fee, fee_collected_at, fee_collected')
      .eq('tenant_id', tenantId)
      .eq('fee_collected', true)
      .gte('registered_at', `${today}T00:00:00`);

    const byHour = {};
    (hourlyData || []).forEach(e => {
      if (e.fee_collected_at) {
        const hour = new Date(e.fee_collected_at).getHours();
        if (!byHour[hour]) byHour[hour] = 0;
        byHour[hour] += e.consultation_fee || 0;
      }
    });

    res.json({
      date: today,
      total,
      cash,
      upi,
      card,
      count: allRevenue.length,
      avg: allRevenue.length > 0 ? Math.round(total / allRevenue.length) : 0,
      noShows: noShows || 0,
      byDoctor: Object.values(byDoctor),
      byHour
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET revenue for date range
router.get('/range', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { from, to } = req.query;

  try {
    const { data, error } = await supabase
      .from('queue_entries')
      .select('consultation_fee, fee_collected, payment_method, registered_at')
      .eq('tenant_id', tenantId)
      .eq('fee_collected', true)
      .gte('registered_at', `${from}T00:00:00`)
      .lte('registered_at', `${to}T23:59:59`)
      .order('registered_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const byDate = {};
    (data || []).forEach(e => {
      const date = e.registered_at.split('T')[0];
      if (!byDate[date]) byDate[date] = { date, total: 0, count: 0 };
      byDate[date].total += e.consultation_fee || 0;
      byDate[date].count += 1;
    });

    res.json({ revenue: Object.values(byDate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH collect fee for queue entry
router.patch('/queue/:entryId/collect-fee',
  requireRole('receptionist', 'clinic_admin'),
  async (req, res) => {
    const tenantId = req.user.tenantId;
    const { entryId } = req.params;
    const { fee, method } = req.body;

    try {
      const { data, error } = await supabase
        .from('queue_entries')
        .update({
          consultation_fee: fee,
          fee_collected: true,
          fee_collected_at: new Date().toISOString(),
          payment_method: method || 'cash'
        })
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      res.json({ entry: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH collect fee for appointment
router.patch('/appointments/:id/collect-fee',
  requireRole('receptionist', 'clinic_admin'),
  async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { fee, method } = req.body;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({
          consultation_fee: fee,
          fee_collected: true,
          fee_collected_at: new Date().toISOString(),
          payment_method: method || 'cash'
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      res.json({ appointment: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET end of day report
router.get('/end-of-day', async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, email')
      .eq('id', tenantId)
      .single();

    const { data: queue } = await supabase
      .from('queue_entries')
      .select(`
        consultation_fee, fee_collected, payment_method, status,
        doctor:users!queue_entries_doctor_id_fkey(name)
      `)
      .eq('tenant_id', tenantId)
      .gte('registered_at', `${today}T00:00:00`);

    const completed = queue?.filter(q => q.status === 'done') || [];
    const collected = queue?.filter(q => q.fee_collected) || [];
    const total = collected.reduce((s, q) => s + (q.consultation_fee || 0), 0);
    const cash = collected.filter(q => q.payment_method === 'cash').reduce((s, q) => s + (q.consultation_fee || 0), 0);
    const upi = collected.filter(q => q.payment_method === 'upi').reduce((s, q) => s + (q.consultation_fee || 0), 0);

    res.json({
      date: today,
      clinic: tenant?.name,
      total_patients: queue?.length || 0,
      completed: completed.length,
      revenue_collected: total,
      cash,
      upi,
      card: total - cash - upi,
      pending_fee: (completed.length - collected.length),
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;