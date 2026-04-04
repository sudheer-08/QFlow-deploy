const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { queueNotificationSend } = require('../jobs/reminders');

router.use(authenticate);

// ─── TEST ROUTE — push by phone (no auth) ─────────────
// POST /api/test/push
router.post('/push', requireRole('clinic_admin', 'receptionist'), async (req, res) => {
  const { phone, message } = req.body;
  const status = await queueNotificationSend({ phone, message });
  res.json(status);
});

module.exports = router;
