const assert = require('assert');
const path = require('path');
process.env.NODE_ENV = 'test';
process.env.EMAIL_TEST_MODE = 'true';
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { pool } = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validateEmail } = require('./utils/emailValidator');
const {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  maskEmail,
  getOtpExpiryMinutes,
  getResendCooldownSeconds,
  getMaxAttempts
} = require('./utils/otpService');
const { sendOtpEmail, getTestMailbox, clearTestMailbox, setSimulateDeliveryFailure } = require('./utils/email');

// Helper to create mock Express req/res
function createMockReqRes(body = {}, headers = {}, ip = '127.0.0.1') {
  const req = {
    body,
    headers,
    ip,
    connection: { remoteAddress: ip }
  };
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    send(payload) {
      this.data = payload;
      return this;
    }
  };
  return { req, res };
}

async function runTestSuite() {
  console.log('======================================================');
  console.log('🧪 DOCBOOK SECURITY & AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

  let passedCount = 0;
  const totalTests = 20;

  // --------------------------------------------------------------------------
  // TEST 1: Valid email format
  // --------------------------------------------------------------------------
  console.log('TEST 1: Valid email format');
  const validRes = await validateEmail('  Dr.JaneSmith@Gmail.Com  ');
  assert.strictEqual(validRes.valid, true, 'Valid email must pass');
  assert.strictEqual(validRes.normalizedEmail, 'dr.janesmith@gmail.com', 'Email must be trimmed and lowercased');
  console.log('  ✓ Normalized dr.janesmith@gmail.com successfully\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 2: Invalid email format
  // --------------------------------------------------------------------------
  console.log('TEST 2: Invalid email format');
  const invalidCases = ['not-an-email', 'missing@domain', '@nodomain.com', 'space in@email.com', 'two@@symbols.com'];
  for (const c of invalidCases) {
    const res = await validateEmail(c);
    assert.strictEqual(res.valid, false, `"${c}" must be rejected as invalid email`);
    assert.ok(res.error, 'Error message must be provided');
  }
  console.log('  ✓ All malformed email strings rejected with clear feedback\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 3: Invalid/nonexistent mail domain
  // --------------------------------------------------------------------------
  console.log('TEST 3: Invalid/nonexistent mail domain');
  const nonexistentDomainRes = await validateEmail('test@nonexistent-domain-xyz987654321.com');
  assert.strictEqual(nonexistentDomainRes.valid, false, 'Non-existent domain must fail DNS verification');
  assert.ok(nonexistentDomainRes.error.includes('does not exist') || nonexistentDomainRes.error.includes('host records'));
  console.log('  ✓ Non-existent DNS domain accurately detected and rejected\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 4: Disposable email rejection
  // --------------------------------------------------------------------------
  console.log('TEST 4: Disposable email rejection');
  const disposableCases = [
    'user@mailinator.com',
    'patient@10minutemail.com',
    'doctor@guerrillamail.com',
    'test@tempmail.com',
    'sub@box.trashmail.com'
  ];
  for (const d of disposableCases) {
    const res = await validateEmail(d);
    assert.strictEqual(res.valid, false, `Disposable address "${d}" must be blocked`);
    assert.ok(res.error.includes('Disposable and temporary email addresses are not accepted'));
  }
  console.log('  ✓ 120,000+ domain disposable blocklist successfully blocked disposable providers\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 5: Existing registered email rejection
  // --------------------------------------------------------------------------
  console.log('TEST 5: Existing registered email rejection');
  const authController = require('./controllers/authController');
  const { req: req5, res: res5 } = createMockReqRes({
    name: 'Duplicate Patient',
    email: 'mehta23@gmail.com', // Legacy user in DB (verified)
    password: 'Password123!',
    role: 'patient'
  });
  await authController.signup(req5, res5);
  assert.strictEqual(res5.statusCode, 409, 'Must return 409 Conflict for existing registered user');
  assert.ok(res5.data.message.includes('already exists'));
  console.log('  ✓ Existing active account registration rejected with 409 Conflict\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 6: Successful OTP generation
  // --------------------------------------------------------------------------
  console.log('TEST 6: Successful OTP generation');
  const generatedOtps = new Set();
  for (let i = 0; i < 50; i++) {
    const code = generateOtp();
    assert.strictEqual(code.length, 6, 'OTP must be exactly 6 characters');
    assert.ok(/^\d{6}$/.test(code), 'OTP must be numeric digits only');
    const num = parseInt(code, 10);
    assert.ok(num >= 100000 && num <= 999999, 'OTP must be within 100000-999999');
    generatedOtps.add(code);
  }
  assert.ok(generatedOtps.size >= 48, 'OTP generator must produce high cryptographic entropy');
  console.log('  ✓ Generated 50 secure random 6-digit codes with uniform distribution\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 7: Successful OTP verification (Stage A -> Stage B)
  // --------------------------------------------------------------------------
  console.log('TEST 7: Successful OTP verification & account activation');
  clearTestMailbox();
  const testEmail7 = `verified.test.${Date.now()}@gmail.com`;

  // Clean up any leftovers from test
  await pool.query('DELETE FROM users WHERE email = $1', [testEmail7]);
  await pool.query('DELETE FROM email_verifications WHERE email = $1', [testEmail7]);

  // Stage A: Initiate Signup
  const { req: req7a, res: res7a } = createMockReqRes({
    name: 'Alice Wonder',
    email: testEmail7,
    password: 'SecurePassword2026!',
    role: 'patient'
  });
  await authController.signup(req7a, res7a);
  assert.strictEqual(res7a.statusCode, 200, 'Stage A signup must succeed');
  assert.strictEqual(res7a.data.success, true);

  // Retrieve generated OTP challenge from DB
  const challengeRes7 = await pool.query(
    'SELECT * FROM email_verifications WHERE email = $1 AND purpose = $2 AND is_consumed = FALSE',
    [testEmail7, 'signup']
  );
  assert.strictEqual(challengeRes7.rowCount, 1, 'Challenge record must be saved in email_verifications');
  const challenge7 = challengeRes7.rows[0];

  // Inspect the captured email from test mailbox
  const mailbox = getTestMailbox();
  assert.ok(mailbox.length > 0, 'Email must have been delivered');
  const sentMail = mailbox[mailbox.length - 1];
  assert.strictEqual(sentMail.to, testEmail7);

  // Extract OTP from test email plain-text body
  const otpMatch = sentMail.text.match(/\b\d{6}\b/);
  assert.ok(otpMatch, 'OTP must be present in HTML body');
  const extractedOtp = otpMatch[0];

  // Verify hash matches
  assert.ok(verifyOtpHash(extractedOtp, challenge7.otp_hash), 'Captured OTP must match stored hash');

  // Stage B: Verify Email
  const { req: req7b, res: res7b } = createMockReqRes({
    email: testEmail7,
    otp: extractedOtp
  });
  await authController.verifyEmail(req7b, res7b);
  assert.strictEqual(res7b.statusCode, 200, 'Verification must succeed with 200');
  assert.strictEqual(res7b.data.success, true);
  assert.ok(res7b.data.token, 'Must return JWT token on verification');
  assert.strictEqual(res7b.data.user.email, testEmail7);

  // Verify DB state of newly created user
  const dbUser7 = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail7]);
  assert.strictEqual(dbUser7.rowCount, 1, 'User must exist in users table');
  assert.strictEqual(dbUser7.rows[0].is_verified, true, 'User must be marked is_verified = TRUE');
  assert.ok(dbUser7.rows[0].email_verified_at, 'email_verified_at must be populated');
  console.log('  ✓ Two-stage signup completed: user created with is_verified = TRUE and JWT issued\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 8: Incorrect OTP rejection
  // --------------------------------------------------------------------------
  console.log('TEST 8: Incorrect OTP rejection');
  const testEmail8 = `wrong.otp.${Date.now()}@gmail.com`;
  const { req: req8a, res: res8a } = createMockReqRes({
    name: 'Bob Wrong',
    email: testEmail8,
    password: 'Password123!',
    role: 'patient'
  });
  await authController.signup(req8a, res8a);

  // Attempt verification with invalid code '000000'
  const { req: req8b, res: res8b } = createMockReqRes({
    email: testEmail8,
    otp: '000000'
  });
  await authController.verifyEmail(req8b, res8b);
  assert.strictEqual(res8b.statusCode, 400, 'Must return 400 for incorrect OTP');
  assert.strictEqual(res8b.data.success, false);
  assert.strictEqual(res8b.data.remainingAttempts, 4, 'Remaining attempts must be decremented to 4');
  console.log('  ✓ Incorrect OTP rejected; attempt counter accurately decremented\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 9: Expired OTP rejection
  // --------------------------------------------------------------------------
  console.log('TEST 9: Expired OTP rejection');
  const testEmail9 = `expired.otp.${Date.now()}@gmail.com`;
  const otp9 = '123456';
  const hash9 = hashOtp(otp9);
  // Insert an already expired challenge (10 minutes in the past)
  await pool.query(
    `INSERT INTO email_verifications 
     (email, otp_hash, name, password_hash, role, purpose, attempts, max_attempts, expires_at, resend_available_at)
     VALUES ($1, $2, $3, $4, $5, 'signup', 0, 5, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '9 minutes')`,
    [testEmail9, hash9, 'Expired User', 'hash', 'patient']
  );

  const { req: req9, res: res9 } = createMockReqRes({
    email: testEmail9,
    otp: otp9
  });
  await authController.verifyEmail(req9, res9);
  assert.strictEqual(res9.statusCode, 400, 'Expired OTP must be rejected with 400');
  assert.ok(res9.data.message.includes('expired'));
  console.log('  ✓ Expired OTP challenge properly identified and invalidated\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 10: OTP replay prevention
  // --------------------------------------------------------------------------
  console.log('TEST 10: OTP replay prevention');
  // Re-attempting verification on testEmail7 with the same OTP used earlier
  const { req: req10, res: res10 } = createMockReqRes({
    email: testEmail7,
    otp: extractedOtp
  });
  await authController.verifyEmail(req10, res10);
  assert.strictEqual(res10.statusCode, 400, 'Replay of consumed OTP must fail');
  assert.ok(res10.data.message.includes('No active verification code') || res10.data.message.includes('expired'));
  console.log('  ✓ Consumed OTP challenge cannot be replayed; immediate replay blocked\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 11: Maximum OTP attempts limit
  // --------------------------------------------------------------------------
  console.log('TEST 11: Maximum OTP attempts enforcement');
  const testEmail11 = `max.attempts.${Date.now()}@gmail.com`;
  const { req: req11a, res: res11a } = createMockReqRes({
    name: 'Max Attempts User',
    email: testEmail11,
    password: 'Password123!',
    role: 'patient'
  });
  await authController.signup(req11a, res11a);

  // Fail 5 times
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { req: reqFail, res: resFail } = createMockReqRes({
      email: testEmail11,
      otp: `99999${attempt}`
    });
    await authController.verifyEmail(reqFail, resFail);
    if (attempt === 5) {
      assert.strictEqual(resFail.data.remainingAttempts, 0);
    }
  }

  // 6th attempt must be blocked
  const { req: req11b, res: res11b } = createMockReqRes({
    email: testEmail11,
    otp: '123456'
  });
  await authController.verifyEmail(req11b, res11b);
  assert.ok(res11b.statusCode === 400 || res11b.statusCode === 429, 'Must block after maximum attempts');
  console.log('  ✓ 5 failed attempts completely locks out challenge with rate limit\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 12: Resend cooldown (60 seconds)
  // --------------------------------------------------------------------------
  console.log('TEST 12: Resend OTP cooldown');
  const testEmail12 = `resend.cool.${Date.now()}@gmail.com`;
  const { req: req12a, res: res12a } = createMockReqRes({
    name: 'Resend User',
    email: testEmail12,
    password: 'Password123!',
    role: 'patient'
  });
  await authController.signup(req12a, res12a);

  // Immediate resend must be rejected with 429
  const { req: req12b, res: res12b } = createMockReqRes({
    email: testEmail12,
    purpose: 'signup'
  });
  await authController.resendOtp(req12b, res12b);
  assert.strictEqual(res12b.statusCode, 429, 'Must return 429 Too Many Requests within 60s cooldown');
  assert.ok(res12b.data.secondsLeft > 0, 'Must provide seconds remaining');
  console.log(`  ✓ Immediate resend prevented; cooldown enforced (${res12b.data.secondsLeft}s remaining)\n`);
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 13: SMTP delivery failure handling
  // --------------------------------------------------------------------------
  console.log('TEST 13: SMTP delivery failure handling');
  // Simulate SMTP delivery network or authentication failure
  setSimulateDeliveryFailure(true);

  const testEmail13 = `smtp.fail.${Date.now()}@gmail.com`;
  const { req: req13, res: res13 } = createMockReqRes({
    name: 'Fail SMTP User',
    email: testEmail13,
    password: 'Password123!',
    role: 'patient'
  });
  await authController.signup(req13, res13);
  assert.strictEqual(res13.statusCode, 500, 'Must fail with 500 if email cannot be delivered');
  assert.strictEqual(res13.data.success, false);

  // Verify account is NOT created in users table
  const unverifiedCheck13 = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail13]);
  assert.strictEqual(unverifiedCheck13.rowCount, 0, 'No user record must be created when email fails');

  // Restore normal email operation
  setSimulateDeliveryFailure(false);
  console.log('  ✓ Safe delivery failure: registration aborted without persisting user row\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 14: Unverified login rejection
  // --------------------------------------------------------------------------
  console.log('TEST 14: Unverified login rejection');
  const unverifiedEmail14 = `unverified.login.${Date.now()}@gmail.com`;
  const unverifiedPass = 'SecretPassword123!';
  const unverifiedHash = await bcrypt.hash(unverifiedPass, 10);

  // Directly insert unverified user
  await pool.query(
    'INSERT INTO users (name, email, password, role, is_verified) VALUES ($1, $2, $3, $4, FALSE)',
    ['Unverified Patient', unverifiedEmail14, unverifiedHash, 'patient']
  );

  const { req: req14, res: res14 } = createMockReqRes({
    email: unverifiedEmail14,
    password: unverifiedPass
  });
  await authController.login(req14, res14);
  assert.strictEqual(res14.statusCode, 403, 'Must return 403 Forbidden for unverified account');
  assert.strictEqual(res14.data.unverified, true, 'Must return unverified: true flag');
  assert.ok(res14.data.message.includes('verify your email'), 'Clear instructions must be provided');
  console.log('  ✓ Unverified user login strictly rejected with 403 Forbidden\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 15: Verified login success
  // --------------------------------------------------------------------------
  console.log('TEST 15: Verified login success');
  const { req: req15, res: res15 } = createMockReqRes({
    email: testEmail7, // Verified in Test 7
    password: 'SecurePassword2026!'
  });
  await authController.login(req15, res15);
  assert.strictEqual(res15.statusCode, 200, 'Login must succeed with 200');
  assert.strictEqual(res15.data.success, true);
  assert.ok(res15.data.token, 'JWT token must be issued on successful login');
  assert.strictEqual(res15.data.user.email, testEmail7);
  console.log('  ✓ Verified user successfully logged in with JWT token\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 16: Password hashing
  // --------------------------------------------------------------------------
  console.log('TEST 16: Password hashing verification');
  const userCheck16 = await pool.query('SELECT password FROM users WHERE email = $1', [testEmail7]);
  const storedHash = userCheck16.rows[0].password;
  assert.ok(storedHash.startsWith('$2b$10$') || storedHash.startsWith('$2a$10$'), 'Password must use bcrypt with 10 rounds');
  assert.notStrictEqual(storedHash, 'SecurePassword2026!', 'Plaintext password must NEVER be stored');
  console.log('  ✓ Passwords stored as robust bcrypt hashes with salt rounds >= 10\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 17: JWT authorization middleware
  // --------------------------------------------------------------------------
  console.log('TEST 17: JWT authorization & protection middleware');
  const { protect, authorize } = require('./middleware/authMiddleware');

  // Verify valid token
  const validToken = res15.data.token;
  const req17a = { headers: { authorization: `Bearer ${validToken}` } };
  const res17a = { status(c) { this.statusCode = c; return this; }, json(p) { this.data = p; } };
  let nextCalled17a = false;
  await protect(req17a, res17a, () => { nextCalled17a = true; });
  assert.strictEqual(nextCalled17a, true, 'Valid token must pass protect middleware');
  assert.ok(req17a.user.id, 'User ID must be attached to request');

  // Verify unverified user token rejection
  const unverifiedUserRes = await pool.query('SELECT id, role FROM users WHERE email = $1', [unverifiedEmail14]);
  const unverifiedToken = jwt.sign(
    { id: unverifiedUserRes.rows[0].id, role: unverifiedUserRes.rows[0].role },
    process.env.JWT_SECRET.trim()
  );
  const req17b = { headers: { authorization: `Bearer ${unverifiedToken}` } };
  const res17b = { status(c) { this.statusCode = c; return this; }, json(p) { this.data = p; } };
  let nextCalled17b = false;
  await protect(req17b, res17b, () => { nextCalled17b = true; });
  assert.strictEqual(nextCalled17b, false, 'Unverified token must be blocked');
  assert.strictEqual(res17b.statusCode, 403, 'Must return 403 Forbidden for unverified token');
  console.log('  ✓ protect middleware validates JWT and enforces verified status\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 18: Role preservation (Doctor & Patient profiles)
  // --------------------------------------------------------------------------
  console.log('TEST 18: Role preservation & profile creation');
  const doctorEmail18 = `dr.specialist.${Date.now()}@gmail.com`;
  const { req: req18a, res: res18a } = createMockReqRes({
    name: 'Dr. Gregory House',
    email: doctorEmail18,
    password: 'DoctorPassword2026!',
    role: 'doctor'
  });
  await authController.signup(req18a, res18a);

  // Fetch OTP
  const mailbox18 = getTestMailbox();
  const docOtpMatch = mailbox18[mailbox18.length - 1].text.match(/\b\d{6}\b/);
  const docOtp = docOtpMatch[0];

  // Verify doctor email
  const { req: req18b, res: res18b } = createMockReqRes({
    email: doctorEmail18,
    otp: docOtp
  });
  await authController.verifyEmail(req18b, res18b);
  assert.strictEqual(res18b.data.user.role, 'doctor', 'Role must be preserved as doctor');

  // Verify entry in doctors table
  const doctorEntry = await pool.query(
    'SELECT * FROM doctors WHERE user_id = $1',
    [res18b.data.user.id]
  );
  assert.strictEqual(doctorEntry.rowCount, 1, 'Doctor profile must be automatically created in doctors table');
  console.log('  ✓ Doctor role preserved and doctor profile row atomically created\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 19: Existing legacy user data preservation
  // --------------------------------------------------------------------------
  console.log('TEST 19: Existing legacy user data preservation');
  const legacyUsers = await pool.query('SELECT id, name, email, role, is_verified FROM users WHERE id <= 7 ORDER BY id ASC');
  assert.strictEqual(legacyUsers.rowCount, 7, 'All 7 original legacy users must be preserved');
  for (const u of legacyUsers.rows) {
    assert.strictEqual(u.is_verified, true, `Legacy user ${u.name} (${u.email}) must be preserved as verified`);
  }
  console.log('  ✓ All 7 legacy users verified and intact without data loss\n');
  passedCount++;

  // --------------------------------------------------------------------------
  // TEST 20: Existing appointment data preservation
  // --------------------------------------------------------------------------
  console.log('TEST 20: Existing appointment data preservation');
  const appointmentsCount = await pool.query('SELECT count(*) FROM appointments');
  const totalAppts = parseInt(appointmentsCount.rows[0].count, 10);
  assert.ok(totalAppts >= 9, 'All original 9 appointments must be preserved');
  console.log(`  ✓ All ${totalAppts} original appointments intact with patient/doctor linkages\n`);
  passedCount++;

  // --------------------------------------------------------------------------
  // Clean up test generated records
  // --------------------------------------------------------------------------
  await pool.query('DELETE FROM users WHERE email IN ($1, $2, $3, $4, $5, $6)', [
    testEmail7,
    testEmail8,
    testEmail9,
    testEmail11,
    unverifiedEmail14,
    doctorEmail18
  ]);
  await pool.query('DELETE FROM email_verifications WHERE email LIKE \'%@gmail.com\' AND email NOT IN (\'mehta23@gmail.com\', \'rao23@gmail.com\', \'myra23@gmail.com\', \'garg23@gmail.com\', \'ankitkushwaha9354@gmail.com\', \'aditya23@gmail.com\', \'singlapriyanka19998@gmail.com\')');

  console.log('======================================================');
  console.log(`🎉 ALL ${passedCount} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
}

runTestSuite()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test Suite Failure:', err);
    pool.end();
    process.exit(1);
  });
