const { sendWhatsAppWebJS } = require('./whatsAppClient');

// ─── Core sender (keep this — alerts.js and reminders.js use it) ───
const sendWhatsApp = async (phone, message) => {
  if (!phone) {
    return { success: false, reason: 'Phone number not provided' };
  }
  return await sendWhatsAppWebJS(phone, message);
};

// ─── Booking Templates ────────────────────────────────────────────

const sendAppointmentConfirmed = (phone, { clinicName, patientName, doctorName, date, time, token }) =>
  sendWhatsApp(phone,
`✅ *${clinicName}*

Hello ${patientName}! Your appointment is confirmed.

👨‍⚕️ Doctor: ${doctorName}
📅 Date: ${date}
⏰ Time: ${time}

Track your queue: ${process.env.FRONTEND_URL}/track/${token}

Reply CANCEL to cancel your appointment.`);

const sendAppointmentDeclined = (phone, { clinicName, patientName, reason, alternateSlot, subdomain }) =>
  sendWhatsApp(phone,
`❌ *${clinicName}*

Hello ${patientName}, your appointment request could not be confirmed.

Reason: ${reason}
${alternateSlot
  ? `\n📅 Suggested slot: *${alternateSlot}*\nBook now: ${process.env.FRONTEND_URL}/book/${subdomain}`
  : `\nPlease rebook: ${process.env.FRONTEND_URL}/book/${subdomain}`
}`);

const sendSuggestedSlot = (phone, { clinicName, patientName, altSlot, token }) =>
  sendWhatsApp(phone,
`🔄 *${clinicName}*

Hello ${patientName}! The clinic has suggested a new slot.

📅 New slot: *${altSlot}*

Accept or reschedule: ${process.env.FRONTEND_URL}/track/${token}`);

// ─── Post Visit Templates ─────────────────────────────────────────

const sendPrescription = (phone, { clinicName, patientName, doctorName, diagnosis, medicines, instructions }) =>
  sendWhatsApp(phone,
`💊 *${clinicName} — Prescription*

Patient: ${patientName}
Doctor: ${doctorName}

📋 Diagnosis: ${diagnosis}

💊 Medicines:
${medicines.map(m => `• ${m.name} — ${m.dosage} (${m.duration})`).join('\n')}

📝 Instructions: ${instructions || 'Follow up if symptoms persist'}

Keep this message for your records.`);

const sendRatingRequest = (phone, { clinicName, patientName, tenantId }) =>
  sendWhatsApp(phone,
`⭐ *${clinicName}*

Hello ${patientName}! Thank you for visiting us today.

How was your experience? Rate us here:
${process.env.FRONTEND_URL}/rate/${tenantId}

Your feedback helps us improve! 🙏`);

const sendFollowUpReminder = (phone, { clinicName, patientName, followUpDate, subdomain }) =>
  sendWhatsApp(phone,
`📅 *${clinicName} — Follow-up Reminder*

Hello ${patientName}!

Your doctor has recommended a follow-up visit on *${followUpDate}*.

Book your slot: ${process.env.FRONTEND_URL}/book/${subdomain}`);

// ─── Waitlist Templates ───────────────────────────────────────────

const sendWaitlistSlotAvailable = (phone, { clinicName, patientName, slot, subdomain }) =>
  sendWhatsApp(phone,
`🎉 *${clinicName} — Slot Available!*

Hello ${patientName}! A slot just opened up.

📅 Available: *${slot}*

Book now (15 min window):
${process.env.FRONTEND_URL}/book/${subdomain}

This offer expires in 15 minutes ⏰`);

// ─── Emergency Templates ──────────────────────────────────────────

const sendClinicClosure = (phone, { clinicName, patientName, reason, newDate }) =>
  sendWhatsApp(phone,
`⚠️ *${clinicName} — Important Update*

Hello ${patientName}, your appointment has been cancelled.

Reason: ${reason}
${newDate
  ? `\nRescheduled to: *${newDate}*`
  : `\nPlease rebook: ${process.env.FRONTEND_URL}`
}

We apologize for the inconvenience.`);

// ─── Bulk Message ─────────────────────────────────────────────────

const sendBulkMessage = async (phones, { clinicName, message }) => {
  const results = [];
  for (const phone of phones) {
    const result = await sendWhatsApp(phone,
`📢 *${clinicName}*

${message}`);
    results.push({ phone, ...result });
    // Small delay to avoid spam detection
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
};

module.exports = {
  // ✅ Keep existing export — alerts.js and reminders.js use this
  sendWhatsApp,

  // ✅ New named exports for booking features
  sendAppointmentConfirmed,
  sendAppointmentDeclined,
  sendSuggestedSlot,
  sendPrescription,
  sendRatingRequest,
  sendFollowUpReminder,
  sendWaitlistSlotAvailable,
  sendClinicClosure,
  sendBulkMessage
};



