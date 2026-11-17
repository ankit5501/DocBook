const crypto = require('crypto');

/**
 * Generates a cryptographically secure 6-digit OTP string.
 * Uses crypto.randomInt to guarantee uniform distribution between 100000 and 999999.
 * 
 * @returns {string} 6-digit numeric OTP
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hashes an OTP using SHA-256 with an environment-based secret salt.
 * Plaintext OTPs must NEVER be persisted in the database or logged.
 * 
 * @param {string} otp - 6-digit OTP string
 * @returns {string} 64-character hexadecimal SHA-256 hash
 */
function hashOtp(otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'docbook_secure_otp_salt_key_2026';
  return crypto
    .createHash('sha256')
    .update(`${otp}:${secret}`)
    .digest('hex');
}

/**
 * Constant-time comparison between user-provided OTP and stored hash.
 * Protects against timing side-channel attacks.
 * 
 * @param {string} providedOtp - OTP supplied by user
 * @param {string} storedHash - Stored hex hash from database
 * @returns {boolean}
 */
function verifyOtpHash(providedOtp, storedHash) {
  if (!providedOtp || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  // Ensure user OTP is cleaned of spaces/hyphens and is 6 digits
  const cleanOtp = String(providedOtp).trim().replace(/\D/g, '');
  if (cleanOtp.length !== 6) {
    return false;
  }

  const computedHash = hashOtp(cleanOtp);

  try {
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (computedBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Formats an email for privacy-conscious client-side display (e.g. a***4@gmail.com).
 * 
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;

  const [name, domain] = parts;
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  const first = name.substring(0, 2);
  const last = name.substring(name.length - 1);
  return `${first}${'*'.repeat(Math.max(2, name.length - 3))}${last}@${domain}`;
}

function getOtpExpiryMinutes() {
  const val = parseInt(process.env.OTP_EXPIRY_MINUTES, 10);
  return Number.isFinite(val) && val > 0 ? val : 5;
}

function getResendCooldownSeconds() {
  const val = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10);
  return Number.isFinite(val) && val > 0 ? val : 60;
}

function getMaxAttempts() {
  const val = parseInt(process.env.OTP_MAX_ATTEMPTS, 10);
  return Number.isFinite(val) && val > 0 ? val : 5;
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  maskEmail,
  getOtpExpiryMinutes,
  getResendCooldownSeconds,
  getMaxAttempts
};

