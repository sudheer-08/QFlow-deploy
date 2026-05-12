import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// Deployed as a Supabase Edge Function: checkin-patient-qr
export default async (req) => {
    try {
        const { doctorId, clinicSubdomain, patientDetails } = await req.json();

        if (!doctorId || !clinicSubdomain || !patientDetails.phone) {
            return new Response(JSON.stringify({ error: 'Missing required parameters.' }), { status: 400 });
        }

        // 1. Find the clinic and doctor
        const { data: doctor, error: doctorError } = await supabase
            .from('doctors')
            .select('id, clinic_id')
            .eq('id', doctorId)
            .single();

        if (doctorError || !doctor) {
            return new Response(JSON.stringify({ error: 'Doctor not found.' }), { status: 404 });
        }

        // 2. Find the patient's booking for today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, status, token_number')
            .eq('doctor_id', doctorId)
            .eq('patient_phone', patientDetails.phone)
            .gte('slot_time', todayStart.toISOString())
            .lte('slot_time', todayEnd.toISOString())
            .in('status', ['scheduled', 'confirmed'])
            .order('slot_time', { ascending: true })
            .limit(1)
            .single();

        if (bookingError || !booking) {
            return new Response(JSON.stringify({ error: 'No scheduled appointment found for this phone number today.' }), { status: 404 });
        }

        // 3. Update booking status to 'checked_in'
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({
                status: 'checked_in',
                checked_in_at: new Date().toISOString(),
                check_in_method: 'qr_scan'
            })
            .eq('id', booking.id)
            .select('id, token_number')
            .single();

        if (updateError) throw updateError;

        return new Response(JSON.stringify({
            success: true,
            bookingId: updatedBooking.id,
            token_number: updatedBooking.token_number
        }), { status: 200 });

    } catch (error) {
        logger.error('Error in checkin-patient-qr function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to process check-in.' }), { status: 500 });
    }
};
