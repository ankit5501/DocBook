const { pool } = require('../config/db');

// @desc Get doctors with advanced search & filters (fee, experience, today/tomorrow availability, ratings, sorting)
// @route GET /api/doctors
exports.getDoctors = async (req, res) => {
  try {
    const { 
      specialty, 
      min_fee, 
      max_fee, 
      min_experience, 
      available, 
      min_rating, 
      sort 
    } = req.query;

    let query = `
      SELECT 
        d.id, 
        u.name, 
        u.email, 
        d.specialty, 
        d.fees, 
        d.experience, 
        d.profile_pic,
        d.is_verified,
        COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating,
        COUNT(DISTINCT r.id) AS total_reviews,
        (
          SELECT MIN(s.date) 
          FROM slots s 
          WHERE s.doctor_id = d.id 
            AND s.is_booked = false 
            AND s.date >= CURRENT_DATE
        ) AS next_available_date,
        (
          SELECT COUNT(*) 
          FROM slots s 
          WHERE s.doctor_id = d.id 
            AND s.is_booked = false 
            AND s.date = CURRENT_DATE
        ) AS today_slots_count,
        (
          SELECT COUNT(*) 
          FROM slots s 
          WHERE s.doctor_id = d.id 
            AND s.is_booked = false 
            AND s.date = (CURRENT_DATE + INTERVAL '1 day')::date
        ) AS tomorrow_slots_count
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN reviews r ON r.doctor_id = d.id
      WHERE (u.is_blocked IS NULL OR u.is_blocked = false)
    `;
    const params = [];

    if (specialty && specialty.trim()) {
      params.push(`%${specialty.trim()}%`);
      query += ` AND d.specialty ILIKE $${params.length}`;
    }

    if (min_fee !== undefined && min_fee !== '') {
      params.push(parseFloat(min_fee));
      query += ` AND d.fees >= $${params.length}`;
    }

    if (max_fee !== undefined && max_fee !== '') {
      params.push(parseFloat(max_fee));
      query += ` AND d.fees <= $${params.length}`;
    }

    if (min_experience !== undefined && min_experience !== '') {
      params.push(parseInt(min_experience, 10));
      query += ` AND d.experience >= $${params.length}`;
    }

    if (available === 'today') {
      query += ` AND EXISTS (SELECT 1 FROM slots s WHERE s.doctor_id = d.id AND s.is_booked = false AND s.date = CURRENT_DATE)`;
    } else if (available === 'tomorrow') {
      query += ` AND EXISTS (SELECT 1 FROM slots s WHERE s.doctor_id = d.id AND s.is_booked = false AND s.date = (CURRENT_DATE + INTERVAL '1 day')::date)`;
    }

    query += `
      GROUP BY d.id, u.name, u.email, d.specialty, d.fees, d.experience, d.profile_pic, d.is_verified
    `;

    if (min_rating !== undefined && min_rating !== '' && parseFloat(min_rating) > 0) {
      params.push(parseFloat(min_rating));
      query += ` HAVING COALESCE(AVG(r.rating), 0) >= $${params.length}`;
    }

    // Dynamic sorting
    if (sort === 'fee_asc') {
      query += ` ORDER BY d.fees ASC NULLS LAST, d.id`;
    } else if (sort === 'fee_desc') {
      query += ` ORDER BY d.fees DESC NULLS LAST, d.id`;
    } else if (sort === 'experience_desc') {
      query += ` ORDER BY d.experience DESC NULLS LAST, d.id`;
    } else if (sort === 'rating_desc') {
      query += ` ORDER BY average_rating DESC, total_reviews DESC, d.id`;
    } else {
      query += ` ORDER BY (
        (SELECT MIN(s.date) FROM slots s WHERE s.doctor_id = d.id AND s.is_booked = false AND s.date >= CURRENT_DATE) IS NULL
      ), average_rating DESC, d.id`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getDoctors error:', err.message);
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

// @desc Get aggregated doctor dashboard stats (Today's & Overall metrics, schedule & Recharts analytics from REAL database)
// @route GET /api/doctors/dashboard-stats (Doctor only)
exports.getDashboardStats = async (req, res) => {
  try {
    let doctorRes = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
    if (doctorRes.rows.length === 0) {
      doctorRes = await pool.query('INSERT INTO doctors (user_id) VALUES ($1) RETURNING id', [req.user.id]);
    }
    const doctor_id = doctorRes.rows[0].id;

    // 1. Today's Overview Aggregation Metrics
    const todaysOverviewRes = await pool.query(`
      SELECT 
        COUNT(a.id) AS todays_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS todays_completed,
        COUNT(CASE WHEN a.status IN ('pending', 'accepted') THEN 1 END) AS todays_pending,
        COALESCE(SUM(CASE WHEN pay.status = 'completed' THEN pay.amount ELSE 0 END), 0) AS todays_revenue
      FROM appointments a
      JOIN slots s ON a.slot_id = s.id
      LEFT JOIN payments pay ON pay.appointment_id = a.id
      WHERE a.doctor_id = $1 AND s.date = CURRENT_DATE
    `, [doctor_id]);

    // 2. Overall Doctor Overview Metrics (All-time totals for doctor)
    const overallOverviewRes = await pool.query(`
      SELECT 
        COUNT(a.id) AS total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS total_completed,
        COUNT(CASE WHEN a.status IN ('pending', 'accepted') THEN 1 END) AS total_pending,
        COALESCE(SUM(CASE WHEN pay.status = 'completed' THEN pay.amount ELSE 0 END), 0) AS total_revenue
      FROM appointments a
      LEFT JOIN payments pay ON pay.appointment_id = a.id
      WHERE a.doctor_id = $1
    `, [doctor_id]);

    // 3. Today's Schedule List (Real appointments for CURRENT_DATE)
    const todaysScheduleRes = await pool.query(`
      SELECT 
        a.id,
        a.patient_id,
        a.status,
        a.payment_status,
        a.appointment_type,
        a.meeting_room_id,
        s.date,
        s.start_time,
        s.end_time,
        u.name AS patient_name,
        u.email AS patient_email,
        pr.id AS prescription_id
      FROM appointments a
      JOIN slots s ON a.slot_id = s.id
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
      WHERE a.doctor_id = $1 AND s.date = CURRENT_DATE
      ORDER BY s.start_time ASC
    `, [doctor_id]);

    // 4. All Real Booked Appointments for this Doctor
    const allScheduleRes = await pool.query(`
      SELECT 
        a.id,
        a.patient_id,
        a.status,
        a.payment_status,
        a.appointment_type,
        a.meeting_room_id,
        s.date,
        s.start_time,
        s.end_time,
        u.name AS patient_name,
        u.email AS patient_email,
        pr.id AS prescription_id
      FROM appointments a
      JOIN slots s ON a.slot_id = s.id
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
      WHERE a.doctor_id = $1
      ORDER BY s.date DESC, s.start_time ASC
    `, [doctor_id]);

    // 5. Appointments Per Day (Real SQL Aggregation)
    const appointmentsPerDayRes = await pool.query(`
      SELECT 
        TO_CHAR(s.date, 'Mon DD') AS day_label,
        s.date AS full_date,
        COUNT(a.id) AS appointments_count,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_count,
        COUNT(CASE WHEN a.status IN ('cancelled', 'rejected') THEN 1 END) AS cancelled_count
      FROM appointments a
      JOIN slots s ON a.slot_id = s.id
      WHERE a.doctor_id = $1
      GROUP BY s.date
      ORDER BY s.date ASC
    `, [doctor_id]);

    // 6. Revenue Per Week (Real SQL Aggregation)
    const revenuePerWeekRes = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('week', pay.created_at), 'DD Mon') AS week_label,
        DATE_TRUNC('week', pay.created_at) AS week_start,
        COALESCE(SUM(pay.amount), 0) AS revenue
      FROM payments pay
      JOIN appointments a ON pay.appointment_id = a.id
      WHERE a.doctor_id = $1 AND pay.status = 'completed'
      GROUP BY DATE_TRUNC('week', pay.created_at)
      ORDER BY DATE_TRUNC('week', pay.created_at) ASC
      LIMIT 8
    `, [doctor_id]);

    // 7. Status Breakdown Aggregation (Real SQL Aggregation)
    const statusBreakdownRes = await pool.query(`
      SELECT 
        status,
        COUNT(*) AS count
      FROM appointments
      WHERE doctor_id = $1
      GROUP BY status
    `, [doctor_id]);

    // 8. Patient Statistics Aggregation (Real SQL Aggregation)
    const patientStatsRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT patient_id) AS total_patients,
        COUNT(CASE WHEN visit_count = 1 THEN 1 END) AS new_patients,
        COUNT(CASE WHEN visit_count > 1 THEN 1 END) AS returning_patients
      FROM (
        SELECT patient_id, COUNT(*) AS visit_count
        FROM appointments
        WHERE doctor_id = $1
        GROUP BY patient_id
      ) patient_counts
    `, [doctor_id]);

    // 9. Top Real Patients list
    const topPatientsRes = await pool.query(`
      SELECT 
        u.name AS patient_name,
        u.email AS patient_email,
        COUNT(a.id) AS visit_count,
        COALESCE(SUM(CASE WHEN pay.status = 'completed' THEN pay.amount ELSE 0 END), 0) AS total_spent
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN payments pay ON pay.appointment_id = a.id
      WHERE a.doctor_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY visit_count DESC, total_spent DESC
      LIMIT 5
    `, [doctor_id]);

    const overview = todaysOverviewRes.rows[0] || {};
    const overall = overallOverviewRes.rows[0] || {};

    const todaysAppointments = parseInt(overview.todays_appointments || 0, 10);
    const todaysCompleted = parseInt(overview.todays_completed || 0, 10);
    const todaysPending = parseInt(overview.todays_pending || 0, 10);
    const todaysRevenue = parseFloat(overview.todays_revenue || 0);

    const totalAppointments = parseInt(overall.total_appointments || 0, 10);
    const totalCompleted = parseInt(overall.total_completed || 0, 10);
    const totalPending = parseInt(overall.total_pending || 0, 10);
    const totalRevenue = parseFloat(overall.total_revenue || 0);

    res.json({
      todaysOverview: {
        todaysAppointments,
        todaysCompleted,
        todaysPending,
        todaysRevenue
      },
      overallOverview: {
        totalAppointments,
        totalCompleted,
        totalPending,
        totalRevenue
      },
      todaysSchedule: todaysScheduleRes.rows,
      allSchedule: allScheduleRes.rows,
      appointmentsPerDay: appointmentsPerDayRes.rows.map(row => ({
        day: row.day_label,
        appointments: parseInt(row.appointments_count, 10),
        completed: parseInt(row.completed_count, 10),
        cancelled: parseInt(row.cancelled_count, 10)
      })),
      revenuePerWeek: revenuePerWeekRes.rows.map(row => ({
        week: row.week_label,
        revenue: parseFloat(row.revenue)
      })),
      statusBreakdown: statusBreakdownRes.rows.map(row => ({
        name: row.status,
        value: parseInt(row.count, 10)
      })),
      patientStats: {
        totalPatients: parseInt(patientStatsRes.rows[0]?.total_patients || 0, 10),
        newPatients: parseInt(patientStatsRes.rows[0]?.new_patients || 0, 10),
        returningPatients: parseInt(patientStatsRes.rows[0]?.returning_patients || 0, 10),
        topPatients: topPatientsRes.rows.map(p => ({
          name: p.patient_name,
          email: p.patient_email,
          visits: parseInt(p.visit_count, 10),
          spent: parseFloat(p.total_spent)
        }))
      }
    });

  } catch (err) {
    console.error('Error in getDashboardStats:', err.message);
    res.status(500).send('Server Error');
  }
};

const { matchDoctors } = require('../services/doctorMatchingService');

// @desc Smart Doctor Matching based on patient symptoms, budget, urgency & clinical needs
// @route POST /api/doctors/smart-match
// @access Public
exports.getSmartMatchDoctors = async (req, res) => {
  try {
    const preferences = req.body || {};
    const result = await matchDoctors(preferences);
    res.json(result);
  } catch (err) {
    console.error('getSmartMatchDoctors error:', err.message);
    res.status(500).send('Server Error');
  }
};





