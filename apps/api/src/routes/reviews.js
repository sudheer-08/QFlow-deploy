const router = require('express').Router();
const supabase = require('../models/supabase');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

// ─── POST /api/reviews ────────────────────────────────
// Patient submits a review after visit
router.post('/', async (req, res) => {
  try {
    const { tenantId, patientId, queueEntryId, appointmentId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Save review
    const { data: review, error } = await supabase
      .from('clinic_reviews')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        patient_id: patientId,
        queue_entry_id: queueEntryId || null,
        rating,
        comment: comment || null
      })
      .select()
      .single();

    if (error) throw error;

    // Update clinic average rating
    const { data: allReviews } = await supabase
      .from('clinic_reviews')
      .select('rating')
      .eq('tenant_id', tenantId);

    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await supabase
      .from('tenants')
      .update({
        rating: Math.round(avgRating * 10) / 10,
        total_reviews: allReviews.length
      })
      .eq('id', tenantId);

    res.status(201).json({ message: 'Review submitted! Thank you.', review });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ─── GET /api/reviews/:tenantId ───────────────────────
// Get all reviews for a clinic
router.get('/:tenantId', async (req, res) => {
  try {
    const { data: reviews } = await supabase
      .from('clinic_reviews')
      .select('rating, comment, created_at, users!patient_id(name)')
      .eq('tenant_id', req.params.tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Rating breakdown
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews?.forEach(r => breakdown[r.rating]++);

    const avg = reviews?.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      reviews: reviews || [],
      totalReviews: reviews?.length || 0,
      averageRating: Math.round(avg * 10) / 10,
      breakdown
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
