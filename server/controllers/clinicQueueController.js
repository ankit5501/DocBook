const { pool } = require('../config/db');

/**
 * Calculate the rolling average consultation duration (in minutes) for a doctor on a specific date
 * Falls back to 12 minutes if no actual completed data yet
 */
async function getDoctorRollingAvgMinutes(doctorId, date) {
  try {
    const res = await pool.query(`
      SELECT AVG(actual_duration_minutes) as avg_duration
      FROM clinic_tokens
      WHERE doctor_id = $1 
        AND date = $2 
        AND status = 'completed' 
        AND actual_duration_minutes IS NOT NULL 
        AND actual_duration_minutes > 0
    `, [doctorId, date]);

    if (res.rows.length > 0 && res.rows[0].avg_duration) {
      return Math.max(5, Math.round(parseFloat(res.rows[0].avg_duration)));
    }
    return 12; // Standard clinical default
  } catch (err) {
    console.error('getDoctorRollingAvgMinutes error:', err.message);
    return 12;
  }
}

// @desc Patient Check-In for Clinic Visit & Generate Digital Token
// @route POST /api/clinic-queue/check-in
// @access Private (Patient or Doctor/Admin)
exports.checkIn = async (req, res) => {
  const client = await pool.connect();
  try {
    const { appointment_id } = req.body;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!appointment_id) {
      return res.status(400).json({ message: 'Appointment ID is required for check-in' });
    }

    await client.query('BEGIN');

    // 1. Fetch appointment details
    const aptRes = await client.query(`
      SELECT a.*, s.date, s.start_time, s.end_time, u.name as doctor_name
      FROM appointments a
      JOIN slots s ON a.slot_id = s.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE a.id = $1
    `, [appointment_id]);

    if (aptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const appointment = aptRes.rows[0];

    // Authorization: only the patient themselves or doctor/admin can check-in
    if (user_role === 'patient' && appointment.patient_id !== user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Unauthorized to check in for this appointment' });
    }

    if (appointment.status === 'cancelled' || appointment.status === 'rejected') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Cannot check in for a ${appointment.status} appointment` });
    }

    // 2. Check if digital token already generated
    const existingToken = await client.query(
      'SELECT * FROM clinic_tokens WHERE appointment_id = $1',
      [appointment_id]
    );

    if (existingToken.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({
        message: 'Already checked in! Your digital token is active.',
        token: existingToken.rows[0]
      });
    }

    const todayDate = new Date().toISOString().substring(0, 10);
    const appointmentDate = new Date(appointment.date).toISOString().substring(0, 10);

    // 3. Atomically determine next sequential token number for this doctor on this day
    const tokenSeqRes = await client.query(`
      SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
      FROM clinic_tokens
      WHERE doctor_id = $1 AND date = $2
    `, [appointment.doctor_id, appointmentDate]);

    const nextTokenNum = parseInt(tokenSeqRes.rows[0].next_token, 10);
    const tokenCode = `TK-${String(nextTokenNum).padStart(3, '0')}`;

    // 4. Calculate estimated wait time based on queue ahead and actual doctor pace
    const waitingAheadRes = await client.query(`
      SELECT COUNT(*) as count_ahead
      FROM clinic_tokens
      WHERE doctor_id = $1 
        AND date = $2 
        AND status IN ('waiting', 'in_consultation')
        AND token_number < $3
    `, [appointment.doctor_id, appointmentDate, nextTokenNum]);

    const countAhead = parseInt(waitingAheadRes.rows[0].count_ahead, 10);
    const avgPace = await getDoctorRollingAvgMinutes(appointment.doctor_id, appointmentDate);
    const estimatedWait = countAhead * avgPace;

    // 5. Insert token
    const insertRes = await client.query(`
      INSERT INTO clinic_tokens (
        appointment_id, 
        doctor_id, 
        patient_id, 
        date, 
        token_number, 
        token_code, 
        status, 
        check_in_time, 
        estimated_wait_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'waiting', CURRENT_TIMESTAMP, $7)
      RETURNING *
    `, [
      appointment_id,
      appointment.doctor_id,
      appointment.patient_id,
      appointmentDate,
      nextTokenNum,
      tokenCode,
      estimatedWait
    ]);

    const createdToken = insertRes.rows[0];

    await client.query('COMMIT');

    // 6. Broadcast live queue update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('queue_updated', {
        doctor_id: appointment.doctor_id,
        date: appointmentDate,
        new_token: createdToken
      });
    }

    res.status(201).json({
      message: `Check-in successful! Your clinic queue token is #${tokenCode}.`,
      token: createdToken,
      patients_ahead: countAhead,
      estimated_wait_minutes: estimatedWait,
      average_pace_minutes: avgPace
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('checkIn error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc Get Patient's Active Token & Live Queue Status
// @route GET /api/clinic-queue/appointment/:appointmentId
// @access Private (Patient or Doctor)
exports.getAppointmentTokenStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const tokenRes = await pool.query(`
      SELECT 
        ct.*,
        u_doc.name as doctor_name,
        d.specialty as doctor_specialty,
        s.start_time,
        s.end_time
      FROM clinic_tokens ct
      JOIN doctors d ON ct.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      JOIN appointments a ON ct.appointment_id = a.id
      JOIN slots s ON a.slot_id = s.id
      WHERE ct.appointment_id = $1
    `, [appointmentId]);

    if (tokenRes.rows.length === 0) {
      return res.status(404).json({ message: 'No check-in token found for this appointment' });
    }

    const token = tokenRes.rows[0];
    const doctorId = token.doctor_id;
    const date = token.date;

    // Get currently serving token
    const servingRes = await pool.query(`
      SELECT 
        ct.*, 
        u.name as patient_name,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ct.consultation_start_time))::INTEGER / 60 as elapsed_minutes
      FROM clinic_tokens ct
      JOIN users u ON ct.patient_id = u.id
      WHERE ct.doctor_id = $1 AND ct.date = $2 AND ct.status = 'in_consultation'
      LIMIT 1
    `, [doctorId, date]);

    const currentlyServing = servingRes.rows[0] || null;

    // Count waiting patients ahead of this token
    const aheadRes = await pool.query(`
      SELECT COUNT(*) as count_ahead
      FROM clinic_tokens
      WHERE doctor_id = $1 
        AND date = $2 
        AND status IN ('waiting', 'in_consultation')
        AND token_number < $3
    `, [doctorId, date, token.token_number]);

    const countAhead = parseInt(aheadRes.rows[0].count_ahead, 10);
    const avgPace = await getDoctorRollingAvgMinutes(doctorId, date);

    let currentElapsed = 0;
    if (currentlyServing && currentlyServing.elapsed_minutes) {
      currentElapsed = Math.min(avgPace, Math.max(0, parseInt(currentlyServing.elapsed_minutes, 10)));
    }

    // Dynamic wait estimate based on actual queue progress
    const dynamicWaitMinutes = token.status === 'in_consultation' 
      ? 0 
      : (token.status === 'completed' 
          ? 0 
          : Math.max(2, (countAhead * avgPace) - currentElapsed));

    const isTurnApproaching = (countAhead <= 1 && token.status === 'waiting') || dynamicWaitMinutes <= 8;

    res.json({
      token,
      currently_serving: currentlyServing ? {
        token_code: currentlyServing.token_code,
        token_number: currentlyServing.token_number,
        elapsed_minutes: Math.max(0, parseInt(currentlyServing.elapsed_minutes || 0, 10))
      } : null,
      patients_ahead: countAhead,
      estimated_wait_minutes: dynamicWaitMinutes,
      actual_average_pace_minutes: avgPace,
      is_turn_approaching: isTurnApproaching
    });
  } catch (err) {
    console.error('getAppointmentTokenStatus error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get Doctor's Complete Live Clinic Queue for Today
// @route GET /api/clinic-queue/doctor/live
// @access Private (Doctor)
exports.getDoctorLiveQueue = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const doctor_id = doctorRes.rows[0].id;
    const today = new Date().toISOString().substring(0, 10);

    const queueRes = await pool.query(`
      SELECT 
        ct.*,
        u.name as patient_name,
        u.email as patient_email,
        s.start_time as slot_start_time,
        s.end_time as slot_end_time,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ct.check_in_time))::INTEGER / 60 as wait_elapsed_minutes,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ct.consultation_start_time))::INTEGER / 60 as consult_elapsed_minutes
      FROM clinic_tokens ct
      JOIN users u ON ct.patient_id = u.id
      JOIN appointments a ON ct.appointment_id = a.id
      JOIN slots s ON a.slot_id = s.id
      WHERE ct.doctor_id = $1 AND ct.date = $2
      ORDER BY 
        CASE 
          WHEN ct.status = 'in_consultation' THEN 1
          WHEN ct.status = 'waiting' THEN 2
          WHEN ct.status = 'completed' THEN 3
          ELSE 4
        END,
        ct.token_number ASC
    `, [doctor_id, today]);

    const avgPace = await getDoctorRollingAvgMinutes(doctor_id, today);

    const tokens = queueRes.rows;
    const currentlyServing = tokens.find(t => t.status === 'in_consultation') || null;
    const waitingTokens = tokens.filter(t => t.status === 'waiting');
    const completedTokens = tokens.filter(t => t.status === 'completed');

    res.json({
      doctor_id,
      date: today,
      currently_serving: currentlyServing,
      waiting_count: waitingTokens.length,
      completed_count: completedTokens.length,
      total_tokens_today: tokens.length,
      rolling_average_pace_minutes: avgPace,
      tokens
    });
  } catch (err) {
    console.error('getDoctorLiveQueue error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Doctor calls the next patient in line
// @route POST /api/clinic-queue/call-next
// @access Private (Doctor)
exports.callNextToken = async (req, res) => {
  const client = await pool.connect();
  try {
    let doctorRes = await client.query('SELECT id, user_id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const doctor_id = doctorRes.rows[0].id;
    const today = new Date().toISOString().substring(0, 10);

    await client.query('BEGIN');

    // 1. If someone is currently in consultation, mark them completed and record duration
    const currentConsultRes = await client.query(`
      SELECT * FROM clinic_tokens 
      WHERE doctor_id = $1 AND date = $2 AND status = 'in_consultation'
      FOR UPDATE
    `, [doctor_id, today]);

    if (currentConsultRes.rows.length > 0) {
      const prev = currentConsultRes.rows[0];
      const durationMin = prev.consultation_start_time
        ? Math.max(1, Math.round((Date.now() - new Date(prev.consultation_start_time).getTime()) / 60000))
        : 10;

      await client.query(`
        UPDATE clinic_tokens 
        SET status = 'completed', 
            consultation_end_time = CURRENT_TIMESTAMP, 
            actual_duration_minutes = $1
        WHERE id = $2
      `, [durationMin, prev.id]);

      // Complete the appointment status
      await client.query(`
        UPDATE appointments 
        SET status = 'completed', payment_status = 'completed'
        WHERE id = $1
      `, [prev.appointment_id]);
    }

    // 2. Find next waiting token
    const nextTokenRes = await client.query(`
      SELECT ct.*, u.name as patient_name
      FROM clinic_tokens ct
      JOIN users u ON ct.patient_id = u.id
      WHERE ct.doctor_id = $1 AND ct.date = $2 AND ct.status = 'waiting'
      ORDER BY ct.token_number ASC
      LIMIT 1
      FOR UPDATE
    `, [doctor_id, today]);

    if (nextTokenRes.rows.length === 0) {
      await client.query('COMMIT');
      return res.json({ 
        message: 'All checked-in patients have been served. Queue is empty!',
        currently_serving: null 
      });
    }

    const nextToken = nextTokenRes.rows[0];

    // 3. Mark next token as in_consultation
    await client.query(`
      UPDATE clinic_tokens 
      SET status = 'in_consultation', 
          consultation_start_time = CURRENT_TIMESTAMP,
          called_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [nextToken.id]);

    await client.query('COMMIT');

    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    // 4. Notify the called patient
    if (io) {
      const patientSocketId = connectedUsers?.get(nextToken.patient_id.toString());
      if (patientSocketId) {
        io.to(patientSocketId).emit('notification', {
          message: `🩺 It's your turn! Dr. is ready to see Token #${nextToken.token_code} now. Please enter the consultation room.`
        });
        io.to(patientSocketId).emit('patient_called', {
          token_code: nextToken.token_code,
          token_number: nextToken.token_number
        });
      }

      // 5. Notify the subsequent patient that their turn is approaching!
      const approachingRes = await pool.query(`
        SELECT ct.patient_id, ct.token_code, ct.token_number
        FROM clinic_tokens ct
        WHERE ct.doctor_id = $1 AND ct.date = $2 AND ct.status = 'waiting'
        ORDER BY ct.token_number ASC
        LIMIT 1
      `, [doctor_id, today]);

      if (approachingRes.rows.length > 0) {
        const nextInLine = approachingRes.rows[0];
        const nextSocketId = connectedUsers?.get(nextInLine.patient_id.toString());
        if (nextSocketId) {
          io.to(nextSocketId).emit('notification', {
            message: `🔔 Your turn is approaching! Token #${nextToken.token_code} is now in consultation. You are next in line (Token #${nextInLine.token_code}). Please prepare to enter.`
          });
          io.to(nextSocketId).emit('turn_approaching', {
            current_token: nextToken.token_code,
            your_token: nextInLine.token_code
          });
        }
      }

      // Broadcast queue update to all clinic displays
      io.emit('queue_updated', {
        doctor_id,
        date: today,
        current_serving: nextToken
      });
    }

    res.json({
      message: `Token #${nextToken.token_code} (${nextToken.patient_name}) is now called for consultation.`,
      currently_serving: nextToken
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('callNextToken error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc Doctor completes consultation for current patient
// @route POST /api/clinic-queue/complete
// @access Private (Doctor)
exports.completeCurrentConsultation = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const doctor_id = doctorRes.rows[0].id;
    const today = new Date().toISOString().substring(0, 10);

    const currentRes = await pool.query(`
      SELECT * FROM clinic_tokens 
      WHERE doctor_id = $1 AND date = $2 AND status = 'in_consultation'
      LIMIT 1
    `, [doctor_id, today]);

    if (currentRes.rows.length === 0) {
      return res.status(400).json({ message: 'No patient is currently in consultation' });
    }

    const current = currentRes.rows[0];
    const durationMin = current.consultation_start_time
      ? Math.max(1, Math.round((Date.now() - new Date(current.consultation_start_time).getTime()) / 60000))
      : 10;

    await pool.query(`
      UPDATE clinic_tokens 
      SET status = 'completed', 
          consultation_end_time = CURRENT_TIMESTAMP, 
          actual_duration_minutes = $1 
      WHERE id = $2
    `, [durationMin, current.id]);

    await pool.query(`
      UPDATE appointments 
      SET status = 'completed', payment_status = 'completed' 
      WHERE id = $1
    `, [current.appointment_id]);

    const io = req.app.get('io');
    if (io) {
      io.emit('queue_updated', { doctor_id, date: today });
    }

    res.json({
      message: `Consultation completed for Token #${current.token_code} (${durationMin} mins).`,
      actual_duration_minutes: durationMin
    });
  } catch (err) {
    console.error('completeCurrentConsultation error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Mark a token as no-show
// @route POST /api/clinic-queue/:tokenId/no-show
// @access Private (Doctor)
exports.markNoShow = async (req, res) => {
  try {
    const { tokenId } = req.params;
    await pool.query("UPDATE clinic_tokens SET status = 'no_show' WHERE id = $1", [tokenId]);
    const io = req.app.get('io');
    if (io) {
      io.emit('queue_updated', {});
    }
    res.json({ message: 'Patient marked as no-show' });
  } catch (err) {
    console.error('markNoShow error:', err.message);
    res.status(500).send('Server Error');
  }
};

