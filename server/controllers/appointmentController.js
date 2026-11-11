const { pool } = require('../config/db');
const { handleSlotFreed } = require('../services/waitlistService');

// @desc Book an appointment
// @route POST /api/appointments
// @access Private (Patient)
exports.bookAppointment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { doctor_id, slot_id, appointment_type } = req.body;
    const patient_id = req.user.id;

    if (!doctor_id || !slot_id) {
      return res.status(400).json({ message: 'Doctor ID and Slot ID are required' });
    }

    // Begin transaction on dedicated client connection
    await client.query('BEGIN');

    // Concurrency protection: Lock the slot row atomically using SELECT ... FOR UPDATE
    const slotRes = await client.query(
      'SELECT * FROM slots WHERE id = $1 AND doctor_id = $2 FOR UPDATE',
      [slot_id, doctor_id]
    );

    if (slotRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Slot not found for this practitioner' });
    }

    const slot = slotRes.rows[0];

    // Atomically check availability inside the locked transaction
    if (slot.is_booked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        message: 'This slot has already been booked by another patient. Please choose another slot.' 
      });
    }

    // Mark slot as booked atomically
    await client.query('UPDATE slots SET is_booked = true WHERE id = $1', [slot_id]);

    const type = appointment_type === 'video' ? 'video' : 'in_person';
    const meeting_room_id = type === 'video' 
      ? `docbook-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`
      : null;

    // Create appointment atomically inside transaction
    const aptRes = await client.query(
      'INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_type, meeting_room_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [patient_id, doctor_id, slot_id, type, meeting_room_id, 'pending']
    );
    const appointment = aptRes.rows[0];

    await client.query('COMMIT');

    // Socket.io Notification to Doctor
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const doctorUserRes = await pool.query('SELECT user_id FROM doctors WHERE id = $1', [doctor_id]);
    if (doctorUserRes.rows.length > 0) {
      const doctorUserId = doctorUserRes.rows[0].user_id.toString();
      const doctorSocketId = connectedUsers?.get(doctorUserId);
      if (doctorSocketId && io) {
        io.to(doctorSocketId).emit('notification', { message: 'You have a new appointment booking!' });
      }
    }

    res.status(201).json(appointment);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('bookAppointment error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc Get my appointments (Patient)
// @route GET /api/appointments/my
// @access Private (Patient)
exports.getMyAppointments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*, 
        d.specialty, 
        d.fees,
        u.name as doctor_name, 
        s.date, 
        s.start_time, 
        s.end_time,
        pr.id as prescription_id,
        r.id as review_id,
        r.rating as review_rating
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      JOIN slots s ON a.slot_id = s.id
      LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
      LEFT JOIN reviews r ON r.appointment_id = a.id
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
      SELECT 
        a.*, 
        u.name as patient_name, 
        u.email as patient_email, 
        s.date, 
        s.start_time, 
        s.end_time,
        pr.id as prescription_id,
        pp.blood_group as patient_blood_group,
        pp.height as patient_height,
        pp.weight as patient_weight,
        pp.allergies as patient_allergies,
        pp.chronic_conditions as patient_chronic_conditions,
        pp.emergency_contact_phone as patient_emergency_phone
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      JOIN slots s ON a.slot_id = s.id
      LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
      LEFT JOIN patient_profiles pp ON pp.user_id = a.patient_id
      WHERE a.doctor_id = $1
      ORDER BY s.date DESC, s.start_time DESC
    `, [doctor_id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Update appointment status (accept/reject/completed)
// @route PATCH /api/appointments/:id/status
// @access Private (Doctor)
exports.updateAppointmentStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted', 'rejected', 'completed'

    let doctorRes = await client.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await client.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    // Begin transaction on dedicated client
    await client.query('BEGIN');

    const aptRes = await client.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3 RETURNING *',
      [status, id, doctor_id]
    );

    if (aptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    const apt = aptRes.rows[0];

    // If rejected, free the slot
    if (status === 'rejected') {
      await client.query('UPDATE slots SET is_booked = false WHERE id = $1', [apt.slot_id]);
    }

    // If completed, finalize the offline payment
    if (status === 'completed') {
      await client.query(
        "UPDATE appointments SET payment_status = 'completed' WHERE id = $1",
        [id]
      );
      await client.query(
        "UPDATE payments SET status = 'completed' WHERE appointment_id = $1",
        [id]
      );
    }

    await client.query('COMMIT');

    // If rejected and slot freed, notify waitlisted patients
    if (status === 'rejected' && apt.slot_id) {
      handleSlotFreed(apt.slot_id, doctor_id, req.app).catch(e => console.error('Waitlist trigger error:', e));
    }

    // Socket.io Notification to Patient
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const patientUserId = apt.patient_id.toString();
    const patientSocketId = connectedUsers?.get(patientUserId);
    if (patientSocketId && io) {
      io.to(patientSocketId).emit('notification', { message: `Your appointment status was updated to: ${status}` });
    }

    // Return the updated appointment (fetch latest status)
    const updatedApt = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
    res.json(updatedApt.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update appointment status error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc Reschedule an appointment to a new slot
// @route PATCH /api/appointments/:id/reschedule
// @access Private (Patient)
exports.rescheduleAppointment = async (req, res) => {
  const { id } = req.params;
  const { new_slot_id } = req.body;
  const patient_id = req.user.id;

  if (!new_slot_id) {
    return res.status(400).json({ message: 'New slot ID is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify and lock current appointment
    const currentAptRes = await client.query(
      'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 FOR UPDATE',
      [id, patient_id]
    );

    if (currentAptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    const currentApt = currentAptRes.rows[0];

    if (currentApt.status === 'cancelled' || currentApt.status === 'rejected' || currentApt.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Cannot reschedule a ${currentApt.status} appointment` });
    }

    if (currentApt.slot_id === parseInt(new_slot_id, 10)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Selected slot is the same as the current slot' });
    }

    // 2. Lock new slot using SELECT ... FOR UPDATE to prevent race conditions
    const newSlotRes = await client.query(
      'SELECT * FROM slots WHERE id = $1 AND doctor_id = $2 FOR UPDATE',
      [new_slot_id, currentApt.doctor_id]
    );

    if (newSlotRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'The selected slot was not found' });
    }

    if (newSlotRes.rows[0].is_booked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'The selected slot has already been booked. Please choose another.' });
    }

    const oldSlotId = currentApt.slot_id;

    // 3. Free old slot
    await client.query('UPDATE slots SET is_booked = false WHERE id = $1', [oldSlotId]);

    // 4. Reserve new slot
    await client.query('UPDATE slots SET is_booked = true WHERE id = $1', [new_slot_id]);

    // 5. Update appointment with new slot
    const updatedAptRes = await client.query(
      'UPDATE appointments SET slot_id = $1 WHERE id = $2 RETURNING *',
      [new_slot_id, id]
    );

    await client.query('COMMIT');

    // 6. Offer the freed old slot to eligible waitlisted patients immediately
    handleSlotFreed(oldSlotId, currentApt.doctor_id, req.app).catch(e => console.error('Waitlist trigger error:', e));

    // Socket notification to doctor
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const doctorUserRes = await pool.query('SELECT user_id FROM doctors WHERE id = $1', [currentApt.doctor_id]);
    if (doctorUserRes.rows.length > 0) {
      const doctorUserId = doctorUserRes.rows[0].user_id.toString();
      const doctorSocketId = connectedUsers?.get(doctorUserId);
      if (doctorSocketId && io) {
        io.to(doctorSocketId).emit('notification', {
          message: `Appointment #APT-${id} has been rescheduled by the patient.`
        });
      }
    }

    res.json({
      message: 'Appointment rescheduled successfully',
      appointment: updatedAptRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reschedule error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc Create or update prescription for an appointment
// @route POST /api/appointments/:id/prescription
// @access Private (Doctor)
exports.createOrUpdatePrescription = async (req, res) => {
  const { id } = req.params; // appointment_id
  const { diagnosis, notes, medications } = req.body;

  if (!diagnosis || !diagnosis.trim()) {
    return res.status(400).json({ message: 'Clinical diagnosis is required' });
  }

  try {
    // 1. Get doctor profile for this user
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await pool.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    // 2. Verify appointment belongs to this doctor
    const aptRes = await pool.query(
      'SELECT * FROM appointments WHERE id = $1 AND doctor_id = $2',
      [id, doctor_id]
    );

    if (aptRes.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    const appointment = aptRes.rows[0];
    const patient_id = appointment.patient_id;

    // Auto mark appointment completed if not already completed
    if (appointment.status !== 'completed') {
      await pool.query("UPDATE appointments SET status = 'completed', payment_status = 'completed' WHERE id = $1", [id]);
    }

    const medsArray = Array.isArray(medications) ? JSON.stringify(medications) : '[]';

    // Upsert into prescriptions
    const presQuery = `
      INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, diagnosis, notes, medications, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (appointment_id) 
      DO UPDATE SET 
        diagnosis = EXCLUDED.diagnosis,
        notes = EXCLUDED.notes,
        medications = EXCLUDED.medications,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(presQuery, [
      id,
      doctor_id,
      patient_id,
      diagnosis.trim(),
      notes ? notes.trim() : '',
      medsArray
    ]);

    // Notify patient
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const patientSocketId = connectedUsers?.get(patient_id.toString());
    if (patientSocketId) {
      io.to(patientSocketId).emit('notification', {
        message: 'Your doctor has issued your digital consultation prescription!'
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Save prescription error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get prescription for an appointment
// @route GET /api/appointments/:id/prescription
// @access Private (Doctor or Patient of the appointment)
exports.getPrescription = async (req, res) => {
  const { id } = req.params; // appointment_id

  try {
    const presRes = await pool.query(`
      SELECT 
        p.*,
        u_doc.name as doctor_name,
        u_doc.email as doctor_email,
        d.specialty as doctor_specialty,
        d.experience as doctor_experience,
        d.fees as doctor_fees,
        u_pat.name as patient_name,
        u_pat.email as patient_email,
        s.date as appointment_date,
        s.start_time,
        s.end_time,
        pp.blood_group,
        pp.height,
        pp.weight,
        pp.allergies,
        pp.chronic_conditions,
        pp.gender,
        pp.date_of_birth
      FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.id
      JOIN doctors d ON p.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      JOIN users u_pat ON p.patient_id = u_pat.id
      JOIN slots s ON a.slot_id = s.id
      LEFT JOIN patient_profiles pp ON pp.user_id = p.patient_id
      WHERE p.appointment_id = $1
    `, [id]);

    if (presRes.rows.length === 0) {
      return res.status(404).json({ message: 'Prescription not found for this appointment' });
    }

    const prescription = presRes.rows[0];

    // Authorization check
    const isPatient = prescription.patient_id === req.user.id;
    let isDoctor = false;
    if (req.user.role === 'doctor') {
      const doc = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (doc.rows.length > 0 && doc.rows[0].id === prescription.doctor_id) {
        isDoctor = true;
      }
    }

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to view this prescription' });
    }

    res.json(prescription);
  } catch (err) {
    console.error('Get prescription error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Cancel appointment
// @route DELETE /api/appointments/:id
// @access Private (Patient)
exports.cancelAppointment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // Begin transaction on dedicated client
    await client.query('BEGIN');
    
    const aptRes = await client.query(
      'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 FOR UPDATE',
      [id, req.user.id]
    );

    if (aptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    const apt = aptRes.rows[0];

    await client.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = $1",
      [id]
    );

    // Free the slot in the transaction
    await client.query('UPDATE slots SET is_booked = false WHERE id = $1', [apt.slot_id]);

    await client.query('COMMIT');

    // Notify waitlisted patients immediately that this slot has opened up
    if (apt.slot_id && apt.doctor_id) {
      handleSlotFreed(apt.slot_id, apt.doctor_id, req.app).catch(e => console.error('Waitlist trigger error:', e));
    }

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel appointment error:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};
