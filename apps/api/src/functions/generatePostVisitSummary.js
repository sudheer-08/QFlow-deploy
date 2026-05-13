import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';
import { getCompletion } from '../services/ai.js';

// Deployed as a Supabase Edge Function.
// Triggered by a webhook on INSERT into the 'consultations' table.
export default async (req) => {
    try {
        const { record: consultation } = await req.json();

        if (!consultation) {
            return new Response(JSON.stringify({ error: 'No consultation record provided.' }), { status: 400 });
        }

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('intake_form_data')
            .eq('id', consultation.booking_id)
            .single();

        if (bookingError) throw bookingError;

        const prompt = `
            Generate a concise post-visit summary for a patient based on the following details.
            The summary should be easy for a patient to understand.
            Structure the output as a JSON object with keys: "diagnosis", "medicines_prescribed", "lifestyle_advice", "follow_up_instructions".

            - Chief Complaint & Vitals (from intake form): ${JSON.stringify(booking.intake_form_data)}
            - Doctor's Diagnosis: ${consultation.diagnosis}
            - Medicines Prescribed: ${consultation.medicines}
            - Doctor's Notes: ${consultation.notes}
            - Follow-up Date: ${consultation.follow_up_date}
        `;

        const aiSummary = await getCompletion(prompt);
        const summaryJson = JSON.parse(aiSummary);

        const summaryData = {
            booking_id: consultation.booking_id,
            doctor_id: consultation.doctor_id,
            patient_id: consultation.patient_id,
            diagnosis: summaryJson.diagnosis,
            medicines_prescribed: summaryJson.medicines_prescribed,
            lifestyle_advice: summaryJson.lifestyle_advice,
            follow_up_instructions: summaryJson.follow_up_instructions,
            raw_consultation_data: consultation,
        };

        const { error: insertError } = await supabase
            .from('post_visit_summaries')
            .insert(summaryData);

        if (insertError) throw insertError;

        // Optionally, send a notification to the patient
        // sendNotification(patient.phone, 'post_visit_summary_ready', { bookingId: consultation.booking_id });

        logger.info(`Generated post-visit summary for booking ${consultation.booking_id}`);
        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        logger.error('Error in generatePostVisitSummary function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to generate summary.' }), { status: 500 });
    }
};
