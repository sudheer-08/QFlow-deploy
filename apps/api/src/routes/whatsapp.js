const router = require('express').Router();
const { getStatus, getQRCode, reconnectWhatsApp } = require('../services/whatsAppClient');

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// GET /api/whatsapp/qr (returns QR data URL while waiting for scan)
router.get('/qr', (req, res) => {
  const qr = getQRCode();
  if (!qr) return res.status(404).json({ message: 'QR not available' });
  res.json({ qr });
});

// POST /api/whatsapp/reconnect
router.post('/reconnect', async (req, res) => {
  const result = await reconnectWhatsApp();
  if (!result.success) {
    return res.status(500).json(result);
  }
  return res.json(result);
});

module.exports = router;
