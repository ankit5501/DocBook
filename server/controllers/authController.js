const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// @desc Register user (patient/doctor/admin)
// @route POST /api/auth/register
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Check if user exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role || 'patient']
    );

    const user = newUser.rows[0];

    // If role is doctor, add entry to doctors table
    if (user.role === 'doctor') {
      await pool.query('INSERT INTO doctors (user_id) VALUES ($1)', [user.id]);
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc Login user
// @route POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ message: 'Your account has been blocked by the administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const jwtSecret = (process.env.JWT_SECRET || '').trim();
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: '30d',
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const { OAuth2Client } = require('google-auth-library');
const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClient = new OAuth2Client(googleClientId);

// @desc Google OAuth Login
// @route POST /api/auth/google
exports.googleAuth = async (req, res) => {
  const { token } = req.body; 
  
  try {
    if (!googleClientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables');
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: googleClientId,
    });
    
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = result.rows[0];

    const jwtSecret = (process.env.JWT_SECRET || '').trim();

    if (!user) {
      // Create new patient
      const dummyPassword = await bcrypt.hash(googleId + jwtSecret, 10);
      const newUser = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_blocked',
        [name, email, dummyPassword, 'patient']
      );
      user = newUser.rows[0];
    }

    if (user.is_blocked) {
      return res.status(403).json({ message: 'Your account has been blocked by the administrator.' });
    }

    const jwtToken = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: '30d',
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: jwtToken
    });
  } catch (err) {
    console.error('Google Auth Error Details:', err);
    res.status(500).json({ message: 'Google Auth Error', details: err.message });
  }
};
