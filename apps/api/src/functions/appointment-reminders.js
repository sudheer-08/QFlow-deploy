import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';
import { sendNotification } from '../services/notifications.js'; // Placeholder

// Deployed as a Supabase Edge Function with a cron trigger
// e.g., every 15 minutes: npx supabase functions deploy appointment-reminders --schedule "*/15 * * * *"
export default async () => {
    try {
        const now = new Date();
        
        // --- 24-Hour Reminders ---
        const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twentyFourHoursWindow = new Date(now.getTime() + (24 * 60 + 15) * 60 * 1000); // includes 15min buffer

        const { data: dayBeforeBookings, error: dayBeforeError } = await supabase
            .from('bookings')
            .select('id, patient_phone, patient_name, slot_time, doctors(name)')
            .in('status', ['scheduled', 'confirmed'])
            .is('reminder_24h_sent_at', null)
            .gte('slot_time', twentyFourHoursLater.toISOString())
            .lte('slot_time', twentyFourHoursWindow.toISOString());

        if (dayBeforeError) throw dayBeforeError;

        for (const booking of dayBeforeBookings) {
            await sendNotification(booking.patient_phone, 'appointment_reminder_24h', {
                patientName: booking.patient_name,
                doctorName: booking.doctors.name,
                time: new Date(booking.slot_time).toLocaleTimeString('en-IN'),
            });
            await supabase.from('bookings').update({ reminder_24h_sent_at: now.toISOString() }).eq('id', booking.id);
        }
        logger.info(`Sent ${dayBeforeBookings.length} 24-hour reminders.`);

        // --- 1-Hour Reminders ---
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const oneHourWindow = new Date(now.getTime() + (60 + 15) * 60 * 1000);

        const { data: hourBeforeBookings, error: hourBeforeError } = await supabase
            .from('bookings')
            .select('id, patient_phone, patient_name, slot_time, doctors(name)')
            .in('status', ['scheduled', 'confirmed'])
            .is('reminder_1h_sent_at', null)
            .gte('slot_time', oneHourLater.toISOString())
            .lte('slot_time', oneHourWindow.toISOString());

        if (hourBeforeError) throw hourBeforeError;

        for (const booking of hourBeforeBookings) {
            await sendNotification(booking.patient_phone, 'appointment_reminder_1h', {
                patientName: booking.patient_name,
            });
            await supabase.from('bookings').update({ reminder_1h_sent_at: now.toISOString() }).eq('id', booking.id);
        }
        logger.info(`Sent ${hourBeforeBookings.length} 1-hour reminders.`);

        return new Response(JSON.stringify({ success: true, reminders_24h: dayBeforeBookings.length, reminders_1h: hourBeforeBookings.length }), { status: 200 });

    } catch (error) {
        logger.error('Error in appointment-reminders function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to send reminders.' }), { status: 500 });
    }
};
