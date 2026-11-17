import { useState, useContext, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

const Register = () => {
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
  });

  // Real-time validation states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP Verification States
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [expirySeconds, setExpirySeconds] = useState(300); // 5 minutes
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpInputsRef = useRef([]);
  const { initiateSignup, verifyEmailOtp, resendOtp, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  // 60-second Resend Cooldown Countdown
  useEffect(() => {
    let timer;
    if (step === 'otp' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // 5-minute OTP Expiration Countdown
  useEffect(() => {
    let timer;
    if (step === 'otp' && expirySeconds > 0) {
      timer = setInterval(() => {
        setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, expirySeconds]);

  // Auto-focus first OTP input when transitioning to OTP step
  useEffect(() => {
    if (step === 'otp' && otpInputsRef.current[0]) {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Real-time Email Syntax Validation
  const validateEmailRealtime = (val) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) {
      setEmailError('');
    } else if (!emailRegex.test(val)) {
      setEmailError('Please enter a valid email format (e.g. name@domain.com)');
    } else {
      setEmailError('');
    }
  };

  // Real-time Password Strength Validation
  const validatePasswordRealtime = (val) => {
    if (!val) {
      setPasswordError('');
    } else if (val.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
    } else {
      setPasswordError('');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setGeneralError('');

    if (name === 'email') validateEmailRealtime(value);
    if (name === 'password') validatePasswordRealtime(value);
  };

  const setRole = (roleValue) => {
    setFormData((prev) => ({ ...prev, role: roleValue }));
  };

  // Stage A: Submit Registration Form & Request OTP
  const handleInitiateSignup = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setGeneralError('Please enter a valid full name (at least 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setGeneralError('Please enter a valid email address.');
      return;
    }

    if (formData.password.length < 8) {
      setGeneralError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    const res = await initiateSignup(
      formData.name.trim(),
      formData.email.trim(),
      formData.password,
      formData.role
    );
    setIsSubmitting(false);

    if (res.success) {
      setMaskedEmail(res.maskedEmail || formData.email);
      setResendCooldown(res.resendCooldown || 60);
      setExpirySeconds((res.expiresInMinutes || 5) * 60);
      setRemainingAttempts(5);
      setOtpValues(['', '', '', '', '', '']);
      setStep('otp');
      toast.success('Verification code sent! Please check your email.');
    } else {
      setGeneralError(res.message);
    }
  };

  // Handle individual OTP input changes with auto-focus navigation
  const handleOtpChange = (index, value) => {
    // Keep only the last character if multiple are entered
    const numericChar = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = numericChar;
    setOtpValues(newOtp);
    setGeneralError('');

    // Auto-focus next input
    if (numericChar && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation between OTP input boxes
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpValues[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    }
  };

  // Support pasting full 6-digit OTP code into any input
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (pasteData.length > 0) {
      const digits = pasteData.slice(0, 6).split('');
      const newOtp = ['', '', '', '', '', ''];
      digits.forEach((digit, i) => {
        newOtp[i] = digit;
      });
      setOtpValues(newOtp);

      // Focus the next empty box or the last box
      const nextFocus = Math.min(digits.length, 5);
      otpInputsRef.current[nextFocus]?.focus();

      // If full 6 digits were pasted, optionally auto-verify or let user click
      if (digits.length === 6) {
        setGeneralError('');
      }
    }
  };

  // Stage B: Verify OTP & Activate Account
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      setGeneralError('Please enter all 6 digits of your verification code.');
      return;
    }

    if (expirySeconds <= 0) {
      setGeneralError('This verification code has expired. Please request a new code.');
      return;
    }

    setIsVerifying(true);
    setGeneralError('');

    const res = await verifyEmailOtp(formData.email.trim(), fullOtp);
    setIsVerifying(false);

    if (res.success) {
      toast.success('Email verified successfully! Welcome to DocBook.');
      navigate('/dashboard');
    } else {
      setGeneralError(res.message);
      if (typeof res.remainingAttempts === 'number') {
        setRemainingAttempts(res.remainingAttempts);
      }
    }
  };

  // Resend OTP Action
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setGeneralError('');

    const res = await resendOtp(formData.email.trim(), 'signup');
    setIsResending(false);

    if (res.success) {
      setResendCooldown(res.resendCooldown || 60);
      setExpirySeconds(300);
      setRemainingAttempts(5);
      setOtpValues(['', '', '', '', '', '']);
      otpInputsRef.current[0]?.focus();
      toast.success('A new verification code has been sent to your email.');
    } else {
      setGeneralError(res.message);
    }
  };

  // Google OAuth Success Handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setIsSubmitting(true);
    const res = await googleLogin(credentialResponse.credential);
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Signed in with Google successfully!');
      navigate('/dashboard');
    } else {
      setGeneralError(res.message);
    }
  };

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50">
      <div className="max-w-md w-full space-y-7 bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-2xl border border-gray-200 shadow-xl relative z-10 transition-all duration-300">
        
        {/* ================= STEP 1: REGISTRATION FORM ================= */}
        {step === 'form' && (
          <>
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                Join DocBook Network
              </span>
              <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                Create an Account
              </h2>
              <p className="text-xs text-gray-500 font-semibold mt-1">
                Verified healthcare appointment booking
              </p>
            </div>

            {/* Google Authentication */}
            <div className="mt-5 flex justify-center">
              <div className="w-full max-w-[280px]">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setGeneralError('Google Login Failed')}
                />
              </div>
            </div>

            {/* Separator */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-black">
                <span className="px-3 bg-white text-gray-400">Or register with email</span>
              </div>
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={handleInitiateSignup} noValidate>
              {generalError && (
                <div className="text-red-700 text-xs text-center bg-red-50 border border-red-200 p-3 rounded-lg font-bold">
                  {generalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1.5 appearance-none block w-full px-4 py-2.5 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition"
                  placeholder="Dr. John Smith or Jane Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className={`mt-1.5 appearance-none block w-full px-4 py-2.5 border ${
                    emailError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                  } placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 text-sm font-medium transition`}
                  placeholder="you@domain.com"
                  value={formData.email}
                  onChange={handleChange}
                />
                {emailError ? (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">{emailError}</p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">
                    We will send a 6-digit verification code to confirm ownership.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className={`mt-1.5 appearance-none block w-full px-4 py-2.5 border ${
                    passwordError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                  } placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 text-sm font-medium transition`}
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                />
                {passwordError && (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">{passwordError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  I am registering as a:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setRole('patient')}
                    className={`cursor-pointer rounded-lg border p-3 text-center font-bold text-xs uppercase tracking-wider select-none transition ${
                      formData.role === 'patient'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-extrabold shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    🏥 Patient
                  </div>
                  <div
                    onClick={() => setRole('doctor')}
                    className={`cursor-pointer rounded-lg border p-3 text-center font-bold text-xs uppercase tracking-wider select-none transition ${
                      formData.role === 'doctor'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-extrabold shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    🩺 Doctor
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !!emailError || !!passwordError}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-950 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shadow transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending Code...
                    </span>
                  ) : (
                    'Continue with Email Verification'
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500 font-medium">
                  Already have an account?{' '}
                  <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-800 transition">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          </>
        )}

        {/* ================= STEP 2: OTP VERIFICATION ================= */}
        {step === 'otp' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Check Your Inbox
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                We sent a 6-digit verification code to
              </p>
              <p className="text-xs font-bold text-indigo-900 bg-indigo-50 py-1 px-2.5 rounded-md inline-block mt-1">
                {maskedEmail}
              </p>
            </div>

            {generalError && (
              <div className="text-red-700 text-xs text-center bg-red-50 border border-red-200 p-3 rounded-lg font-bold">
                {generalError}
              </div>
            )}

            {/* 6-Digit OTP Input Grid */}
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-between gap-2 sm:gap-3">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    aria-label={`Digit ${idx + 1}`}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-extrabold rounded-lg border ${
                      val ? 'border-indigo-600 bg-indigo-50/30 text-indigo-950 ring-1 ring-indigo-500' : 'border-gray-300 bg-white text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition`}
                  />
                ))}
              </div>

              {/* Countdown & Status row */}
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 px-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${expirySeconds > 60 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                  <span>Code expires in:</span>
                  <span className="font-mono font-bold text-gray-700">
                    {formatTime(expirySeconds)}
                  </span>
                </div>

                <div className="text-gray-400">
                  {remainingAttempts < 5 && (
                    <span className="text-amber-700 font-semibold">
                      {remainingAttempts} attempt{remainingAttempts > 1 ? 's' : ''} left
                    </span>
                  )}
                </div>
              </div>

              {/* Submit CTA */}
              <div>
                <button
                  type="submit"
                  disabled={isVerifying || otpValues.join('').length !== 6 || expirySeconds <= 0}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-950 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shadow transition cursor-pointer"
                >
                  {isVerifying ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Verifying & Activating...
                    </span>
                  ) : (
                    'Verify & Complete Registration'
                  )}
                </button>
              </div>

              {/* Resend & Edit links */}
              <div className="pt-2 border-t border-gray-100 flex flex-col items-center gap-2 text-xs">
                <div>
                  {resendCooldown > 0 ? (
                    <span className="text-gray-400 font-medium">
                      Resend code in <strong className="text-gray-600">{resendCooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending}
                      className="font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    >
                      {isResending ? 'Sending new code...' : 'Resend verification code'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setGeneralError('');
                  }}
                  className="text-gray-400 hover:text-gray-700 transition font-medium"
                >
                  &larr; Change email address
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default Register;
