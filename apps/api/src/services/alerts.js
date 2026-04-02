const { queueNotificationSend } = require('../jobs/reminders');
const supabase = require('../models/supabase');
const { getDayBounds, getLocalDateString } = require('../utils/date');

// ─── Send smart position-based alerts ────────────────
// Called every time queue changes (patient called, completed, skipped)
const sendPositionAlerts = async (tenantId, doctorId) => {
  try {
    const today = getLocalDateString();
    const { start } = getDayBounds(today);

    // Get all waiting patients for this doctor, ordered by position
    const { data: waitingPatients } = await supabase
      .from('queue_entries')
      .select(`
        id, token_number, tracker_url_token, arrival_status,
        users!patient_id(name, phone)
      `)
      .eq('tenant_id', tenantId)
      .eq('doctor_id', doctorId)
      .eq('status', 'waiting')
      .gte('registered_at', start)
      .order('registered_at', { ascending: true });

    if (!waitingPatients || waitingPatients.length === 0) return;

    // Send alerts based on position
    for (let i = 0; i < waitingPatients.length; i++) {
      const patient = waitingPatients[i];
      const phone = patient.users?.phone;
      const name = patient.users?.name;
      const token = patient.token_number;
      const position = i + 1;
      const trackerUrl = `${process.env.FRONTEND_URL}/track/${patient.tracker_url_token}`;

      if (!phone) continue;

      // Position 1 — they are next!
      if (position === 1) {
        queueNotificationSend({
          phone,
          message: `🔔 *${name}*, you're *NEXT* in line!\n\n` +
            `Token: *${token}*\n` +
            `Please make your way to the clinic now if you haven't already.\n\n` +
            `Track live: ${trackerUrl}`
        }).catch(err => console.error('Alert notification error:', err.message));
      }

      // Position 2 — one person ahead, start heading over
      else if (position === 2 && patient.arrival_status === 'at_home') {
        queueNotificationSend({
          phone,
          message: `⏱️ *${name}*, one person ahead of you.\n\n` +
            `Start heading to the clinic now!\n\n` +
            `Token: *${token}* | Track: ${trackerUrl}`
        }).catch(err => console.error('Alert notification error:', err.message));
      }

      // Position 3 — heads up, getting close
      else if (position === 3 && patient.arrival_status === 'at_home') {
        queueNotificationSend({
          phone,
          message: `📍 *${name}*, you're 2 people away from the doctor.\n\n` +
            `Prepare to head to the clinic shortly.\n\n` +
            `Token: *${token}*`
        }).catch(err => console.error('Alert notification error:', err.message));
      }
    }
  } catch (err) {
    console.error('Position alerts error:', err.message);
  }
};

// ─── Send registration confirmation ──────────────────
const sendRegistrationAlert = async (phone, name, token, position, trackerUrl, clinicName) => {
  queueNotificationSend({
    phone,
    message:
    `✅ *${clinicName}* — You're registered!\n\n` +
    `Token: *${token}*\n` +
    `Position: #${position} in queue\n` +
    `Est. wait: ~${position * 8} minutes\n\n` +
    `Track your position live:\n${trackerUrl}\n\n` +
    `We'll notify you when to head over. 🏥`
  }).catch(err => console.error('Registration alert error:', err.message));
};

// ─── Send called alert ────────────────────────────────
const sendCalledAlert = async (phone, name, token, clinicName) => {
  queueNotificationSend({
    phone,
    message:
    `🔔 *${name}* — The doctor is ready for you!\n\n` +
    `Token: *${token}*\n` +
    `Please proceed to the consultation room now.\n\n` +
    `Thank you for choosing ${clinicName} 🏥`
  }).catch(err => console.error('Called alert error:', err.message));
};

// ─── Send thank you after consultation ───────────────
const sendCompletionAlert = async (phone, name, clinicName) => {
  queueNotificationSend({
    phone,
    message:
    `✅ *Consultation complete!*\n\n` +
    `Thank you for visiting *${clinicName}*, ${name}.\n\n` +
    `We hope you feel better soon! 💊\n` +
    `Please follow your doctor's advice and take care.`
  }).catch(err => console.error('Completion alert error:', err.message));
};

module.exports = {
  sendPositionAlerts,
  sendRegistrationAlert,
  sendCalledAlert,
  sendCompletionAlert
};
