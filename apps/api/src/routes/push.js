const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../models/supabase');
const { firebaseEnabled, sendPushToUser } = require('../services/push');

const ALLOWED_PLATFORMS = new Set(['web', 'android', 'ios', 'unknown']);

function toPushTokenTableError(err) {
  const message = err?.message || 'Failed to register push token';
  if (message.includes("Could not find the table 'public.user_push_tokens'")) {
    return {
      status: 503,
      body: {
        error: 'Push token table is missing. Run the user_push_tokens SQL migration first.',
        code: 'push_tokens_table_missing'
      }
    };
  }
  return { status: 500, body: { error: message } };
}

router.use(authenticate);

router.post('/token', async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const rawPlatform = typeof req.body.platform === 'string' ? req.body.platform.trim().toLowerCase() : 'web';
    const platform = ALLOWED_PLATFORMS.has(rawPlatform) ? rawPlatform : 'unknown';
    const sendWelcome = Boolean(req.body.sendWelcome);

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: req.user.id,
          token,
          platform,
          is_active: true,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: 'token' }
      );

    if (error) throw error;

    let onboardingPush = { attempted: false };
    if (sendWelcome) {
      onboardingPush = { attempted: true };
      if (firebaseEnabled()) {
        const welcomeResult = await sendPushToUser(req.user.id, {
          title: 'Welcome to QFlow',
          body: 'Notifications are enabled for this device.',
          data: { type: 'onboarding_welcome' }
        });
        onboardingPush.result = welcomeResult;
      } else {
        onboardingPush.result = { success: false, reason: 'firebase-not-configured' };
      }
    }

    return res.json({ success: true, onboardingPush });
  } catch (err) {
    const mapped = toPushTokenTableError(err);
    return res.status(mapped.status).json(mapped.body);
  }
});

router.delete('/token', async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';

    if (token) {
      await supabase
        .from('user_push_tokens')
        .update({ is_active: false })
        .eq('user_id', req.user.id)
        .eq('token', token);
    } else {
      await supabase
        .from('user_push_tokens')
        .update({ is_active: false })
        .eq('user_id', req.user.id);
    }

    return res.json({ success: true });
  } catch (err) {
    const mapped = toPushTokenTableError(err);
    return res.status(mapped.status).json(mapped.body);
  }
});

router.post('/test', async (req, res) => {
  try {
    if (!firebaseEnabled()) {
      return res.status(400).json({ error: 'Firebase is not configured' });
    }

    const title = req.body.title || 'QFlow Test Notification';
    const body = req.body.body || 'Push notifications are working.';
    const result = await sendPushToUser(req.user.id, {
      title,
      body,
      data: { type: 'test' }
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
