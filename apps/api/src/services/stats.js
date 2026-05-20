const supabase = require('../models/supabase');
const { logger } = require('../utils/logging');

const CAP_SAMPLE_COUNT = 50;

/**
 * Updates the rolling average duration for a doctor and visit type.
 * This is called when a consultation is completed.
 *
 * @param {string} doctorId - The UUID of the doctor.
 * @param {string} visitType - The type of visit (e.g., 'new', 'followup').
 * @param {number} actualDurationSeconds - The duration of the completed consultation in seconds.
 */
async function updateDoctorStats(doctorId, visitType, actualDurationSeconds) {
  if (!doctorId || !visitType || actualDurationSeconds == null) {
    logger.warn('updateDoctorStats called with invalid arguments.', { doctorId, visitType, actualDurationSeconds });
    return;
  }

  try {
    // 1. Fetch the current stats for the doctor and visit type
    const { data: currentStat, error: fetchError } = await supabase
      .from('doctor_duration_stats')
      .select('avg_duration_seconds, sample_count')
      .eq('doctor_id', doctorId)
      .eq('visit_type', visitType)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: "single() did not return a row"
      throw fetchError;
    }

    const oldAvg = currentStat?.avg_duration_seconds || 0;
    const oldCount = currentStat?.sample_count || 0;

    // 2. Calculate the new rolling average
    // To prevent ever-growing sample_count, we can cap it.
    // When capped, we subtract the oldest value (approximated by the average)
    // before adding the new one.
    let newAvg;
    let newCount = oldCount + 1;

    if (oldCount >= CAP_SAMPLE_COUNT) {
      newAvg = ((oldAvg * oldCount) - oldAvg + actualDurationSeconds) / oldCount;
      newCount = CAP_SAMPLE_COUNT; // Count remains at the cap
    } else {
      newAvg = ((oldAvg * oldCount) + actualDurationSeconds) / newCount;
    }

    // 3. Upsert the new stats back into the database
    const { error: upsertError } = await supabase
      .from('doctor_duration_stats')
      .upsert({
        doctor_id: doctorId,
        visit_type: visitType,
        avg_duration_seconds: Math.round(newAvg),
        sample_count: newCount,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'doctor_id,visit_type'
      });

    if (upsertError) {
      throw upsertError;
    }

    logger.info('Successfully updated doctor duration stats.', { doctorId, visitType, newAvg, newCount });

  } catch (error) {
    logger.error('Error updating doctor duration stats:', {
      doctorId,
      visitType,
      error: error.message
    });
  }
}

module.exports = { updateDoctorStats };
