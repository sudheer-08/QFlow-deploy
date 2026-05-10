import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// Default durations in seconds as a fallback
const DEFAULT_DURATIONS = {
  prescription: 240,   // 4 min
  report_review: 420,  // 7 min
  followup: 600,       // 10 min
  new: 900,            // 15 min
  procedure: 1200,     // 20 min
};

const MIN_SAMPLES_FOR_TRUST = 5;

/**
 * Calculates the Estimated Time of Arrival (ETA) for a patient.
 *
 * @param {string} doctorId - The UUID of the doctor.
 * @param {Array<string>} visitTypesAhead - An array of visit_type enums for each patient ahead in the queue.
 * @returns {Promise<{estimatedStartTime: Date, waitDurationMinutes: number}>}
 */
export async function calculateETA(doctorId, visitTypesAhead = []) {
  if (!doctorId) {
    logger.warn('calculateETA called without a doctorId.');
    return { estimatedStartTime: new Date(), waitDurationMinutes: 0 };
  }

  try {
    // 1. Fetch all duration stats for the given doctor in one go.
    const { data: doctorStats, error: statsError } = await supabase
      .from('doctor_duration_stats')
      .select('visit_type, avg_duration_seconds, sample_count')
      .eq('doctor_id', doctorId);

    if (statsError) {
      throw statsError;
    }

    // 2. Create a lookup map for quick access to stats.
    const statsMap = new Map(
      doctorStats.map(stat => [stat.visit_type, stat])
    );

    // 3. Calculate the total estimated duration for all patients ahead.
    const totalSecondsAhead = visitTypesAhead.reduce((total, visitType) => {
      const stat = statsMap.get(visitType);
      
      // Use doctor's specific average if sample count is sufficient, otherwise use default.
      if (stat && stat.sample_count >= MIN_SAMPLES_FOR_TRUST) {
        return total + stat.avg_duration_seconds;
      } else {
        return total + (DEFAULT_DURATIONS[visitType] || DEFAULT_DURATIONS.new);
      }
    }, 0);

    // 4. Determine the time elapsed for the current patient (if any).
    // This part is tricky without knowing the current patient's `started_at`.
    // For now, we'll assume this is calculated relative to `now`.
    // A more advanced implementation might fetch the `in_progress` token and subtract time since `started_at`.
    const timeElapsedInCurrentConsultation = 0; // Simplified for now

    const totalWaitSeconds = totalSecondsAhead - timeElapsedInCurrentConsultation;
    const waitDurationMinutes = Math.round(totalWaitSeconds / 60);

    const estimatedStartTime = new Date(Date.now() + totalWaitSeconds * 1000);

    logger.info('ETA calculated successfully.', { doctorId, waitDurationMinutes });

    return { estimatedStartTime, waitDurationMinutes };

  } catch (error) {
    logger.error('Error calculating ETA:', {
      doctorId,
      error: error.message
    });
    // Return a default/safe value in case of error
    return { estimatedStartTime: new Date(), waitDurationMinutes: 0 };
  }
}
