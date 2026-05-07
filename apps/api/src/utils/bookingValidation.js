/**
 * Booking Validation Utilities
 * Prevents double-booking, checks slot conflicts, and enforces buffer times
 */

const BUFFER_TIME_MINS = 15; // Buffer between appointments
const EMERGENCY_BUFFER_MINS = 5; // Shorter buffer for emergency slots if needed

/**
 * Convert HH:MM to minutes from midnight
 * @param {string} time - Time in HH:MM format
 * @returns {number|null} Minutes from midnight or null if invalid
 */
const timeToMinutes = (time) => {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes from midnight to HH:MM format
 * @param {number} mins - Minutes from midnight
 * @returns {string} Time in HH:MM format
 */
const minutesToTime = (mins) => {
  const hours = Math.floor(mins / 60).toString().padStart(2, '0');
  const minutes = (mins % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Check if two time slots conflict considering duration and buffer
 * @param {string} slot1Time - First slot start time (HH:MM)
 * @param {string} slot2Time - Second slot start time (HH:MM)
 * @param {number} durationMins - Duration of each appointment in minutes
 * @param {number} bufferMins - Buffer time between appointments (default BUFFER_TIME_MINS)
 * @returns {boolean} True if slots conflict
 */
const slotsConflict = (slot1Time, slot2Time, durationMins = 20, bufferMins = BUFFER_TIME_MINS) => {
  const time1 = timeToMinutes(slot1Time);
  const time2 = timeToMinutes(slot2Time);
  
  if (time1 === null || time2 === null) return false;
  
  // Calculate end times considering duration and buffer
  const slot1End = time1 + durationMins + bufferMins;
  const slot2End = time2 + durationMins + bufferMins;
  
  // Check if slots overlap
  return (time1 < slot2End && time2 < slot1End);
};

/**
 * Get conflicting time slots for a given time
 * @param {string} requestedSlot - Requested slot time (HH:MM)
 * @param {number} durationMins - Duration of appointment
 * @param {number} bufferMins - Buffer time
 * @returns {object} {startTime, endTime} in minutes
 */
const getConflictWindow = (requestedSlot, durationMins = 20, bufferMins = BUFFER_TIME_MINS) => {
  const slotMins = timeToMinutes(requestedSlot);
  if (slotMins === null) return null;
  
  return {
    startTime: slotMins - bufferMins,
    endTime: slotMins + durationMins + bufferMins
  };
};

/**
 * Validate appointment availability considering:
 * - No double booking for same patient
 * - No slot conflicts for doctor
 * - Buffer time enforcement
 * 
 * @param {object} supabase - Supabase client
 * @param {string} doctorId - Doctor's UUID
 * @param {string} patientId - Patient's UUID
 * @param {string} date - Appointment date (YYYY-MM-DD)
 * @param {string} slotTime - Requested slot time (HH:MM)
 * @param {number} durationMins - Appointment duration in minutes
 * @returns {object} {isValid, error, reason}
 */
const validateBookingAvailability = async (
  supabase,
  doctorId,
  patientId,
  date,
  slotTime,
  durationMins = 20
) => {
  try {
    // 1. Check if same patient already has an appointment with this doctor on this date
    const { data: patientAppointments, error: patientErr } = await supabase
      .from('appointments')
      .select('id, appointment_date, slot_time, status')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    if (patientErr) throw patientErr;

    if (patientAppointments && patientAppointments.length > 0) {
      return {
        isValid: false,
        error: 'DUPLICATE_PATIENT_BOOKING',
        reason: 'You already have an appointment with this doctor on this date'
      };
    }

    // 2. Check for slot conflicts with other patients (considering buffer time)
    const conflictWindow = getConflictWindow(slotTime, durationMins);
    
    const { data: conflictingBookings, error: conflictErr } = await supabase
      .from('appointments')
      .select('id, slot_time, status')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'pending']);

    if (conflictErr) throw conflictErr;

    if (conflictingBookings && conflictingBookings.length > 0) {
      const hasConflict = conflictingBookings.some(booking => {
        return slotsConflict(slotTime, booking.slot_time, durationMins);
      });

      if (hasConflict) {
        return {
          isValid: false,
          error: 'SLOT_CONFLICT',
          reason: 'This slot conflicts with another appointment. Please choose a different time.'
        };
      }
    }

    // 3. Check patient's appointment on any date (prevent overbooking in general)
    const { data: allPatientAppointments, error: allErr } = await supabase
      .from('appointments')
      .select('id, appointment_date, slot_time, status')
      .eq('patient_id', patientId)
      .in('status', ['confirmed', 'pending'])
      .gte('appointment_date', date)
      .lt('appointment_date', new Date(new Date(date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (allErr) throw allErr;

    if (allPatientAppointments && allPatientAppointments.length > 0) {
      // Allow multiple appointments but warn (optional policy)
      // For now, we allow it but could add a warning flag
    }

    // All checks passed
    return { isValid: true };

  } catch (error) {
    console.error('Booking validation error:', error);
    return {
      isValid: false,
      error: 'VALIDATION_ERROR',
      reason: 'Failed to validate appointment availability'
    };
  }
};

/**
 * Get available slots considering existing bookings and buffer times
 * @param {array} allSlots - Array of slot times in HH:MM format
 * @param {array} bookedSlots - Array of booked slot times
 * @param {number} durationMins - Duration of each appointment
 * @param {number} bufferMins - Buffer time between appointments
 * @returns {array} Available slots
 */
const getAvailableSlots = (
  allSlots,
  bookedSlots = [],
  durationMins = 20,
  bufferMins = BUFFER_TIME_MINS
) => {
  if (!Array.isArray(allSlots)) return [];
  if (!Array.isArray(bookedSlots)) bookedSlots = [];

  return allSlots.filter(slot => {
    // Check if exact slot is booked
    if (bookedSlots.some(booked => booked.slice(0, 5) === slot)) {
      return false;
    }
    
    // Check if slot conflicts with any booked slot (considering buffer)
    return !bookedSlots.some(bookedSlot => {
      return slotsConflict(slot, bookedSlot.slice(0, 5), durationMins, bufferMins);
    });
  });
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  slotsConflict,
  getConflictWindow,
  validateBookingAvailability,
  getAvailableSlots,
  BUFFER_TIME_MINS,
  EMERGENCY_BUFFER_MINS
};
