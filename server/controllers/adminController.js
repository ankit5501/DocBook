const { pool } = require('../config/db');

// @desc Get all doctors (with block status)
// @route GET /api/admin/doctors
exports.getAllDoctors = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.name, u.email, u.is_blocked
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Verify a doctor
// @route PATCH /api/admin/doctors/:id/verify
exports.verifyDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified } = req.body; // true or false

    const result = await pool.query(
      'UPDATE doctors SET is_verified = $1 WHERE id = $2 RETURNING *',
      [is_verified, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get dashboard stats and analytics
// @route GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    // 1. Core KPIs
    const totalUsers = await pool.query("SELECT count(*) FROM users WHERE role = 'patient'");
    const totalDoctors = await pool.query('SELECT count(*) FROM doctors');
    const totalAppointments = await pool.query('SELECT count(*) FROM appointments');
    const revenue = await pool.query("SELECT SUM(amount) FROM payments WHERE status = 'completed'");

    // 2. Booking status breakdown
    const statusBreakdown = await pool.query(`
      SELECT status, count(*) as count 
      FROM appointments 
      GROUP BY status
    `);

    // 3. Monthly revenue (past 6 months)
    const monthlyRevenue = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(amount) as revenue
      FROM payments
      WHERE status = 'completed'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `);

    // 4. Monthly bookings (past 6 months)
    const monthlyBookings = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month, count(*) as count
      FROM appointments
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `);

    res.json({
      patients: parseInt(totalUsers.rows[0].count) || 0,
      doctors: parseInt(totalDoctors.rows[0].count) || 0,
      appointments: parseInt(totalAppointments.rows[0].count) || 0,
      revenue: parseFloat(revenue.rows[0].sum) || 0,
      statusBreakdown: statusBreakdown.rows,
      monthlyRevenue: monthlyRevenue.rows.reverse(),
      monthlyBookings: monthlyBookings.rows.reverse()
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get all users (patients and doctors)
// @route GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role, is_blocked, created_at
      FROM users
      WHERE role != 'admin'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Toggle User Block/Unblock status
// @route PATCH /api/admin/users/:id/block
exports.toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot block your own admin account.' });
    }

    const result = await pool.query(
      'UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id, name, email, is_blocked',
      [is_blocked, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get all appointments globally
// @route GET /api/admin/appointments
exports.getAllAppointments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.status, a.payment_status, a.created_at,
             p.name as patient_name, p.email as patient_email,
             d_u.name as doctor_name, d.specialty,
             s.date, s.start_time, s.end_time,
             pay.payment_method
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users d_u ON d.user_id = d_u.id
      JOIN slots s ON a.slot_id = s.id
      LEFT JOIN payments pay ON a.id = pay.appointment_id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Cancel any appointment (Admin)
// @route PATCH /api/admin/appointments/:id/cancel
exports.cancelAppointmentAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('BEGIN');

    const aptRes = await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [id]
    );

    if (aptRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Free the slot associated with this appointment
    await pool.query(
      'UPDATE slots SET is_booked = false WHERE id = $1',
      [aptRes.rows[0].slot_id]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Appointment cancelled successfully by Admin', appointment: aptRes.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
