import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// Deployed as a Supabase Edge Function with a cron trigger (e.g., every 5 minutes)
// npx supabase functions deploy processNoShows --schedule "*/5 * * * *"
export default async () => {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: noShowBookings, error: fetchError } = await supabase
            .from('bookings')
            .select('id, patient_phone')
            .eq('status', 'scheduled')
            .is('checked_in_at', null)
            .lt('slot_time', thirtyMinutesAgo);

        if (fetchError) throw fetchError;

        if (noShowBookings.length === 0) {
            logger.info('processNoShows: No bookings to mark as no-show.');
            return new Response(JSON.stringify({ message: 'No bookings to process.' }), { status: 200 });
        }

        const updates = noShowBookings.map(booking => ({
            id: booking.id,
            status: 'no_show',
            no_show_at: new Date().toISOString(),
        }));

        const { error: updateError } = await supabase.from('bookings').upsert(updates);

        if (updateError) throw updateError;

        // Send WhatsApp notifications
        for (const booking of noShowBookings) {
            // sendNotification(booking.patient_phone, 'no_show_template', { ... });
        }

        logger.info(`processNoShows: Marked ${noShowBookings.length} bookings as no-show.`);
        return new Response(JSON.stringify({ success: true, count: noShowBookings.length }), { status: 200 });

    } catch (error) {
        logger.error('Error in processNoShows cron function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to process no-shows.' }), { status: 500 });
    }
};
