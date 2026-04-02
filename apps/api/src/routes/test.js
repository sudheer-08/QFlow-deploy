const router = require('express').Router();
const { queueNotificationSend } = require('../jobs/reminders');

// ─── TEST ROUTE — push by phone (no auth) ─────────────
// POST /api/test/push
router.post('/push', async (req, res) => {
  const { phone, message } = req.body;
  const status = await queueNotificationSend({ phone, message });
  res.json(status);
});

module.exports = router;
