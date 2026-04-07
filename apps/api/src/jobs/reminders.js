const supabase = require('../models/supabase');
const { sendPushByPhone, sendPushToUser } = require('../services/push');

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

  reminderQueue.on('error', (err) => {
    const message = err?.message || String(err) || 'Unknown Redis/Bull error';
    redisErrorCount += 1;

    if (redisErrorCount === 1 || message !== lastRedisErrorMessage) {
      console.warn('⚠️ Redis/Bull queue error:', message);
      lastRedisErrorMessage = message;
    }

    if (redisErrorCount >= 3 && queueAvailable) {
      queueAvailable = false;
      console.warn('⚠️ Reminder queue disabled after repeated Redis errors. Background reminders are paused.');
    }
  });

  reminderQueue.on('ready', () => {
    queueAvailable = true;
    redisErrorCount = 0;
    lastRedisErrorMessage = '';
    console.log('✅ Reminder queue ready');
  });

  reminderQueue.process(async (job) => {
    const { type } = job.data;

    try {
      if (type === 'send_push') {
        const { phone, message, userId, title, body, data } = job.data;

        // Always try both: Firebase push (to userId's tokens) and WhatsApp (to phone).
        // This ensures anonymous/new patients get notified even without registered push tokens.
        let results = { push: null, sms: null };

        if (userId) {
          try {
            results.push = await sendPushToUser(userId, { title, body, message, data });
          } catch (pushErr) {
            console.error('Push to userId failed:', pushErr.message);
          }
        }

        if (phone && (message || title || body)) {
          try {
            results.sms = await sendPushByPhone(phone, { title, body, message, data });
          } catch (phoneErr) {
            console.error('Push by phone failed:', phoneErr.message);
          }
        }

        const anySuccess = (results.push?.success || results.push?.successCount > 0) ||
                          (results.sms?.success || results.sms?.successCount > 0);

        if (!anySuccess && !phone && !userId) {
          console.warn('⚠️ Push job missing recipient or content');
        }

        return;
      }

      if (type === 'rating_request') {
        const { queueEntryId } = job.data;
        const { data: entry } = await supabase
          .from('queue_entries')
          .select(`
            id,
            patient_id,
            patient:users!queue_entries_patient_id_fkey(name, phone),
            tenant:tenants(id, name)
          `)
          .eq('id', queueEntryId)
          .single();

        if (!entry?.patient_id) return;

        const rateUrl = `${process.env.FRONTEND_URL}/rate/${entry.tenant?.id}?clinic=${encodeURIComponent(entry.tenant?.name || 'Clinic')}`;
        await sendPushToUser(entry.patient_id, {
          title: `${entry.tenant?.name || 'Clinic'} Feedback`,
          body: `Hi ${entry.patient?.name || 'there'}, please rate your visit in 30 seconds.`,
          data: { type: 'rating_request', link: rateUrl }
        });

        console.log(`✅ Sent rating request push for queue entry ${queueEntryId}`);
        return;
      }

      const { appointmentId } = job.data;
      if (!appointmentId) return;

      const { data: appt } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, slot_time, status, patient_id,
          users!patient_id(name, phone),
          doctors:users!doctor_id(name),
          tenants(name, address)
        `)
        .eq('id', appointmentId)
        .single();

      if (!appt) return;
      if (appt.status === 'cancelled') return;
      if (!appt.patient_id) return;

      const doctorName = appt.doctors?.name || 'your doctor';
      const clinicName = appt.tenants?.name || 'your clinic';
      const time = appt.slot_time?.slice(0, 5) || '';
      const date = new Date(appt.appointment_date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      if (type === '1day') {
        await sendPushToUser(appt.patient_id, {
          title: 'Appointment Reminder: Tomorrow',
          body: `${clinicName} • ${doctorName} • ${time}`,
          data: { type: 'appointment_1day', appointmentId, link: `${process.env.FRONTEND_URL}/patient/dashboard` }
        });

        await supabase
          .from('appointments')
          .update({ reminder_sent_1day: true })
          .eq('id', appointmentId);
      }

      if (type === '1hour') {
        await sendPushToUser(appt.patient_id, {
          title: 'Appointment in 1 hour',
          body: `${clinicName} • ${doctorName} • ${time}`,
          data: { type: 'appointment_1hour', appointmentId, link: `${process.env.FRONTEND_URL}/patient/dashboard` }
        });

        await supabase
          .from('appointments')
          .update({ reminder_sent_1hour: true })
          .eq('id', appointmentId);
      }

      if (type === '15min') {
        await sendPushToUser(appt.patient_id, {
          title: 'Appointment in 15 minutes',
          body: `${clinicName} • ${doctorName} • ${date}`,
          data: { type: 'appointment_15min', appointmentId, link: `${process.env.FRONTEND_URL}/patient/dashboard` }
        });
      }
    } catch (err) {
      console.error(`Reminder job error (${type}):`, err.message);
    }
  });

  reminderQueue.on('completed', (job) => {
    console.log(`✅ Reminder job completed: ${job.data.type}`);
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

const scheduleReminders = async (appointment) => {
  if (!reminderQueue || !queueAvailable) {
    console.log('⚠️ Skipping reminders — Redis not available');
    return;
  }

  try {
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.slot_time}`);
    const now = new Date();

    const oneDayBefore = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      await reminderQueue.add(
        { type: '1day', appointmentId: appointment.id },
        { delay: oneDayBefore.getTime() - now.getTime(), jobId: `1day_${appointment.id}` }
      );
    }

    const oneHourBefore = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > now) {
      await reminderQueue.add(
        { type: '1hour', appointmentId: appointment.id },
        { delay: oneHourBefore.getTime() - now.getTime(), jobId: `1hour_${appointment.id}` }
      );
    }

    const fifteenMinBefore = new Date(appointmentDateTime.getTime() - 15 * 60 * 1000);
    if (fifteenMinBefore > now) {
      await reminderQueue.add(
        { type: '15min', appointmentId: appointment.id },
        { delay: fifteenMinBefore.getTime() - now.getTime(), jobId: `15min_${appointment.id}` }
      );
    }
  } catch (err) {
    console.error('Schedule reminders error:', err.message);
  }
};

const cancelReminders = async (appointmentId) => {
  if (!reminderQueue || !queueAvailable) return;

  try {
    const job1day = await reminderQueue.getJob(`1day_${appointmentId}`);
    const job1hour = await reminderQueue.getJob(`1hour_${appointmentId}`);
    const job15min = await reminderQueue.getJob(`15min_${appointmentId}`);

    if (job1day) await job1day.remove();
    if (job1hour) await job1hour.remove();
    if (job15min) await job15min.remove();
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
  } catch (err) {
    console.error('Schedule rating request error:', err.message);
  }
};

const queueNotificationSend = async ({ phone, userId, title, body, message, data = {} }) => {
  if (!reminderQueue || !queueAvailable) {
    if (userId) {
      return sendPushToUser(userId, { title, body, message, data });
    }
    return sendPushByPhone(phone, { title, body, message, data });
  }

  try {
    await reminderQueue.add(
      { type: 'send_push', phone, userId, title, body, message, data },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 3000 },
        removeOnComplete: true
      }
    );
    return { success: true, mode: 'queued' };
  } catch (err) {
    console.error('Queue push error:', err.message);
    if (userId) {
      return sendPushToUser(userId, { title, body, message, data });
    }
    return sendPushByPhone(phone, { title, body, message, data });
  }
};

const startDailyCheck = () => {
  const checkAndSchedule = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, patient_id, users!patient_id(name), doctors:users!doctor_id(name), tenants(name), slot_time')
        .eq('appointment_date', tomorrowStr)
        .eq('status', 'confirmed')
        .eq('reminder_sent_1day', false);

      for (const appt of (appointments || [])) {
        if (!appt.patient_id) continue;

        await sendPushToUser(appt.patient_id, {
          title: 'Appointment Reminder: Tomorrow',
          body: `${appt.tenants?.name || 'Clinic'} • ${appt.slot_time?.slice(0, 5) || ''}`,
          data: { type: 'daily_1day', appointmentId: appt.id, link: `${process.env.FRONTEND_URL}/patient/dashboard` }
        });

        await supabase
          .from('appointments')
          .update({ reminder_sent_1day: true })
          .eq('id', appt.id);
      }

      if (appointments?.length > 0) {
        console.log(`✅ Sent ${appointments.length} daily push reminders`);
      }
    } catch (err) {
      console.error('Daily check error:', err.message);
    }
  };

  checkAndSchedule();
  setInterval(checkAndSchedule, 24 * 60 * 60 * 1000);
};

module.exports = {
  reminderQueue,
  queueAvailable,
  scheduleReminders,
  cancelReminders,
  scheduleRatingRequest,
  queueNotificationSend,
  startDailyCheck
};
