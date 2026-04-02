const admin = require('firebase-admin');
const supabase = require('../models/supabase');

let appInitialized = false;

function initFirebaseAdmin() {
  if (appInitialized || admin.apps.length > 0) {
    appInitialized = true;
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return false;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });

  appInitialized = true;
  return true;
}

const firebaseEnabled = () => initFirebaseAdmin();

const toDataStringMap = (input = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
};

const firstLine = (text = '') => String(text).split('\n').map((line) => line.trim()).find(Boolean) || 'QFlow Notification';

const messageWithoutFirstLine = (text = '') => {
  const lines = String(text).split('\n');
  lines.shift();
  const body = lines.join('\n').trim();
  return body || String(text).trim();
};

const toPayload = ({ title, body, message, data = {} }) => {
  const finalTitle = title || firstLine(message);
  const finalBody = body || messageWithoutFirstLine(message);
  return {
    notification: {
      title: finalTitle,
      body: finalBody
    },
    data: toDataStringMap(data)
  };
};

async function deactivateTokens(tokens = []) {
  if (!tokens.length) return;
  await supabase
    .from('user_push_tokens')
    .update({ is_active: false })
    .in('token', tokens);
}

async function sendPushToTokens(tokens = [], payloadInput = {}) {
  if (!firebaseEnabled()) {
    return { success: false, reason: 'firebase-not-configured' };
  }

  if (!tokens.length) {
    return { success: false, reason: 'no-device-tokens' };
  }

  const payload = toPayload(payloadInput);
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: payload.notification,
    data: payload.data,
    webpush: {
      notification: payload.notification,
      fcmOptions: {
        link: payload.data.link || process.env.FRONTEND_URL || '/'
      }
    }
  });

  const invalidTokens = [];
  response.responses.forEach((item, idx) => {
    if (!item.success) {
      const code = item.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  if (invalidTokens.length) {
    await deactivateTokens(invalidTokens);
  }

  return {
    success: response.successCount > 0,
    successCount: response.successCount,
    failureCount: response.failureCount
  };
}

async function getActiveTokensByUserId(userId) {
  const { data } = await supabase
    .from('user_push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true);

  return (data || []).map((row) => row.token).filter(Boolean);
}

async function sendPushToUser(userId, payloadInput = {}) {
  if (!userId) return { success: false, reason: 'missing-user-id' };
  const tokens = await getActiveTokensByUserId(userId);
  return sendPushToTokens(tokens, payloadInput);
}

async function sendPushByPhone(phone, payloadInput = {}) {
  if (!phone) return { success: false, reason: 'missing-phone' };

  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .eq('is_active', true)
    .limit(10);

  const userIds = [...new Set((users || []).map((u) => u.id).filter(Boolean))];
  if (!userIds.length) return { success: false, reason: 'no-users-with-phone' };

  let successCount = 0;
  let failureCount = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payloadInput);
    successCount += result.successCount || 0;
    failureCount += result.failureCount || 0;
  }

  return { success: successCount > 0, successCount, failureCount };
}

module.exports = {
  firebaseEnabled,
  sendPushToTokens,
  sendPushToUser,
  sendPushByPhone,
  toPayload
};
