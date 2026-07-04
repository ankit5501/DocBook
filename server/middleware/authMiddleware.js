const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized to access this route' });
  }

  try {
    const jwtSecret = (process.env.JWT_SECRET || '').trim();
    const decoded = jwt.verify(token, jwtSecret);

    // Verify if user is blocked in the database
    const userRes = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0 || userRes.rows[0].is_blocked) {
      return res.status(403).json({ message: 'User is blocked or does not exist' });
    }

    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized to access this route' });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user ? req.user.role : 'unknown'} is not authorized` });
    }
    next();
  };
};
