const { pool } = require('../config/db');

// @desc Get all verified doctors (with optional filters)
// @route GET /api/doctors
exports.getDoctors = async (req, res) => {
  try {
    const { specialty } = req.query;

    let query = `
      SELECT d.id, u.name, u.email, d.specialty, d.fees, d.experience, d.profile_pic
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (specialty) {
      params.push(`%${specialty}%`);
      query += ` AND d.specialty ILIKE $1`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get doctor's available slots
// @route GET /api/doctors/:id/slots
exports.getDoctorSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // optional date filter

    let query = 'SELECT * FROM slots WHERE doctor_id = $1 AND is_booked = false';
    const params = [id];

    if (date) {
      params.push(date);
      query += ` AND date = $2`;
    }

    // Order by date and time
    query += ' ORDER BY date, start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Update doctor profile
// @route PUT /api/doctors/profile (Doctor only)
exports.updateProfile = async (req, res) => {
  try {
    const { specialty, fees, experience, profile_pic } = req.body;

    // Safe conversion of parameters to null if they are empty/undefined
    const specialtyVal = specialty === undefined || specialty === '' ? null : specialty;
    const feesVal = fees === undefined || fees === '' ? null : parseFloat(fees);
    const experienceVal = experience === undefined || experience === '' ? null : parseInt(experience, 10);
    const profilePicVal = profile_pic === undefined || profile_pic === '' ? null : profile_pic;

    // req.user.id is the user id, we need to find the doctor id
    let result = await pool.query(
      `UPDATE doctors
       SET specialty = COALESCE($1, specialty),
           fees = COALESCE($2, fees),
           experience = COALESCE($3, experience),
           profile_pic = COALESCE($4, profile_pic)
       WHERE user_id = $5 RETURNING *`,
      [specialtyVal, feesVal, experienceVal, profilePicVal, req.user.id]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO doctors (user_id, specialty, fees, experience, profile_pic)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, specialtyVal, feesVal, experienceVal, profilePicVal]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Add availability slots
// @route POST /api/doctor/slots (Doctor only)
exports.addSlots = async (req, res) => {
  try {
    const { date, start_time, end_time } = req.body;

    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await pool.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    const result = await pool.query(
      'INSERT INTO slots (doctor_id, date, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [doctor_id, date, start_time, end_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get doctor's earnings dashboard
// @route GET /api/doctors/earnings (Doctor only)
exports.getEarningsDashboard = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await pool.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    // 1. Total Earnings
    const totalEarningsRes = await pool.query(`
      SELECT SUM(pay.amount) as total
      FROM payments pay
      JOIN appointments a ON pay.appointment_id = a.id
      WHERE a.doctor_id = $1 AND pay.status = 'completed'
    `, [doctor_id]);

    // 2. Booking stats breakdown
    const statsRes = await pool.query(`
      SELECT status, count(*) as count
      FROM appointments
      WHERE doctor_id = $1
      GROUP BY status
    `, [doctor_id]);

    // 3. Recent Payments
    const paymentsRes = await pool.query(`
      SELECT pay.id, pay.amount, pay.created_at, pay.status, pay.payment_method,
             u.name as patient_name, u.email as patient_email, s.date, s.start_time
      FROM payments pay
      JOIN appointments a ON pay.appointment_id = a.id
      JOIN users u ON a.patient_id = u.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.doctor_id = $1
      ORDER BY pay.created_at DESC
      LIMIT 20
    `, [doctor_id]);

    // 4. Monthly Earnings
    const monthlyRes = await pool.query(`
      SELECT TO_CHAR(pay.created_at, 'YYYY-MM') as month, SUM(pay.amount) as revenue
      FROM payments pay
      JOIN appointments a ON pay.appointment_id = a.id
      WHERE a.doctor_id = $1 AND pay.status = 'completed'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `, [doctor_id]);

    res.json({
      totalEarnings: parseFloat(totalEarningsRes.rows[0].total) || 0,
      stats: statsRes.rows,
      payments: paymentsRes.rows,
      monthlyEarnings: monthlyRes.rows.reverse()
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get doctor profile directly
// @route GET /api/doctors/profile (Doctor only)
exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, u.name, u.email, d.specialty, d.fees, d.experience, d.profile_pic
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get logged-in doctor's slots (all slots)
// @route GET /api/doctors/profile/slots (Doctor only)
exports.getMySlots = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const doctor_id = doctorRes.rows[0].id;

    const result = await pool.query(
      'SELECT * FROM slots WHERE doctor_id = $1 ORDER BY date DESC, start_time DESC',
      [doctor_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get my slots error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Delete an unbooked slot
// @route DELETE /api/doctors/slots/:id (Doctor only)
exports.deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;

    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const doctor_id = doctorRes.rows[0].id;

    const slotRes = await pool.query('SELECT * FROM slots WHERE id = $1 AND doctor_id = $2', [id, doctor_id]);
    if (slotRes.rows.length === 0) {
      return res.status(404).json({ message: 'Slot not found or unauthorized' });
    }

    if (slotRes.rows[0].is_booked) {
      return res.status(400).json({ message: 'Cannot delete a slot that is already booked.' });
    }

    await pool.query('DELETE FROM slots WHERE id = $1', [id]);
    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (err) {
    console.error('Delete slot error:', err.message);
    res.status(500).send('Server Error');
  }
};
