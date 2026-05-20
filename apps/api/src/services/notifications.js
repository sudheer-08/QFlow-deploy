const { queueNotificationSend } = require('../jobs/reminders');

const TEMPLATES = {
  booking_confirmed: (vars) => `Hello ${vars.name}, your token at ${vars.clinic_name} is T-${String(vars.token_number).padStart(3, '0')}. Estimated time: ${vars.estimated_window}. Track your queue live: ${vars.tracker_url} Check in when you arrive: ${vars.checkin_url}`,
  checkin_confirmed: (vars) => `You've checked in at ${vars.clinic_name}. You are number ${vars.position} in the queue. Estimated time: ~${vars.eta}. We'll notify you when your turn is coming up.`,
  heads_up_approaching: (vars) => `Your turn at ${vars.clinic_name} is coming up soon. ${vars.tokens_ahead} patient(s) ahead of you. Estimated time: ~${vars.eta}. Please make your way to the clinic now.`,
  you_are_called: (vars) => `You are being called now at ${vars.clinic_name}. Please proceed to the consultation room immediately. Token: T-${String(vars.token_number).padStart(3, '0')}`,
  eta_updated: (vars) => `Update from ${vars.clinic_name}: your estimated time has been updated to ~${vars.new_eta} (approx ${vars.delay_minutes} min change). Track live: ${vars.tracker_url}`,
  skipped_notification: (vars) => `You were called at ${vars.clinic_name} but were not present. Your token T-${String(vars.token_number).padStart(3, '0')} is still valid — please come to reception when you arrive and we'll fit you back in.`,
  delay_alert: (vars) => `Update from ${vars.clinic_name}: appointments are running approximately ${vars.delay_minutes} minutes late today. Your updated estimated time is ~${vars.new_eta}. No need to rush — we'll notify you when your turn is approaching. We apologise for the inconvenience.`,
};


/**
 * Sends a notification using a pre-defined template via a background job queue.
 * @param {string} phone - The recipient's phone number.
 * @param {keyof TEMPLATES} templateName - The name of the template to use.
 * @param {object} variables - The variables to inject into the template.
 */
const sendNotification = async (phone, templateName, variables) => {
  if (!phone) {
    console.warn(`Notification "${templateName}" skipped: Phone number not provided.`);
    return { success: false, reason: 'Phone number not provided' };
  }

  if (!TEMPLATES[templateName]) {
    console.error(`Notification template "${templateName}" not found.`);
    return { success: false, reason: `Template ${templateName} not found.` };
  }

  const message = TEMPLATES[templateName](variables);

  // Use the job queue to send the message asynchronously
  return queueNotificationSend({ phone, message });
};

module.exports = {
  sendNotification,
};
