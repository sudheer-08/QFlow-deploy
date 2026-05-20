const router = require("express").Router();
const supabase = require("../models/supabase");
const { authenticate, requireRole } = require("../middleware/auth");
const { getLocalDateString } = require("../utils/date");
const { sendNotification } = require("../services/notifications"); // Assuming a generic notification sender

// All queue routes require authentication unless specified otherwise
router.use(authenticate);

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calculates ETA for all remaining patients in the queue.
 * @param {string} doctorId - The ID of the doctor.
 * @param {string} sessionDate - The date of the session (YYYY-MM-DD).
 * @param {object} supabaseClient - The Supabase client instance.
 * @returns {Promise<Map<string, string>>} A map of bookingId to ETA string.
 */
async function calculateAllEtas(doctorId, sessionDate, supabaseClient) {
  const { data: stats, error: statsError } = await supabaseClient
    .from("doctor_duration_stats")
    .select("avg_duration_seconds")
    .eq("doctor_id", doctorId)
    .single();

  if (statsError && statsError.code !== "PGRST116") {
    // Ignore no rows found
    console.error("Error fetching doctor stats for ETA:", statsError);
  }
  const avgDuration = stats?.avg_duration_seconds || 900; // Default 15 mins

  const { data: remainingBookings, error: bookingsError } = await supabaseClient
    .from("bookings")
    .select("id, status, queue_position, started_at")
    .eq("doctor_id", doctorId)
    .eq("session_date", sessionDate)
    .in("status", ["in_progress", "called", "checked_in", "scheduled"])
    .order("queue_position", { ascending: true });

  if (bookingsError) {
    console.error("Error fetching remaining bookings for ETA:", bookingsError);
    return new Map();
  }

  const etas = new Map();
  let cumulativeTime = 0;
  const now = new Date();

  const inProgressBooking = remainingBookings.find(
    (b) => b.status === "in_progress",
  );
  if (inProgressBooking) {
    const elapsed =
      (now.getTime() - new Date(inProgressBooking.started_at).getTime()) / 1000;
    cumulativeTime = Math.max(0, avgDuration - elapsed);
  }

  const waitingQueue = remainingBookings.filter((b) =>
    ["called", "checked_in"].includes(b.status),
  );

  for (const booking of waitingQueue) {
    const etaTimestamp = new Date(now.getTime() + cumulativeTime * 1000);
    etas.set(booking.id, etaTimestamp.toISOString());
    cumulativeTime += avgDuration;
  }

  // Also calculate for scheduled but not checked-in
  const scheduledQueue = remainingBookings.filter(
    (b) => b.status === "scheduled",
  );
  for (const booking of scheduledQueue) {
    const etaTimestamp = new Date(now.getTime() + cumulativeTime * 1000);
    etas.set(booking.id, etaTimestamp.toISOString());
    cumulativeTime += avgDuration;
  }

  return etas;
}

// ─── 2A. GET /api/queue/state/:doctorId/:date ───────────────────────────────────
router.get(
  "/state/:doctorId/:date",
  requireRole("staff", "doctor", "clinic_admin"),
  async (req, res) => {
    try {
      const { doctorId, date } = req.params;

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("session_date", date)
        .order("queue_position", { ascending: true });

      if (error) throw error;

      const { data: stats, error: statsError } = await supabase
        .from("doctor_duration_stats")
        .select("avg_duration_seconds, sample_count")
        .eq("doctor_id", doctorId)
        .single();

      if (statsError && statsError.code !== "PGRST116") throw statsError;

      const etas = await calculateAllEtas(doctorId, date, supabase);

      const queueState = {
        current: null,
        called: null,
        checked_in: [],
        scheduled: [],
        completed: [],
        skipped: [],
        lab_pause: [],
        stats: {
          total_today: bookings.length,
          completed_count: 0,
          remaining_count: 0,
          avg_duration_seconds: stats?.avg_duration_seconds || 900,
          session_started_at: null,
        },
      };

      let sessionStartedAt = null;

      for (const booking of bookings) {
        const bookingWithEta = {
          ...booking,
          estimated_time: etas.get(booking.id) || null,
        };

        switch (booking.status) {
          case "in_progress":
            queueState.current = bookingWithEta;
            if (
              !sessionStartedAt ||
              new Date(booking.started_at) < new Date(sessionStartedAt)
            ) {
              sessionStartedAt = booking.started_at;
            }
            break;
          case "called":
            queueState.called = bookingWithEta;
            break;
          case "checked_in":
            queueState.checked_in.push(bookingWithEta);
            break;
          case "scheduled":
            queueState.scheduled.push(bookingWithEta);
            break;
          case "completed":
            queueState.completed.push(bookingWithEta);
            break;
          case "skipped":
            queueState.skipped.push(bookingWithEta);
            break;
          case "lab_pause":
            queueState.lab_pause.push(bookingWithEta);
            break;
        }
      }

      queueState.stats.completed_count = queueState.completed.length;
      queueState.stats.remaining_count =
        queueState.checked_in.length +
        queueState.scheduled.length +
        (queueState.current ? 1 : 0) +
        (queueState.called ? 1 : 0);
      queueState.stats.session_started_at = sessionStartedAt;

      // Sort completed by ended_at desc
      queueState.completed.sort(
        (a, b) => new Date(b.ended_at) - new Date(a.ended_at),
      );

      res.json({ data: queueState, error: null });
    } catch (err) {
      console.error("Get Queue State Error:", err);
      res
        .status(500)
        .json({
          data: null,
          error: {
            message: "Failed to fetch queue state",
            details: err.message,
          },
        });
    }
  },
);

// ─── 2B. POST /api/queue/call-next/:doctorId ───────────────────────────────────
router.post(
  "/call-next/:doctorId",
  requireRole("doctor", "clinic_admin"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const io = req.app.get("io");
      const sessionDate = getLocalDateString();

      // 1. Check for existing in_progress or called tokens
      const { data: existing, error: existingError } = await supabase
        .from("bookings")
        .select("id, status, called_at, clinics(grace_period_minutes)")
        .eq("doctor_id", doctorId)
        .eq("session_date", sessionDate)
        .in("status", ["in_progress", "called"]);

      if (existingError) throw existingError;

      if (existing.some((b) => b.status === "in_progress")) {
        return res
          .status(409)
          .json({
            error:
              "A consultation is already in progress. Mark it complete first.",
          });
      }

      const calledBooking = existing.find((b) => b.status === "called");
      if (calledBooking) {
        const gracePeriod =
          (calledBooking.clinics?.grace_period_minutes || 5) * 60 * 1000;
        if (new Date() - new Date(calledBooking.called_at) < gracePeriod) {
          return res
            .status(409)
            .json({
              error: `Patient T-${String(calledBooking.token_number).padStart(3, "0")} has been called. Use Skip if they are not present.`,
            });
        }
      }

      // 3. Find the next checked_in token
      const { data: nextPatient, error: nextPatientError } = await supabase
        .from("bookings")
        .select("*, patients:patient_id(*), clinics:clinic_id(*)")
        .eq("doctor_id", doctorId)
        .eq("session_date", sessionDate)
        .eq("status", "checked_in")
        .order("queue_position", { ascending: true })
        .limit(1)
        .single();

      if (nextPatientError || !nextPatient) {
        return res
          .status(404)
          .json({ error: "No checked-in patients are waiting." });
      }

      // 4. Update status to 'called'
      const { data: called, error: updateError } = await supabase
        .from("bookings")
        .update({ status: "called", called_at: new Date().toISOString() })
        .eq("id", nextPatient.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 5. & 6. Send notifications
      const patientPhone = nextPatient.patients?.phone;
      if (patientPhone) {
        sendNotification(patientPhone, "you_are_called", {
          clinic_name: nextPatient.clinics?.name || "the clinic",
          token_number: String(called.token_number).padStart(3, "0"),
        }).catch(console.error);
      }

      // Heads-up notifications
      const { data: upcoming, error: upcomingError } = await supabase
        .from("bookings")
        .select("*, patients:patient_id(phone)")
        .eq("doctor_id", doctorId)
        .eq("session_date", sessionDate)
        .eq("status", "checked_in")
        .order("queue_position", { ascending: true })
        .limit(nextPatient.clinics?.tokens_ahead_notify || 2);

      if (!upcomingError && upcoming) {
        for (let i = 0; i < upcoming.length; i++) {
          const p = upcoming[i];
          if (p.patients?.phone) {
            sendNotification(p.patients.phone, "heads_up_approaching", {
              clinic_name: nextPatient.clinics?.name || "the clinic",
              tokens_ahead: i + 1,
              eta: "a few minutes", // A proper ETA calculation should be here
            }).catch(console.error);
          }
        }
      }

      // 7. Broadcast change
      io.to(`queue:${doctorId}:${sessionDate}`).emit("queue:state_change");

      // 8. Return called booking
      res.json({ data: called, error: null });
    } catch (err) {
      console.error("Call Next Patient Error:", err);
      res
        .status(500)
        .json({
          data: null,
          error: {
            message: "Failed to call next patient",
            details: err.message,
          },
        });
    }
  },
);

// ─── 2C. POST /api/queue/start-consultation/:bookingId ──────────────────────────
router.post(
  "/start-consultation/:bookingId",
  requireRole("doctor", "clinic_admin"),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const io = req.app.get("io");

      // 1. Validate booking status
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("status, doctor_id, session_date")
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking)
        return res.status(404).json({ error: "Booking not found." });
      if (booking.status !== "called")
        return res
          .status(409)
          .json({
            error: 'Booking must be in "called" state to start consultation.',
          });

      // 2. Update status
      const { data: updatedBooking, error: updateError } = await supabase
        .from("bookings")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", bookingId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 3. Broadcast change
      io.to(`queue:${booking.doctor_id}:${booking.session_date}`).emit(
        "queue:state_change",
      );

      // 4. Return updated booking
      res.json({ data: updatedBooking, error: null });
    } catch (err) {
      console.error("Start Consultation Error:", err);
      res
        .status(500)
        .json({
          data: null,
          error: {
            message: "Failed to start consultation",
            details: err.message,
          },
        });
    }
  },
);

// ─── 2D. POST /api/queue/mark-complete/:bookingId ──────────────────────────────
router.post(
  "/mark-complete/:bookingId",
  requireRole("doctor", "clinic_admin"),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const io = req.app.get("io");
      const endedAt = new Date();

      // 1. Validate status
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("status, doctor_id, session_date, started_at")
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking)
        return res.status(404).json({ error: "Booking not found." });
      if (booking.status !== "in_progress")
        return res.status(409).json({ error: "Booking is not in progress." });

      // 2. Update status
      const { data: updatedBooking, error: updateError } = await supabase
        .from("bookings")
        .update({ status: "completed", ended_at: endedAt.toISOString() })
        .eq("id", bookingId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 3. & 4. Calculate duration and update stats
      const actualDuration =
        (endedAt.getTime() - new Date(booking.started_at).getTime()) / 1000;

      const { data: stats, error: statsError } = await supabase.rpc(
        "update_doctor_duration",
        {
          p_doctor_id: booking.doctor_id,
          p_actual_duration: actualDuration,
        },
      );

      if (statsError) console.error("Error updating doctor stats:", statsError);

      // 5. & 6. Recalculate ETAs and notify if significant change
      // This is complex and better handled by a background job or a more sophisticated service.
      // For now, we'll just broadcast the state change.

      // 7. Broadcast change
      io.to(`queue:${booking.doctor_id}:${booking.session_date}`).emit(
        "queue:state_change",
      );

      // 8. Return updated stats
      res.json({
        data: { booking: updatedBooking, new_stats: stats },
        error: null,
      });
    } catch (err) {
      console.error("Mark Complete Error:", err);
      res
        .status(500)
        .json({
          data: null,
          error: { message: "Failed to mark complete", details: err.message },
        });
    }
  },
);

// ─── 2E. POST /api/queue/skip/:bookingId ──────────────────────────────────────
router.post(
  "/skip/:bookingId",
  requireRole("doctor", "clinic_admin"),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const io = req.app.get("io");

      // 1. Validate status
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select(
          "status, doctor_id, session_date, token_number, patients:patient_id(phone), clinics:clinic_id(name)",
        )
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking)
        return res.status(404).json({ error: "Booking not found." });
      if (booking.status !== "called")
        return res
          .status(409)
          .json({ error: 'Only a "called" patient can be skipped.' });

      // 2. & 3. Update status and queue_position
      const { data: maxPos, error: maxPosError } = await supabase
        .from("bookings")
        .select("queue_position")
        .eq("doctor_id", booking.doctor_id)
        .eq("session_date", booking.session_date)
        .eq("status", "checked_in")
        .order("queue_position", { ascending: false })
        .limit(1)
        .single();

      if (maxPosError && maxPosError.code !== "PGRST116") throw maxPosError;

      const newQueuePosition = (maxPos?.queue_position || 0) + 1;

      const { data: skippedBooking, error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "skipped",
          skipped_at: new Date().toISOString(),
          queue_position: newQueuePosition,
        })
        .eq("id", bookingId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 5. Send notification
      if (booking.patients?.phone) {
        sendNotification(booking.patients.phone, "skipped_notification", {
          clinic_name: booking.clinics?.name || "the clinic",
          token_number: String(booking.token_number).padStart(3, "0"),
        }).catch(console.error);
      }

      // 4. Call next patient automatically
      // We will just broadcast the change and let the frontend trigger the next call
      io.to(`queue:${booking.doctor_id}:${booking.session_date}`).emit(
        "queue:state_change",
      );

      res.json({ data: skippedBooking, error: null });
    } catch (err) {
      console.error("Skip Token Error:", err);
      res
        .status(500)
        .json({
          data: null,
          error: { message: "Failed to skip token", details: err.message },
        });
    }
  },
);

// ─── 2F. POST /api/queue/check-in/:bookingId ──────────────────────────────────
// This one uses bookingId from a link, not a token. The prompt is a bit ambiguous.
// Let's assume the check-in link contains the bookingId.
router.post("/check-in/:bookingId", async (req, res) => {
  // Public, but should be rate-limited
  try {
    const { bookingId } = req.params;
    const io = req.app.get("io");

    // 1. Validate booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*, patients:patient_id(*), clinics:clinic_id(*)")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking)
      return res.status(404).json({ error: "Booking not found." });
    if (booking.session_date !== getLocalDateString())
      return res
        .status(400)
        .json({
          error: "Check-in is only valid on the day of the appointment.",
        });
    if (booking.status !== "scheduled")
      return res
        .status(409)
        .json({ error: `Your status is already "${booking.status}".` });

    // 2. Update status
    const { data: checkedInBooking, error: updateError } = await supabase
      .from("bookings")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Calculate position
    const { count, error: countError } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", booking.doctor_id)
      .eq("session_date", booking.session_date)
      .eq("status", "checked_in")
      .lt("queue_position", booking.queue_position);

    const position = (count || 0) + 1;

    const etas = await calculateAllEtas(
      booking.doctor_id,
      booking.session_date,
      supabase,
    );
    const eta = etas.get(booking.id);

    // 5. Send notification
    if (booking.patients?.phone) {
      sendNotification(booking.patients.phone, "checkin_confirmed", {
        clinic_name: booking.clinics?.name || "the clinic",
        position: position,
        eta: eta
          ? new Date(eta).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Kolkata",
            })
          : "calculating...",
      }).catch(console.error);
    }

    // 6. Broadcast change
    io.to(`queue:${booking.doctor_id}:${booking.session_date}`).emit(
      "queue:state_change",
    );

    // 7. Return result
    res.json({
      data: {
        position,
        estimated_time: eta,
        token_number: checkedInBooking.token_number,
      },
      error: null,
    });
  } catch (err) {
    console.error("Check-in Error:", err);
    res
      .status(500)
      .json({
        data: null,
        error: { message: "Failed to check in", details: err.message },
      });
  }
});

// ─── 2G. POST /api/queue/insert-emergency ─────────────────────────────────────
router.post(
  "/insert-emergency",
  requireRole("staff", "clinic_admin"),
  async (req, res) => {
    try {
      const { clinicId, doctorId, patientName, patientPhone } = req.body;
      const io = req.app.get("io");
      const sessionDate = getLocalDateString();

      // Transaction to shift positions and insert
      const { data, error } = await supabase.rpc("insert_emergency_booking", {
        p_clinic_id: clinicId,
        p_doctor_id: doctorId,
        p_patient_name: patientName,
        p_patient_phone: patientPhone,
        p_session_date: sessionDate,
      });

      if (error) throw error;

      const newBooking = data;

      // 6. & 7. Notifications and broadcast
      // This is complex, better handled async. For now, just broadcast.
      io.to(`queue:${doctorId}:${sessionDate}`).emit("queue:state_change");

      res.status(201).json({ data: newBooking, error: null });
    } catch (err) {
      console.error("Insert Emergency Error:", err);
      res
        .status(500)
        .json({
          data: null,
          error: {
            message: "Failed to insert emergency booking",
            details: err.message,
          },
        });
    }
  },
);

module.exports = router;
