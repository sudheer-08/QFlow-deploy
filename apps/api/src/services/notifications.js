const { queueNotificationSend } = require('../jobs/reminders');

const sendNotification = async (phone, message) => {
  if (!phone) {
    return { success: false, reason: 'Phone number not provided' };
  }
  return queueNotificationSend({ phone, message });
};

const sendAppointmentConfirmed = (phone, { clinicName, patientName, doctorName, date, time, token }) =>
  sendNotification(
    phone,
`✅ *${clinicName}*

Hello ${patientName}! Your appointment is confirmed.

👨‍⚕️ Doctor: ${doctorName}
📅 Date: ${date}
⏰ Time: ${time}

Track your appointment: ${process.env.FRONTEND_URL}/track/${token}
`
  );

const sendAppointmentDeclined = (phone, { clinicName, patientName, reason, alternateSlot, subdomain }) =>
  sendNotification(
    phone,
`❌ *${clinicName}*

Hello ${patientName}, your appointment request could not be confirmed.

Reason: ${reason}
${alternateSlot ? `\n📅 Suggested slot: *${alternateSlot}*\nBook now: ${process.env.FRONTEND_URL}/book/${subdomain}` : `\nPlease rebook: ${process.env.FRONTEND_URL}/book/${subdomain}`}
`
  );

const sendSuggestedSlot = (phone, { clinicName, patientName, altSlot, token }) =>
  sendNotification(
    phone,
`🔄 *${clinicName}*

Hello ${patientName}! The clinic has suggested a new slot.

📅 New slot: *${altSlot}*

Accept or reschedule: ${process.env.FRONTEND_URL}/track/${token}`
  );

const sendPrescription = (phone, { clinicName, patientName, doctorName, diagnosis, medicines, instructions }) =>
  sendNotification(
    phone,
`💊 *${clinicName} — Prescription*

Patient: ${patientName}
Doctor: ${doctorName}

📋 Diagnosis: ${diagnosis}

💊 Medicines:
${medicines.map(m => `• ${m.name} — ${m.dosage} (${m.duration})`).join('\n')}

📝 Instructions: ${instructions || 'Follow up if symptoms persist'}

Keep this message for your records.`
  );

const sendRatingRequest = (phone, { clinicName, patientName, tenantId }) =>
  sendNotification(
    phone,
`⭐ *${clinicName}*

Hello ${patientName}! Thank you for visiting us today.

How was your experience? Rate us here:
${process.env.FRONTEND_URL}/rate/${tenantId}

Your feedback helps us improve! 🙏`
  );

const sendFollowUpReminder = (phone, { clinicName, patientName, followUpDate, subdomain }) =>
  sendNotification(
    phone,
`📅 *${clinicName} — Follow-up Reminder*

Hello ${patientName}!

Your doctor has recommended a follow-up visit on *${followUpDate}*.

Book your slot: ${process.env.FRONTEND_URL}/book/${subdomain}`
  );

const sendWaitlistSlotAvailable = (phone, { clinicName, patientName, slot, subdomain }) =>
  sendNotification(
    phone,
`🎉 *${clinicName} — Slot Available!*

Hello ${patientName}! A slot just opened up.

📅 Available: *${slot}*

Book now (15 min window):
${process.env.FRONTEND_URL}/book/${subdomain}

This offer expires in 15 minutes ⏰`
  );

const sendClinicClosure = (phone, { clinicName, patientName, reason, newDate }) =>
  sendNotification(
    phone,
`⚠️ *${clinicName} — Important Update*

Hello ${patientName}, your appointment has been cancelled.

Reason: ${reason}
${newDate ? `\nRescheduled to: *${newDate}*` : `\nPlease rebook: ${process.env.FRONTEND_URL}`}

We apologize for the inconvenience.`
  );

const sendBulkMessage = async (phones, { clinicName, message }) => {
  const results = [];
  for (const phone of phones) {
    const result = await sendNotification(
      phone,
`📢 *${clinicName}*

${message}`
    );
    results.push({ phone, ...result });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return results;
};

module.exports = {
  sendNotification,
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
