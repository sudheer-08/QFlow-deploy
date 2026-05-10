import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// Deployed as a Supabase Edge Function, requires 'staff' role or higher
export default async (req) => {
    try {
        const { bookingId } = await req.json();

        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('status, doctor_id, slot_time')
            .eq('id', bookingId)
            .single();

        if (fetchError || !booking) {
            return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
        }

        if (!['skipped', 'no_show'].includes(booking.status)) {
            return new Response(JSON.stringify({ error: 'Can only rejoin a skipped or no-show booking.' }), { status: 400 });
        }

        // Find the last position in the queue
        const { data: lastBooking, error: lastBookingError } = await supabase
            .from('bookings')
            .select('queue_position')
            .eq('doctor_id', booking.doctor_id)
            .gte('slot_time', new Date().toISOString().split('T')[0]) // Today
            .order('queue_position', { ascending: false })
            .limit(1)
            .single();

        if (lastBookingError && lastBookingError.code !== 'PGRST116') throw lastBookingError;

        const newPosition = (lastBooking?.queue_position || 0) + 1;

        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                status: 'checked_in',
                queue_position: newPosition,
                skipped_at: null, // Clear skip time
                no_show_at: null, // Clear no-show time
            })
            .eq('id', bookingId);

        if (updateError) throw updateError;

        // Send WhatsApp notification
        // sendNotification(booking.patient_phone, 'rejoin_template', { ... });

        return new Response(JSON.stringify({ success: true, newPosition }), { status: 200 });

    } catch (error) {
        logger.error('Error in rejoinQueue function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to rejoin queue.' }), { status: 500 });
    }
};
