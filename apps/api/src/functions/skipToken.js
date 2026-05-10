import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// Deployed as a Supabase Edge Function, requires 'doctor' role
export default async (req) => {
    try {
        const { bookingId } = await req.json();

        // 1. Mark current booking as skipped
        const { data: skippedBooking, error: skipError } = await supabase
            .from('bookings')
            .update({ status: 'skipped', skipped_at: new Date().toISOString() })
            .eq('id', bookingId)
            .select('doctor_id, slot_time')
            .single();

        if (skipError) throw skipError;

        // 2. Find the next patient to call
        const { data: nextPatient, error: nextPatientError } = await supabase
            .from('bookings')
            .select('id')
            .eq('doctor_id', skippedBooking.doctor_id)
            .eq('status', 'checked_in')
            .gt('slot_time', skippedBooking.slot_time) // Ensure we only look forward
            .order('slot_time', { ascending: true })
            .limit(1)
            .single();

        if (nextPatientError && nextPatientError.code !== 'PGRST116') throw nextPatientError;

        // 3. Call the next patient
        if (nextPatient) {
            await supabase
                .from('bookings')
                .update({ status: 'called', called_at: new Date().toISOString() })
                .eq('id', nextPatient.id);
        }

        // 4. Send WhatsApp notifications
        // sendNotification(skippedBooking.patient_phone, 'skipped_template', { ... });
        // if (nextPatient) sendNotification(nextPatient.patient_phone, 'called_template', { ... });

        return new Response(JSON.stringify({ success: true, calledNext: nextPatient?.id || null }), { status: 200 });

    } catch (error) {
        logger.error('Error in skipToken function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to skip token.' }), { status: 500 });
    }
};
