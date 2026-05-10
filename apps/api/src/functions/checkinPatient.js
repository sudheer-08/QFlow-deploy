import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// Deployed as a Supabase Edge Function
export default async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    }

    try {
        const { bookingId } = await req.json();
        if (!bookingId) {
            return new Response(JSON.stringify({ error: 'bookingId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('status')
            .eq('id', bookingId)
            .single();

        if (fetchError || !booking) {
            return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        if (booking.status !== 'scheduled') {
            return new Response(JSON.stringify({ error: `Cannot check in booking with status: ${booking.status}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
            .eq('id', bookingId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Here you would trigger a WhatsApp notification
        // sendNotification(updatedBooking.patient_phone, 'checked_in_template', { ... });

        return new Response(JSON.stringify(updatedBooking), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        logger.error('Error in checkinPatient function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to check in patient.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
