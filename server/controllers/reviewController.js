const { pool } = require('../config/db');

// @desc Submit a review for a completed appointment
// @route POST /api/reviews
// @access Private (Patient)
exports.addReview = async (req, res) => {
  const { appointment_id, doctor_id, rating, comment } = req.body;
  const patient_id = req.user.id;

  const numRating = parseInt(rating, 10);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
  }

  try {
    // 1. Verify appointment belongs to patient and is completed
    const aptRes = await pool.query(
      'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2',
      [appointment_id, patient_id]
    );

    if (aptRes.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    const appointment = aptRes.rows[0];
    if (appointment.status !== 'completed') {
      return res.status(400).json({ message: 'Reviews can only be submitted for completed consultations' });
    }

    const docId = doctor_id || appointment.doctor_id;

    // Check if review already exists for this appointment
    const existingReview = await pool.query(
      'SELECT id FROM reviews WHERE appointment_id = $1',
      [appointment_id]
    );

    let result;
    if (existingReview.rows.length > 0) {
      result = await pool.query(
        `UPDATE reviews 
         SET rating = $1, comment = $2, created_at = CURRENT_TIMESTAMP 
         WHERE appointment_id = $3 
         RETURNING *`,
        [numRating, comment ? comment.trim() : '', appointment_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO reviews (patient_id, doctor_id, appointment_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [patient_id, docId, appointment_id, numRating, comment ? comment.trim() : '']
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add review error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get reviews for a doctor
// @route GET /api/reviews/doctor/:doctorId
// @access Public
exports.getDoctorReviews = async (req, res) => {
  const { doctorId } = req.params;

  try {
    const reviewsRes = await pool.query(`
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name as patient_name
      FROM reviews r
      JOIN users u ON r.patient_id = u.id
      WHERE r.doctor_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [doctorId]);

    const statsRes = await pool.query(`
      SELECT 
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0) as average_rating,
        COUNT(*) as total_reviews
      FROM reviews
      WHERE doctor_id = $1
    `, [doctorId]);

    res.json({
      average_rating: parseFloat(statsRes.rows[0]?.average_rating || 0),
      total_reviews: parseInt(statsRes.rows[0]?.total_reviews || 0, 10),
      reviews: reviewsRes.rows
    });
  } catch (err) {
    console.error('Get doctor reviews error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get review by appointment ID
// @route GET /api/reviews/appointment/:appointmentId
// @access Private (Patient)
exports.getAppointmentReview = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM reviews WHERE appointment_id = $1 AND patient_id = $2',
      [appointmentId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get appointment review error:', err.message);
    res.status(500).send('Server Error');
  }
};
