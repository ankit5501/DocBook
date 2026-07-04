const { pool } = require('../config/db');

// @desc Book an appointment
// @route POST /api/appointments
// @access Private (Patient)
exports.bookAppointment = async (req, res) => {
  try {
    const { doctor_id, slot_id } = req.body;
    const patient_id = req.user.id;

    // Check if slot is available
    const slotRes = await pool.query('SELECT * FROM slots WHERE id = $1 AND doctor_id = $2 AND is_booked = false', [slot_id, doctor_id]);
    if (slotRes.rows.length === 0) {
      return res.status(400).json({ message: 'Slot is not available' });
    }

    // Begin transaction
    await pool.query('BEGIN');

    // Create appointment
    const aptRes = await pool.query(
      'INSERT INTO appointments (patient_id, doctor_id, slot_id) VALUES ($1, $2, $3) RETURNING *',
      [patient_id, doctor_id, slot_id]
    );
    const appointment = aptRes.rows[0];

    // Mark slot as booked
    await pool.query('UPDATE slots SET is_booked = true WHERE id = $1', [slot_id]);

    await pool.query('COMMIT');

    // Socket.io Notification to Doctor
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const doctorUserRes = await pool.query('SELECT user_id FROM doctors WHERE id = $1', [doctor_id]);
    if (doctorUserRes.rows.length > 0) {
      const doctorUserId = doctorUserRes.rows[0].user_id.toString();
      const doctorSocketId = connectedUsers.get(doctorUserId);
      if (doctorSocketId) {
        io.to(doctorSocketId).emit('notification', { message: 'You have a new appointment booking!' });
      }
    }

    res.status(201).json(appointment);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get my appointments (Patient)
// @route GET /api/appointments/my
// @access Private (Patient)
exports.getMyAppointments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, d.specialty, u.name as doctor_name, s.date, s.start_time, s.end_time 
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.patient_id = $1
      ORDER BY s.date DESC, s.start_time DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get doctor's appointments
// @route GET /api/appointments/doctor
// @access Private (Doctor)
exports.getDoctorAppointments = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await pool.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    const result = await pool.query(`
      SELECT a.*, u.name as patient_name, u.email as patient_email, s.date, s.start_time, s.end_time 
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.doctor_id = $1
      ORDER BY s.date DESC, s.start_time DESC
    `, [doctor_id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Update appointment status (accept/reject)
// @route PATCH /api/appointments/:id/status
// @access Private (Doctor)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted', 'rejected', 'completed'

    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await pool.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    // Begin transaction
    await pool.query('BEGIN');

    const aptRes = await pool.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3 RETURNING *',
      [status, id, doctor_id]
    );

    if (aptRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    // If rejected, free the slot
    if (status === 'rejected') {
      await pool.query('UPDATE slots SET is_booked = false WHERE id = $1', [aptRes.rows[0].slot_id]);
    }

    // If completed, finalize the offline payment
    if (status === 'completed') {
      await pool.query(
        "UPDATE appointments SET payment_status = 'completed' WHERE id = $1",
        [id]
      );
      await pool.query(
        "UPDATE payments SET status = 'completed' WHERE appointment_id = $1",
        [id]
      );
    }

    await pool.query('COMMIT');

    // Socket.io Notification to Patient
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const patientUserId = aptRes.rows[0].patient_id.toString();
    const patientSocketId = connectedUsers.get(patientUserId);
    if (patientSocketId) {
      io.to(patientSocketId).emit('notification', { message: `Your appointment status was updated to: ${status}` });
    }

    // Return the updated appointment (fetch latest status)
    const updatedApt = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
    res.json(updatedApt.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Update appointment status error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Cancel appointment
// @route DELETE /api/appointments/:id
// @access Private (Patient)
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Begin transation
    await pool.query('BEGIN');
    
    const aptRes = await pool.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 AND patient_id = $3 RETURNING *',
      ['cancelled', id, req.user.id]
    );

    if (aptRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    // Free the slot
    await pool.query('UPDATE slots SET is_booked = false WHERE id = $1', [aptRes.rows[0].slot_id]);

    await pool.query('COMMIT');
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
