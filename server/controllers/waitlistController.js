const { pool } = require('../config/db');
const { handleSlotFreed, expireUnclaimedOffers } = require('../services/waitlistService');

// @desc Join appointment waitlist
// @route POST /api/waitlist
// @access Private (Patient)
exports.joinWaitlist = async (req, res) => {
  try {
    const { doctor_id, preferred_date, preferred_type } = req.body;
    const patient_id = req.user.id;

    if (!doctor_id) {
      return res.status(400).json({ message: 'Doctor ID is required to join waitlist' });
    }

    // Check doctor exists
    const docCheck = await pool.query('SELECT id FROM doctors WHERE id = $1', [doctor_id]);
    if (docCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if patient is already actively waiting for this doctor/date
    const existingCheck = await pool.query(`
      SELECT id, status, preferred_date 
      FROM waitlists 
      WHERE patient_id = $1 
        AND doctor_id = $2 
        AND status IN ('waiting', 'offered')
        AND (
          ($3::date IS NULL AND preferred_date IS NULL) OR
          ($3::date IS NOT NULL AND preferred_date = $3::date)
        )
    `, [patient_id, doctor_id, preferred_date || null]);

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ 
        message: 'You are already on the active waitlist for this doctor and date.' 
      });
    }

    const result = await pool.query(`
      INSERT INTO waitlists (patient_id, doctor_id, preferred_date, preferred_type, status)
      VALUES ($1, $2, $3, $4, 'waiting')
      RETURNING *
    `, [
      patient_id, 
      doctor_id, 
      preferred_date || null, 
      preferred_type || 'any'
    ]);

    // Count how many patients are ahead in line
    const queueAheadRes = await pool.query(`
      SELECT COUNT(*) as queue_position 
      FROM waitlists 
      WHERE doctor_id = $1 
        AND status = 'waiting' 
        AND created_at <= $2
    `, [doctor_id, result.rows[0].created_at]);

    const queuePosition = parseInt(queueAheadRes.rows[0].queue_position, 10);

    res.status(201).json({
      message: 'Successfully joined waitlist. You will be notified the moment a slot opens!',
      waitlist: result.rows[0],
      queue_position: queuePosition
    });
  } catch (err) {
    console.error('joinWaitlist error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get current patient's waitlist entries
// @route GET /api/waitlist/my
// @access Private (Patient)
exports.getMyWaitlist = async (req, res) => {
  try {
    // Run lazy expiry check first
    await expireUnclaimedOffers(req.app);

    const result = await pool.query(`
      SELECT 
        w.*,
        u_doc.name as doctor_name,
        d.specialty as doctor_specialty,
        d.fees as doctor_fees,
        s.date as offered_slot_date,
        s.start_time as offered_slot_start_time,
        s.end_time as offered_slot_end_time,
        EXTRACT(EPOCH FROM (w.offer_expires_at - CURRENT_TIMESTAMP))::INTEGER as remaining_seconds
      FROM waitlists w
      JOIN doctors d ON w.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      LEFT JOIN slots s ON w.offered_slot_id = s.id
      WHERE w.patient_id = $1
      ORDER BY 
        CASE 
          WHEN w.status = 'offered' THEN 1
          WHEN w.status = 'waiting' THEN 2
          ELSE 3
        END,
        w.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('getMyWaitlist error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Claim an offered waitlist slot
// @route POST /api/waitlist/:id/claim
// @access Private (Patient)
exports.claimWaitlistSlot = async (req, res) => {
  const { id } = req.params;
  const patient_id = req.user.id;
  const { appointment_type } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock waitlist row
    const waitlistRes = await client.query(
      'SELECT * FROM waitlists WHERE id = $1 AND patient_id = $2 FOR UPDATE',
      [id, patient_id]
    );

    if (waitlistRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Waitlist offer not found' });
    }

    const waitlist = waitlistRes.rows[0];

    if (waitlist.status !== 'offered') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Cannot claim offer with status '${waitlist.status}'` });
    }

    // 2. Check if expired
    const now = new Date();
    if (new Date(waitlist.offer_expires_at) <= now) {
      await client.query(
        "UPDATE waitlists SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id]
      );
      await client.query('COMMIT');

      // Re-offer slot to next patient
      if (waitlist.offered_slot_id) {
        await handleSlotFreed(waitlist.offered_slot_id, waitlist.doctor_id, req.app);
      }

      return res.status(400).json({ message: 'This slot offer has expired and moved to the next waiting patient.' });
    }

    const slotId = waitlist.offered_slot_id;

    // 3. Lock the slot
    const slotRes = await client.query(
      'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
      [slotId]
    );

    if (slotRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Slot no longer exists' });
    }

    const type = appointment_type === 'video' ? 'video' : 'in_person';
    const meeting_room_id = type === 'video'
      ? `docbook-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`
      : null;

    // 4. Create appointment
    const aptRes = await client.query(`
      INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_type, meeting_room_id, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [patient_id, waitlist.doctor_id, slotId, type, meeting_room_id]);

    const appointment = aptRes.rows[0];

    // 5. Create offline payment record
    const doctorRes = await client.query('SELECT fees FROM doctors WHERE id = $1', [waitlist.doctor_id]);
    const fee = doctorRes.rows[0]?.fees || 0;

    await client.query(`
      INSERT INTO payments (appointment_id, amount, payment_method, status)
      VALUES ($1, $2, 'offline', 'pending')
    `, [appointment.id, fee]);

    // 6. Mark waitlist entry claimed & slot booked
    await client.query(
      "UPDATE waitlists SET status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );
    await client.query(
      "UPDATE slots SET is_booked = true WHERE id = $1",
      [slotId]
    );

    await client.query('COMMIT');

    // Socket.io Notification to Doctor
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const doctorUserRes = await pool.query('SELECT user_id FROM doctors WHERE id = $1', [waitlist.doctor_id]);
    if (doctorUserRes.rows.length > 0) {
      const doctorUserId = doctorUserRes.rows[0].user_id.toString();
      const doctorSocketId = connectedUsers?.get(doctorUserId);
      if (doctorSocketId && io) {
        io.to(doctorSocketId).emit('notification', {
          message: 'A waitlisted patient claimed an available slot!'
        });
      }
    }

    res.status(200).json({
      message: 'Slot claimed successfully! Appointment has been scheduled.',
      appointment
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('claimWaitlistSlot error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc Cancel or leave waitlist
// @route DELETE /api/waitlist/:id
// @access Private (Patient)
exports.cancelWaitlist = async (req, res) => {
  try {
    const { id } = req.params;
    const patient_id = req.user.id;

    const waitlistRes = await pool.query(
      'SELECT * FROM waitlists WHERE id = $1 AND patient_id = $2',
      [id, patient_id]
    );

    if (waitlistRes.rows.length === 0) {
      return res.status(404).json({ message: 'Waitlist record not found' });
    }

    const waitlist = waitlistRes.rows[0];

    await pool.query(
      "UPDATE waitlists SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    // If this entry had an active offer, pass the slot to next patient
    if (waitlist.status === 'offered' && waitlist.offered_slot_id) {
      await handleSlotFreed(waitlist.offered_slot_id, waitlist.doctor_id, req.app);
    }

    res.json({ message: 'You have left the waitlist.' });
  } catch (err) {
    console.error('cancelWaitlist error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get doctor's waitlist queue
// @route GET /api/waitlist/doctor
// @access Private (Doctor)
exports.getDoctorWaitlist = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const doctor_id = doctorRes.rows[0].id;

    await expireUnclaimedOffers(req.app);

    const result = await pool.query(`
      SELECT 
        w.*,
        u.name as patient_name,
        u.email as patient_email,
        s.date as offered_slot_date,
        s.start_time as offered_slot_start_time,
        s.end_time as offered_slot_end_time,
        EXTRACT(EPOCH FROM (w.offer_expires_at - CURRENT_TIMESTAMP))::INTEGER as remaining_seconds
      FROM waitlists w
      JOIN users u ON w.patient_id = u.id
      LEFT JOIN slots s ON w.offered_slot_id = s.id
      WHERE w.doctor_id = $1 AND w.status IN ('waiting', 'offered')
      ORDER BY 
        CASE WHEN w.status = 'offered' THEN 1 ELSE 2 END,
        w.created_at ASC
    `, [doctor_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('getDoctorWaitlist error:', err.message);
    res.status(500).send('Server Error');
  }
};

