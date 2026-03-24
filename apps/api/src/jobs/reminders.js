const supabase = require('../models/supabase');
const { sendWhatsApp } = require('../services/whatsapp');

// ─── Try to create reminder queue (requires Redis) ───
let reminderQueue = null;
let queueAvailable = false;
let redisErrorCount = 0;
let lastRedisErrorMessage = '';

try {
  const Bull = require('bull');
  reminderQueue = new Bull('reminders', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 3
    }
  });

  // Test connection
  reminderQueue.on('error', (err) => {
    const message = err?.message || String(err) || 'Unknown Redis/Bull error';

    redisErrorCount += 1;

    // On first error or new error type, print it
    if (redisErrorCount === 1 || message !== lastRedisErrorMessage) {
      console.warn('⚠️ Redis/Bull queue error:', message);
      lastRedisErrorMessage = message;
    }

    // After 3 consecutive errors, disable queue and suppress further prints
    if (redisErrorCount >= 3 && queueAvailable) {
      queueAvailable = false;
      console.warn('⚠️ Reminder queue disabled after repeated Redis errors. Background reminders are paused.');
    }

    // Suppress printing if queue is already disabled
    if (!queueAvailable && redisErrorCount > 3) {
      return; // Silent suppression
    }
  });

  reminderQueue.on('ready', () => {
    queueAvailable = true;
    redisErrorCount = 0;
    lastRedisErrorMessage = '';
    console.log('✅ Reminder queue ready');
  });

  // ─── Process reminder jobs ────────────────────────────
  reminderQueue.process(async (job) => {
    const { type } = job.data;

    try {
      // Generic WhatsApp send (non-blocking queue job)
      if (type === 'send_whatsapp') {
        const { phone, message } = job.data;
        if (!phone || !message) {
          console.warn('⚠️ WhatsApp job missing phone or message');
          return;
        }
        await sendWhatsApp(phone, message);
        console.log(`✅ Queued WhatsApp sent to ${phone}`);
        return;
      }

      if (type === 'rating_request') {
        const { queueEntryId } = job.data;
        const { data: entry } = await supabase
          .from('queue_entries')
          .select(`
            id,
            patient:users!queue_entries_patient_id_fkey(name, phone),
            tenant:tenants(id, name)
          `)
          .eq('id', queueEntryId)
          .single();

        if (!entry?.patient?.phone) return;

        const rateUrl = `${process.env.FRONTEND_URL}/rate/${entry.tenant?.id}?clinic=${encodeURIComponent(entry.tenant?.name || 'Clinic')}`;
        await sendWhatsApp(
          entry.patient.phone,
          `⭐ *How was your visit?*\n\n` +
          `Hi ${entry.patient.name}! We hope your visit to *${entry.tenant?.name}* went well.\n\n` +
          `Rate your experience (30 seconds):\n${rateUrl}`
        );

        console.log(`✅ Sent rating request to ${entry.patient.phone}`);
        return;
      }

      // Appointment reminders (1day, 1hour, 15min)
      const { appointmentId } = job.data;
      if (!appointmentId) return;
      const { data: appt } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, slot_time, status,
          users!patient_id(name, phone),
          doctors:users!doctor_id(name),
          tenants(name, address)
        `)
        .eq('id', appointmentId)
        .single();

      if (!appt) return console.log(`Appointment ${appointmentId} not found`);
      if (appt.status === 'cancelled') return console.log(`Appointment ${appointmentId} cancelled, skipping reminder`);

      const phone = appt.users?.phone;
      const name = appt.users?.name;
      const doctorName = appt.doctors?.name;
      const clinicName = appt.tenants?.name;
      const address = appt.tenants?.address;
      const time = appt.slot_time?.slice(0, 5);
      const date = new Date(appt.appointment_date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      if (!phone) return;

      // Send different message based on type
      if (type === '1day') {
        await sendWhatsApp(
          phone,
          `📅 *Appointment Reminder — Tomorrow!*\n\n` +
          `Hi ${name}! Your appointment is *tomorrow*.\n\n` +
          `🏥 ${clinicName}\n` +
          `👨‍⚕️ ${doctorName}\n` +
          `⏰ ${time}\n` +
          `📍 ${address}\n\n` +
          `Please arrive 5 minutes early. See you tomorrow! 🦷`
        );

        await supabase
          .from('appointments')
          .update({ reminder_sent_1day: true })
          .eq('id', appointmentId);

        console.log(`✅ Sent 1-day reminder to ${phone}`);
      }

      else if (type === '1hour') {
        await sendWhatsApp(
          phone,
          `⏰ *1 Hour to Go!*\n\n` +
          `Hi ${name}! Your appointment is in *1 hour*.\n\n` +
          `🏥 ${clinicName}\n` +
          `👨‍⚕️ ${doctorName}\n` +
          `⏰ ${time} today\n` +
          `📍 ${address}\n\n` +
          `Start heading to the clinic now. Don't be late! 🏃`
        );

        await supabase
          .from('appointments')
          .update({ reminder_sent_1hour: true })
          .eq('id', appointmentId);

        console.log(`✅ Sent 1-hour reminder to ${phone}`);
      }

      else if (type === '15min') {
        await sendWhatsApp(
          phone,
          `🔔 *Almost Time!*\n\n` +
          `Hi ${name}! Your appointment with ${doctorName} is in *15 minutes*.\n\n` +
          `Please make sure you're at ${clinicName} now.\n` +
          `📍 ${address}\n\n` +
          `See you soon! 🦷`
        );

        console.log(`✅ Sent 15-min reminder to ${phone}`);
      }

    } catch (err) {
      console.error(`Reminder job error (${type}):`, err.message);
    }
  });

  // ─── Log job events ───────────────────────────────────
  reminderQueue.on('completed', (job) => {
    console.log(`✅ Reminder job completed: ${job.data.type} for ${job.data.appointmentId}`);
  });

  reminderQueue.on('failed', (job, err) => {
    console.error(`❌ Reminder job failed: ${job.data.type}`, err.message);
  });

  console.log('✅ Reminder queue connected to Redis');
  queueAvailable = true;

} catch (err) {
  console.warn('⚠️ Redis not available — reminders will be skipped:', err.message);
  reminderQueue = null;
  queueAvailable = false;
}

// ─── Schedule reminders when appointment is booked ───
const scheduleReminders = async (appointment) => {
  if (!reminderQueue || !queueAvailable) {
    console.log('⚠️ Skipping reminders — Redis not available');
    return;
  }

  try {
    const appointmentDateTime = new Date(
      `${appointment.appointment_date}T${appointment.slot_time}`
    );

    const now = new Date();

    // 1 day before reminder
    const oneDayBefore = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      await reminderQueue.add(
        { type: '1day', appointmentId: appointment.id },
        { delay: oneDayBefore.getTime() - now.getTime(), jobId: `1day_${appointment.id}` }
      );
      console.log(`✅ Scheduled 1-day reminder for appointment ${appointment.id}`);
    }

    // 1 hour before reminder
    const oneHourBefore = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > now) {
      await reminderQueue.add(
        { type: '1hour', appointmentId: appointment.id },
        { delay: oneHourBefore.getTime() - now.getTime(), jobId: `1hour_${appointment.id}` }
      );
      console.log(`✅ Scheduled 1-hour reminder for appointment ${appointment.id}`);
    }

    // 15 min before reminder
    const fifteenMinBefore = new Date(appointmentDateTime.getTime() - 15 * 60 * 1000);
    if (fifteenMinBefore > now) {
      await reminderQueue.add(
        { type: '15min', appointmentId: appointment.id },
        { delay: fifteenMinBefore.getTime() - now.getTime(), jobId: `15min_${appointment.id}` }
      );
      console.log(`✅ Scheduled 15-min reminder for appointment ${appointment.id}`);
    }

  } catch (err) {
    console.error('Schedule reminders error:', err.message);
  }
};

// ─── Cancel reminders when appointment is cancelled ──
const cancelReminders = async (appointmentId) => {
  if (!reminderQueue || !queueAvailable) return;

  try {
    const job1day = await reminderQueue.getJob(`1day_${appointmentId}`);
    const job1hour = await reminderQueue.getJob(`1hour_${appointmentId}`);
    const job15min = await reminderQueue.getJob(`15min_${appointmentId}`);

    if (job1day) await job1day.remove();
    if (job1hour) await job1hour.remove();
    if (job15min) await job15min.remove();

    console.log(`✅ Cancelled reminders for appointment ${appointmentId}`);
  } catch (err) {
    console.error('Cancel reminders error:', err.message);
  }
};

const scheduleRatingRequest = async (queueEntryId, delayMs = 5 * 60 * 1000) => {
  if (!reminderQueue || !queueAvailable) {
    console.log('⚠️ Skipping rating request schedule — Redis not available');
    return;
  }

  try {
    await reminderQueue.add(
      { type: 'rating_request', queueEntryId },
      {
        delay: Math.max(delayMs, 0),
        jobId: `rating_${queueEntryId}`,
        removeOnComplete: true,
        attempts: 3
      }
    );
    console.log(`✅ Scheduled rating request for queue entry ${queueEntryId}`);
  } catch (err) {
    console.error('Schedule rating request error:', err.message);
  }
};

// ─── Queue WhatsApp sends for non-blocking HTTP responses ────
const queueWhatsAppSend = async (phone, message) => {
  if (!reminderQueue || !queueAvailable) {
    // Fallback: send synchronously if queue unavailable
    try {
      await sendWhatsApp(phone, message);
      console.log(`⚠️ WhatsApp (fallback sync) sent to ${phone}`);
      return { success: true, mode: 'sync-fallback' };
    } catch (err) {
      console.error('WhatsApp sync send failed:', err.message);
      return { success: false, mode: 'sync-fallback', error: err.message };
    }
  }

  try {
    await reminderQueue.add(
      { type: 'send_whatsapp', phone, message },
      { 
        attempts: 2,
        backoff: { type: 'fixed', delay: 3000 },
        removeOnComplete: true 
      }
    );
    console.log(`✅ Queued WhatsApp to ${phone}`);
    return { success: true, mode: 'queued' };
  } catch (err) {
    console.error('Queue WhatsApp error:', err.message);
    // Still try to send synchronously as fallback
    try {
      await sendWhatsApp(phone, message);
      console.log(`⚠️ WhatsApp (fallback sync) sent to ${phone}`);
      return { success: true, mode: 'sync-fallback' };
    } catch (fallbackErr) {
      console.error('WhatsApp fallback send failed:', fallbackErr.message);
      return { success: false, mode: 'sync-fallback', error: fallbackErr.message };
    }
  }
};

// ─── Daily check — send reminders for missed schedules ─
const startDailyCheck = () => {
  const checkAndSchedule = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Get all confirmed appointments for tomorrow that haven't got 1-day reminder
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*, users!patient_id(name, phone), doctors:users!doctor_id(name), tenants(name)')
        .eq('appointment_date', tomorrowStr)
        .eq('status', 'confirmed')
        .eq('reminder_sent_1day', false);

      for (const appt of (appointments || [])) {
        if (appt.users?.phone) {
          const time = appt.slot_time?.slice(0, 5);
          await sendWhatsApp(
            appt.users.phone,
            `📅 *Appointment Tomorrow!*\n\n` +
            `Hi ${appt.users.name}! Reminder: You have an appointment tomorrow.\n\n` +
            `🏥 ${appt.tenants?.name}\n` +
            `👨‍⚕️ ${appt.doctors?.name}\n` +
            `⏰ ${time}\n\n` +
            `See you tomorrow! 🦷`
          );

          await supabase
            .from('appointments')
            .update({ reminder_sent_1day: true })
            .eq('id', appt.id);
        }
      }

      if (appointments?.length > 0) {
        console.log(`✅ Sent ${appointments.length} daily reminders`);
      }
    } catch (err) {
      console.error('Daily check error:', err.message);
    }
  };

  // Run immediately on startup
  checkAndSchedule();

  // Then run every 24 hours
  setInterval(checkAndSchedule, 24 * 60 * 60 * 1000);
};

module.exports = { reminderQueue, queueAvailable, scheduleReminders, cancelReminders, scheduleRatingRequest, queueWhatsAppSend, startDailyCheck };
