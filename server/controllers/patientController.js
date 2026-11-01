const { pool } = require('../config/db');

// @desc Get current patient's medical profile
// @route GET /api/patient/profile
// @access Private (Patient)
exports.getProfile = async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userRes.rows[0];

    const profileRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0] || {
      user_id: user.id,
      blood_group: '',
      height: '',
      weight: '',
      allergies: '',
      chronic_conditions: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      gender: '',
      date_of_birth: ''
    };

    res.json({
      ...profile,
      name: user.name,
      email: user.email
    });
  } catch (err) {
    console.error('Get patient profile error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Create or update patient's medical profile
// @route PUT /api/patient/profile
// @access Private (Patient)
exports.updateProfile = async (req, res) => {
  try {
    const {
      blood_group,
      height,
      weight,
      allergies,
      chronic_conditions,
      emergency_contact_name,
      emergency_contact_phone,
      gender,
      date_of_birth
    } = req.body;

    const heightVal = height === '' || height === null || height === undefined ? null : parseFloat(height);
    const weightVal = weight === '' || weight === null || weight === undefined ? null : parseFloat(weight);
    const dobVal = date_of_birth === '' || date_of_birth === null || date_of_birth === undefined ? null : date_of_birth;

    const query = `
      INSERT INTO patient_profiles (
        user_id,
        blood_group,
        height,
        weight,
        allergies,
        chronic_conditions,
        emergency_contact_name,
        emergency_contact_phone,
        gender,
        date_of_birth,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        blood_group = EXCLUDED.blood_group,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        allergies = EXCLUDED.allergies,
        chronic_conditions = EXCLUDED.chronic_conditions,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        gender = EXCLUDED.gender,
        date_of_birth = EXCLUDED.date_of_birth,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, [
      req.user.id,
      blood_group || null,
      heightVal,
      weightVal,
      allergies || null,
      chronic_conditions || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      gender || null,
      dobVal
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update patient profile error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Get patient profile by patient ID (for Doctors & Admins)
// @route GET /api/patient/profile/:patientId
// @access Private (Doctor, Admin)
exports.getPatientProfileById = async (req, res) => {
  try {
    const { patientId } = req.params;

    const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [patientId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    const user = userRes.rows[0];

    const profileRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [patientId]);
    const profile = profileRes.rows[0] || {};

    // Also fetch recent consultation history for this patient
    const historyRes = await pool.query(`
      SELECT 
        a.id, 
        a.status, 
        s.date, 
        s.start_time, 
        s.end_time, 
        u_doc.name as doctor_name, 
        d.specialty,
        pr.diagnosis
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      JOIN slots s ON a.slot_id = s.id
      LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
      WHERE a.patient_id = $1
      ORDER BY s.date DESC
      LIMIT 5
    `, [patientId]);

    res.json({
      ...profile,
      name: user.name,
      email: user.email,
      recentHistory: historyRes.rows
    });
  } catch (err) {
    console.error('Get patient profile by ID error:', err.message);
    res.status(500).send('Server Error');
  }
};
