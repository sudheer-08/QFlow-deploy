const supabase = require('../models/supabase');
const { queueNotificationSend } = require('./reminders');
const { getLocalDateString } = require('../utils/date');

const startNoShowChecker = () => {
  const check = async () => {
    try {
      const now = new Date();
      const today = getLocalDateString(now);

      // Find confirmed appointments where slot passed 10+ min, not checked in
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, slot_time, tenant_id, doctor_id,
          patient:users!appointments_patient_id_fkey(name, phone),
          tenant:tenants(name, subdomain)
        `)
        .eq('appointment_date', today)
        .eq('status', 'confirmed');

      for (const appt of (appointments || [])) {
        const slotDateTime = new Date(`${appt.appointment_date}T${appt.slot_time}`);
        const minutesPast = (now - slotDateTime) / 60000;

        if (minutesPast >= 10) {
          await supabase
            .from('appointments')
            .update({ status: 'no_show' })
            .eq('id', appt.id);

          console.log(`⚠️ Auto no-show: ${appt.patient?.name} at ${appt.slot_time}`);

          if (appt.patient?.phone) {
            queueNotificationSend({
              phone: appt.patient.phone,
              message:
`⏰ *${appt.tenant?.name}*

Hello ${appt.patient?.name}, we noticed you missed your appointment at ${appt.slot_time?.slice(0, 5)}.

To rebook: ${process.env.FRONTEND_URL}/book/${appt.tenant?.subdomain}

We hope you are okay! 🙏`
            }).catch((err) => {
              console.error('Error queueing no-show notification:', err.message);
            });
          }
        }
      }

    } catch (err) {
      console.error('No-show checker error:', err.message);
    }
  };

  check();
  setInterval(check, 5 * 60 * 1000);
  console.log('✅ No-show checker started (runs every 5 min)');
};

module.exports = { startNoShowChecker };