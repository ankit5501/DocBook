const express = require('express');
const router = express.Router();
const {
  signup,
  register,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  googleAuth
} = require('../controllers/authController');

const {
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter
} = require('../middleware/rateLimiter');

// Stage A: Initiate signup / send OTP
router.post('/signup', otpRequestLimiter, signup);
router.post('/register', otpRequestLimiter, register); // Backward-compatible alias

// Stage B: Verify OTP & activate account
router.post('/verify-email', otpVerifyLimiter, verifyEmail);

// Resend OTP with strict 60s cooldown
router.post('/resend-otp', otpRequestLimiter, resendOtp);

// Login (strictly verified users only)
router.post('/login', loginLimiter, login);

// Password Reset Flow
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/reset-password', otpVerifyLimiter, resetPassword);

// Google OAuth
router.post('/google', googleAuth);

module.exports = router;
