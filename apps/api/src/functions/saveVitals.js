import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

const ABNORMAL_THRESHOLDS = {
    bp_systolic: { high: 140, low: 90 },
    bp_diastolic: { high: 90, low: 60 },
    temperature_c: { high: 38.0 },
    spo2_percent: { low: 95 },
    pulse_bpm: { high: 100, low: 60 },
};

function getVitalsFlags(vitals) {
    const flags = [];
    if (vitals.bp_systolic > ABNORMAL_THRESHOLDS.bp_systolic.high) flags.push('bp_high');
    if (vitals.bp_systolic < ABNORMAL_THRESHOLDS.bp_systolic.low) flags.push('bp_low');
    if (vitals.bp_diastolic > ABNORMAL_THRESHOLDS.bp_diastolic.high) flags.push('bp_diastolic_high');
    if (vitals.bp_diastolic < ABNORMAL_THRESHOLDS.bp_diastolic.low) flags.push('bp_diastolic_low');
    if (vitals.temperature_c > ABNORMAL_THRESHOLDS.temperature_c.high) flags.push('fever');
    if (vitals.spo2_percent < ABNORMAL_THRESHOLDS.spo2_percent.low) flags.push('low_spo2');
    if (vitals.pulse_bpm > ABNORMAL_THRESHOLDS.pulse_bpm.high) flags.push('tachycardia');
    if (vitals.pulse_bpm < ABNORMAL_THRESHOLDS.pulse_bpm.low) flags.push('bradycardia');
    return flags;
}

// Deployed as a Supabase Edge Function, requires 'staff' role or higher
export default async (req) => {
     if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    }

    try {
        // Auth check would be handled by Supabase RLS based on the user's token
        const { bookingId, vitalsData } = await req.json();
        if (!bookingId || !vitalsData) {
            return new Response(JSON.stringify({ error: 'bookingId and vitalsData are required' }), { status: 400 });
        }

        const vitals_flags = getVitalsFlags(vitalsData);
        const payload = {
            ...vitalsData,
            vitals_flags,
        };

        const { error } = await supabase
            .from('bookings')
            .update({
                vitals: payload,
                vitals_captured_at: new Date().toISOString(),
            })
            .eq('id', bookingId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        logger.error('Error in saveVitals function:', { error: error.message });
        return new Response(JSON.stringify({ error: 'Failed to save vitals.' }), { status: 500 });
    }
};
