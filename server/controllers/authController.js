const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { validateEmail } = require('../utils/emailValidator');
const {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  maskEmail,
  getOtpExpiryMinutes,
  getResendCooldownSeconds,
  getMaxAttempts
} = require('../utils/otpService');
const { sendOtpEmail } = require('../utils/email');

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClient = new OAuth2Client(googleClientId);

/**
 * Stage A: Registration Initiation
 * @route POST /api/auth/signup (or /api/auth/register)
 */
exports.signup = async (req, res) => {
  const { name, email, password, role } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // 1. Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid full name (at least 2 characters).'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    const assignedRole = role === 'doctor' ? 'doctor' : 'patient';

    // 2. Validate email syntax, disposable blocklist, and DNS mail routing
    const emailValidation = await validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.error
      });
    }

    const normalizedEmail = emailValidation.normalizedEmail;

    // 3. Check for existing registered user
    const existingUser = await pool.query(
      'SELECT id, email, is_verified FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.is_verified) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please sign in instead.'
        });
      }
    }

    // 4. Securely hash password using existing bcrypt config
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Generate secure 6-digit OTP and calculate metadata
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiryMinutes = getOtpExpiryMinutes();
    const cooldownSeconds = getResendCooldownSeconds();
    const maxAttempts = getMaxAttempts();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + cooldownSeconds * 1000);

    // 6. Send OTP via Nodemailer before storing challenge
    // If email delivery fails, we never activate or persist an unverified account
    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      name: name.trim(),
      otp,
      purpose: 'signup',
      expiryMinutes
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: emailResult.error || 'Failed to deliver verification code to your email. Please try again.'
      });
    }

    // 7. Invalidate previous active challenges for this email and purpose
    await pool.query(
      'UPDATE email_verifications SET is_consumed = TRUE WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_consumed = FALSE',
      [normalizedEmail, 'signup']
    );

    // 8. Securely store pending registration information (never store plaintext password)
    await pool.query(
      `INSERT INTO email_verifications 
       (email, otp_hash, name, password_hash, role, purpose, attempts, max_attempts, expires_at, resend_available_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, 'signup', 0, $6, $7, $8, $9)`,
      [
        normalizedEmail,
        otpHash,
        name.trim(),
        hashedPassword,
        assignedRole,
        maxAttempts,
        expiresAt,
        resendAvailableAt,
        ip
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'A 6-digit verification code has been sent to your email address.',
      email: normalizedEmail,
      maskedEmail: maskEmail(normalizedEmail),
      resendCooldown: cooldownSeconds,
      expiresInMinutes: expiryMinutes
    });
  } catch (err) {
    console.error('[AuthController.signup] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while initiating registration. Please try again.'
    });
  }
};

// Backwards-compatible alias for existing frontend calls
exports.register = exports.signup;

/**
 * Stage B: Email Verification & Account Activation
 * @route POST /api/auth/verify-email
 */
exports.verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Both email and 6-digit verification code are required.'
    });
  }

  const cleanOtp = String(otp).trim().replace(/\D/g, '');
  if (cleanOtp.length !== 6) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid 6-digit numeric verification code.'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const client = await pool.connect();
  try {
    // 1. Retrieve the latest active verification challenge
    const challengeRes = await client.query(
      `SELECT * FROM email_verifications 
       WHERE LOWER(email) = LOWER($1) AND purpose = 'signup' AND is_consumed = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (challengeRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code found for this email. Please request a new code or sign up again.'
      });
    }

    const challenge = challengeRes.rows[0];

    // 2. Check expiration
    if (new Date() > new Date(challenge.expires_at)) {
      await client.query(
        'UPDATE email_verifications SET is_consumed = TRUE WHERE id = $1',
        [challenge.id]
      );
      return res.status(400).json({
        success: false,
        message: 'This verification code has expired. Please request a new code.'
      });
    }

    // 3. Check maximum attempt limits
    if (challenge.attempts >= challenge.max_attempts) {
      await client.query(
        'UPDATE email_verifications SET is_consumed = TRUE WHERE id = $1',
        [challenge.id]
      );
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new verification code.'
      });
    }

    // 4. Validate OTP using constant-time comparison
    const isMatch = verifyOtpHash(cleanOtp, challenge.otp_hash);

    if (!isMatch) {
      const updatedAttempts = challenge.attempts + 1;
      const remaining = Math.max(0, challenge.max_attempts - updatedAttempts);

      await client.query(
        'UPDATE email_verifications SET attempts = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [updatedAttempts, challenge.id]
      );

      if (remaining <= 0) {
        await client.query(
          'UPDATE email_verifications SET is_consumed = TRUE WHERE id = $1',
          [challenge.id]
        );
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. Maximum attempts reached. Please request a new code.',
          remainingAttempts: 0
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
        remainingAttempts: remaining
      });
    }

    // 5. Verification successful: perform atomic database activation
    await client.query('BEGIN');

    // Invalidate challenge to prevent replay attacks
    await client.query(
      'UPDATE email_verifications SET is_consumed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [challenge.id]
    );

    // Upsert into users table with is_verified = TRUE and email_verified_at set
    const userRes = await client.query(
      `INSERT INTO users (name, email, password, role, is_verified, email_verified_at)
       VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         is_verified = TRUE,
         email_verified_at = CURRENT_TIMESTAMP
       RETURNING id, name, email, role, is_verified, is_blocked`,
      [
        challenge.name,
        normalizedEmail,
        challenge.password_hash,
        challenge.role || 'patient'
      ]
    );

    const user = userRes.rows[0];

    // If role is doctor, ensure doctor profile entry exists
    if (user.role === 'doctor') {
      await client.query(
        'INSERT INTO doctors (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [user.id]
      );
    }

    // If role is patient, ensure patient profile exists
    if (user.role === 'patient') {
      await client.query(
        'INSERT INTO patient_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [user.id]
      );
    }

    await client.query('COMMIT');

    // Generate JWT token
    const jwtSecret = (process.env.JWT_SECRET || '').trim();
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: '30d'
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to DocBook.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AuthController.verifyEmail] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete email verification. Please try again.'
    });
  } finally {
    client.release();
  }
};

/**
 * Resend OTP with strict 60-second cooldown
 * @route POST /api/auth/resend-otp
 */
exports.resendOtp = async (req, res) => {
  const { email, purpose = 'signup' } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required to resend verification code.'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Find the latest challenge for this email and purpose
    const challengeRes = await pool.query(
      `SELECT * FROM email_verifications 
       WHERE LOWER(email) = LOWER($1) AND purpose = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, purpose]
    );

    if (challengeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending verification request found for this email. Please sign up or request a reset.'
      });
    }

    const challenge = challengeRes.rows[0];

    // 2. Check 60-second resend cooldown
    const now = new Date();
    if (now < new Date(challenge.resend_available_at)) {
      const secondsLeft = Math.ceil((new Date(challenge.resend_available_at) - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${secondsLeft} second${secondsLeft > 1 ? 's' : ''} before requesting another code.`,
        secondsLeft
      });
    }

    // 3. Generate new secure OTP
    const newOtp = generateOtp();
    const newOtpHash = hashOtp(newOtp);
    const expiryMinutes = getOtpExpiryMinutes();
    const cooldownSeconds = getResendCooldownSeconds();
    const maxAttempts = getMaxAttempts();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + cooldownSeconds * 1000);

    // 4. Send email before updating database
    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      name: challenge.name,
      otp: newOtp,
      purpose,
      expiryMinutes
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: emailResult.error || 'Failed to deliver verification code. Please try again later.'
      });
    }

    // 5. Invalidate previous active challenges
    await pool.query(
      'UPDATE email_verifications SET is_consumed = TRUE WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_consumed = FALSE',
      [normalizedEmail, purpose]
    );

    // 6. Insert new challenge
    await pool.query(
      `INSERT INTO email_verifications 
       (email, otp_hash, name, password_hash, role, purpose, attempts, max_attempts, expires_at, resend_available_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10)`,
      [
        normalizedEmail,
        newOtpHash,
        challenge.name,
        challenge.password_hash,
        challenge.role,
        purpose,
        maxAttempts,
        expiresAt,
        resendAvailableAt,
        ip
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
      email: normalizedEmail,
      maskedEmail: maskEmail(normalizedEmail),
      resendCooldown: cooldownSeconds,
      expiresInMinutes: expiryMinutes
    });
  } catch (err) {
    console.error('[AuthController.resendOtp] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend verification code. Please try again.'
    });
  }
};

/**
 * Login user (strictly requires verified account)
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Both email and password are required.'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.is_blocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by the administrator.'
      });
    }

    // Phase 7: Strict verification check
    if (user.is_verified === false) {
      return res.status(403).json({
        success: false,
        message: 'Your email address is not verified. Please verify your email before logging in.',
        unverified: true,
        email: user.email,
        maskedEmail: maskEmail(user.email)
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const jwtSecret = (process.env.JWT_SECRET || '').trim();
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: '30d'
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('[AuthController.login] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
  }
};

/**
 * Forgot password initiation
 * Sends password reset OTP to verified account without leaking user existence
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your registered email address.'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const userRes = await pool.query(
      'SELECT id, name, email, is_verified, is_blocked FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    // Generic response to prevent user enumeration
    const genericResponse = {
      success: true,
      message: 'If an active account exists with that email, a password reset code has been sent.',
      email: normalizedEmail,
      maskedEmail: maskEmail(normalizedEmail)
    };

    if (userRes.rows.length === 0) {
      return res.status(200).json(genericResponse);
    }

    const user = userRes.rows[0];
    if (user.is_blocked || !user.is_verified) {
      return res.status(200).json(genericResponse);
    }

    // Generate password reset OTP
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiryMinutes = getOtpExpiryMinutes();
    const cooldownSeconds = getResendCooldownSeconds();
    const maxAttempts = getMaxAttempts();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + cooldownSeconds * 1000);

    // Send email
    await sendOtpEmail({
      to: normalizedEmail,
      name: user.name,
      otp,
      purpose: 'password_reset',
      expiryMinutes
    });

    // Invalidate existing reset challenges
    await pool.query(
      'UPDATE email_verifications SET is_consumed = TRUE WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_consumed = FALSE',
      [normalizedEmail, 'password_reset']
    );

    // Save reset challenge
    await pool.query(
      `INSERT INTO email_verifications
       (email, otp_hash, name, role, purpose, attempts, max_attempts, expires_at, resend_available_at, ip_address)
       VALUES ($1, $2, $3, $4, 'password_reset', 0, $5, $6, $7, $8)`,
      [
        normalizedEmail,
        otpHash,
        user.name,
        user.role,
        maxAttempts,
        expiresAt,
        resendAvailableAt,
        ip
      ]
    );

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('[AuthController.forgotPassword] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing password reset.'
    });
  }
};

/**
 * Reset password using OTP
 * @route POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, verification code, and new password are all required.'
    });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.'
    });
  }

  const cleanOtp = String(otp).trim().replace(/\D/g, '');
  const normalizedEmail = email.trim().toLowerCase();

  const client = await pool.connect();
  try {
    const challengeRes = await client.query(
      `SELECT * FROM email_verifications 
       WHERE LOWER(email) = LOWER($1) AND purpose = 'password_reset' AND is_consumed = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );

    if (challengeRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active password reset request found. Please request a new reset code.'
      });
    }

    const challenge = challengeRes.rows[0];

    if (new Date() > new Date(challenge.expires_at)) {
      await client.query('UPDATE email_verifications SET is_consumed = TRUE WHERE id = $1', [challenge.id]);
      return res.status(400).json({
        success: false,
        message: 'Password reset code has expired. Please request a new one.'
      });
    }

    if (challenge.attempts >= challenge.max_attempts) {
      await client.query('UPDATE email_verifications SET is_consumed = TRUE WHERE id = $1', [challenge.id]);
      return res.status(429).json({
        success: false,
        message: 'Maximum attempts exceeded. Please request a new password reset code.'
      });
    }

    const isMatch = verifyOtpHash(cleanOtp, challenge.otp_hash);
    if (!isMatch) {
      const updatedAttempts = challenge.attempts + 1;
      const remaining = Math.max(0, challenge.max_attempts - updatedAttempts);

      await client.query(
        'UPDATE email_verifications SET attempts = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [updatedAttempts, challenge.id]
      );

      return res.status(400).json({
        success: false,
        message: `Invalid reset code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
      });
    }

    // Atomic update
    await client.query('BEGIN');

    await client.query('UPDATE email_verifications SET is_consumed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [challenge.id]);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await client.query(
      'UPDATE users SET password = $1 WHERE LOWER(email) = LOWER($2)',
      [hashedPassword, normalizedEmail]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Password reset successful! You may now sign in with your new password.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AuthController.resetPassword] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.'
    });
  } finally {
    client.release();
  }
};

/**
 * Google OAuth Login
 * @route POST /api/auth/google
 */
exports.googleAuth = async (req, res) => {
  const { token } = req.body;

  try {
    if (!googleClientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables');
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: googleClientId
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    let result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    let user = result.rows[0];

    const jwtSecret = (process.env.JWT_SECRET || '').trim();

    if (!user) {
      // Create new patient with is_verified = TRUE since Google has already verified email ownership
      const dummyPassword = await bcrypt.hash(googleId + jwtSecret, 10);
      const newUser = await pool.query(
        `INSERT INTO users (name, email, password, role, is_verified, email_verified_at)
         VALUES ($1, $2, $3, 'patient', TRUE, CURRENT_TIMESTAMP)
         RETURNING id, name, email, role, is_blocked, is_verified`,
        [name, normalizedEmail, dummyPassword]
      );
      user = newUser.rows[0];

      // Ensure patient profile entry
      await pool.query(
        'INSERT INTO patient_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [user.id]
      );
    } else if (!user.is_verified) {
      // If user existed as unverified, Google login verifies them
      await pool.query(
        'UPDATE users SET is_verified = TRUE, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      user.is_verified = true;
    }

    if (user.is_blocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by the administrator.'
      });
    }

    const jwtToken = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: '30d'
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: jwtToken
    });
  } catch (err) {
    console.error('Google Auth Error Details:', err);
    return res.status(500).json({
      success: false,
      message: 'Google Authentication failed',
      details: err.message
    });
  }
};
