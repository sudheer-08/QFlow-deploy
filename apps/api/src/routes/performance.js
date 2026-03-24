const express = require('express');
const router = express.Router();
const supabase = require('../models/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET doctor performance scorecard
router.get('/doctors', requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { from, to } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate = to || today;

  try {
    // Get all doctors for this clinic
    const { data: doctors } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('tenant_id', tenantId)
      .eq('role', 'doctor');

    const scorecards = await Promise.all((doctors || []).map(async (doc) => {

      // Total patients seen
      const { count: totalSeen } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .eq('status', 'done')
        .gte('registered_at', `${fromDate}T00:00:00`)
        .lte('registered_at', `${toDate}T23:59:59`);

      // No shows
      const { count: noShows } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .eq('status', 'no_show')
        .gte('registered_at', `${fromDate}T00:00:00`)
        .lte('registered_at', `${toDate}T23:59:59`);

      // Average wait time
      const { data: waitData } = await supabase
        .from('queue_entries')
        .select('actual_wait_mins')
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .eq('status', 'done')
        .not('actual_wait_mins', 'is', null)
        .gte('registered_at', `${fromDate}T00:00:00`)
        .lte('registered_at', `${toDate}T23:59:59`);

      const avgWait = waitData?.length > 0
        ? Math.round(waitData.reduce((s, w) => s + (w.actual_wait_mins || 0), 0) / waitData.length)
        : 0;

      // Average rating
      const { data: reviews } = await supabase
        .from('clinic_reviews')
        .select('rating')
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .gte('created_at', `${fromDate}T00:00:00`);

      const avgRating = reviews?.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;

      // Revenue generated
      const { data: revenue } = await supabase
        .from('queue_entries')
        .select('consultation_fee')
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .eq('fee_collected', true)
        .gte('registered_at', `${fromDate}T00:00:00`)
        .lte('registered_at', `${toDate}T23:59:59`);

      const totalRevenue = revenue?.reduce((s, r) => s + (r.consultation_fee || 0), 0) || 0;

      // Today's count
      const { count: todayCount } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .eq('status', 'done')
        .gte('registered_at', `${today}T00:00:00`);

      // Critical patients handled
      const { count: criticalCount } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doc.id)
        .eq('priority', 'critical')
        .gte('registered_at', `${fromDate}T00:00:00`);

      return {
        id: doc.id,
        name: doc.name,
        email: doc.email,
        totalSeen: totalSeen || 0,
        todayCount: todayCount || 0,
        noShows: noShows || 0,
        avgWaitMins: avgWait,
        avgRating: avgRating ? parseFloat(avgRating) : null,
        totalRevenue,
        criticalHandled: criticalCount || 0,
        noShowRate: totalSeen > 0
          ? Math.round(((noShows || 0) / totalSeen) * 100)
          : 0
      };
    }));

    res.json({ scorecards, fromDate, toDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET peak hour heatmap data
router.get('/peak-hours', requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { days = 30 } = req.query;
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: entries } = await supabase
      .from('queue_entries')
      .select('registered_at')
      .eq('tenant_id', tenantId)
      .gte('registered_at', fromDate)
      .order('registered_at', { ascending: true });

    // Build heatmap: day of week (0-6) x hour (0-23)
    const heatmap = {};
    for (let day = 0; day < 7; day++) {
      heatmap[day] = {};
      for (let hour = 7; hour < 21; hour++) {
        heatmap[day][hour] = 0;
      }
    }

    (entries || []).forEach(e => {
      const date = new Date(e.registered_at);
      const day = date.getDay();
      const hour = date.getHours();
      if (hour >= 7 && hour < 21) {
        heatmap[day][hour] = (heatmap[day][hour] || 0) + 1;
      }
    });

    // Find max for normalization
    let max = 0;
    Object.values(heatmap).forEach(hours => {
      Object.values(hours).forEach(count => {
        if (count > max) max = count;
      });
    });

    res.json({ heatmap, max, days: parseInt(days) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET patient retention stats
router.get('/retention', requireRole('clinic_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const { data: patients } = await supabase
      .from('queue_entries')
      .select('patient_id, registered_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .order('registered_at', { ascending: true });

    const patientVisits = {};
    (patients || []).forEach(p => {
      if (!patientVisits[p.patient_id]) patientVisits[p.patient_id] = [];
      patientVisits[p.patient_id].push(p.registered_at);
    });

    const total = Object.keys(patientVisits).length;
    const returning = Object.values(patientVisits).filter(v => v.length > 1).length;
    const newPatients = total - returning;

    // 30-day retention
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPatients = new Set(
      (patients || [])
        .filter(p => new Date(p.registered_at) > thirtyDaysAgo)
        .map(p => p.patient_id)
    );
    const returnedRecently = Object.entries(patientVisits)
      .filter(([id, visits]) =>
        recentPatients.has(id) && visits.length > 1
      ).length;

    res.json({
      totalPatients: total,
      newPatients,
      returningPatients: returning,
      retentionRate: total > 0 ? Math.round((returning / total) * 100) : 0,
      thirtyDayRetention: recentPatients.size > 0
        ? Math.round((returnedRecently / recentPatients.size) * 100)
        : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;