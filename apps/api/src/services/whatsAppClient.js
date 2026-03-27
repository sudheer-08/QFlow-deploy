// apps/api/src/services/whatsappClient.js
// ─── WhatsApp Web.js Client ───────────────────────────
// Uses your own WhatsApp number to send messages.
// On first start: scan the QR code that appears in the console.
// After scanning, session is saved to .wwebjs_auth/ so you only scan ONCE.

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client = null;
let isReady = false;
let qrCodeData = null;
let isInitializing = false;

const initWhatsApp = () => {
  if (client) return client;

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      // ✅ Windows-safe args — removed --single-process and --no-zygote
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu'
      ]
    }
  });

  // ── QR Code Event ─────────────────────────────────────
  client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code with WhatsApp on your phone:\n');
    qrcode.generate(qr, { small: true });
    isReady = false;

    const QRCode = require('qrcode');
    QRCode.toDataURL(qr).then(url => {
      qrCodeData = url;
    });
  });

  // ── Ready ─────────────────────────────────────────────
  client.on('ready', () => {
    console.log('✅ WhatsApp Web.js client is ready!');
    isReady = true;
    qrCodeData = null;
  });

  // ── Auth Failure ──────────────────────────────────────
  client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp auth failed:', msg);
    isReady = false;
  });

  // ── Disconnected ──────────────────────────────────────
  client.on('disconnected', async (reason) => {
    console.warn('⚠️ WhatsApp disconnected:', reason);
    isReady = false;
    setTimeout(async () => {
      try {
        console.log('🔄 Attempting WhatsApp reconnect...');
        if (client) {
          await client.destroy();
        }
      } catch (err) {
        console.warn('⚠️ WhatsApp destroy before reconnect failed:', err.message);
      } finally {
        client = null;
        initWhatsApp();
      }
    }, 5000);
  });

  // ── Catch init errors so they don't crash the whole server ──
  if (!isInitializing) {
    isInitializing = true;
    client.initialize()
      .catch(err => {
        console.error('❌ WhatsApp init error:', err.message);
        console.warn('⚠️ Server continues without WhatsApp. Fix the error and restart.');
      })
      .finally(() => {
        isInitializing = false;
      });
  }

  return client;
};

// ── Format Indian phone numbers ───────────────────────
const formatPhone = (phone) => {
  let clean = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (clean.startsWith('+')) clean = clean.slice(1);
  if (!clean.startsWith('91') && clean.length === 10) clean = '91' + clean;
  return `${clean}@c.us`;
};

// ── Send a WhatsApp message ───────────────────────────
const sendWhatsAppWebJS = async (phone, message) => {
  try {
    if (!isReady || !client) {
      return { success: false, reason: 'WhatsApp not connected. Scan QR first.' };
    }
    const chatId = formatPhone(phone);
    await client.sendMessage(chatId, message);
    console.log(`✅ WhatsApp sent to ${phone}`);
    return { success: true, channel: 'whatsapp-webjs' };
  } catch (err) {
    console.error(`❌ WhatsApp send failed:`, err.message);
    return { success: false, reason: err.message };
  }
};

const getStatus = () => ({ connected: isReady, hasQR: !!qrCodeData });
const getQRCode = () => qrCodeData;

const reconnectWhatsApp = async () => {
  try {
    isReady = false;
    qrCodeData = null;

    if (client) {
      await client.destroy();
    }

    client = null;
    initWhatsApp();
    return { success: true, message: 'WhatsApp reconnect started' };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

module.exports = { initWhatsApp, sendWhatsAppWebJS, getStatus, getQRCode, reconnectWhatsApp };
