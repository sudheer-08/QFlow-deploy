const router = require('express').Router();
const supabase = require('../models/supabase');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/family ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: true });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// ─── POST /api/family ─────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, relation, dateOfBirth, gender, phone } = req.body;
    const { data } = await supabase
      .from('family_members')
      .insert({
        id: uuidv4(),
        owner_id: req.user.id,
        name,
        relation,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        phone: phone || null
      })
      .select()
      .single();
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add family member' });
  }
});

// ─── DELETE /api/family/:id ───────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await supabase
      .from('family_members')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);
    res.json({ message: 'Family member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove family member' });
  }
});

module.exports = router;
