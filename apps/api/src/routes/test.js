const router = require('express').Router();
const { queueWhatsAppSend } = require('../jobs/reminders');
const supabase = require('../models/supabase');

// ─── TEST ROUTE — test WhatsApp without auth ──────────
// POST /api/test/whatsapp
router.post('/whatsapp', async (req, res) => {
  const { phone, message } = req.body;
  const status = await queueWhatsAppSend(phone, message);
  res.json(status);
});

module.exports = router;
