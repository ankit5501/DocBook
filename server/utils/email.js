const nodemailer = require('nodemailer');

// In-memory test mailbox for automated testing and test verification suites
const testMailbox = [];
let simulateDeliveryFailure = false;

function setSimulateDeliveryFailure(val) {
  simulateDeliveryFailure = !!val;
}

/**
 * Creates and returns a configured Nodemailer transporter.
 */
function createTransporter() {
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();

  // If host is smtp.gmail.com, use service: 'gmail' or direct smtp
  const isGmail = host.includes('gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

/**
 * Sends an email using Nodemailer.
 * 
 * In automated test environments (NODE_ENV === 'test' or EMAIL_TEST_MODE === 'true'),
 * emails are safely captured in memory so test assertions can verify delivery
 * without transmitting network packets or exposing credentials.
 * 
 * In production/dev mode, emails are transmitted via configurable SMTP.
 * Plaintext OTPs, passwords, and SMTP credentials are NEVER logged to console.
 * 
 * @param {object} mailOptions - { to, subject, html, text }
 * @returns {Promise<{ success: boolean, info?: object, error?: string }>}
 */
async function sendEmail({ to, subject, html, text }) {
  if (simulateDeliveryFailure) {
    return { success: false, error: 'SMTP delivery failed. Simulated connection failure.' };
  }

  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.EMAIL_TEST_MODE === 'true';

  // Check if credentials are placeholders or missing
  const isPlaceholderCreds =
    !user ||
    !pass ||
    user.includes('your_email@') ||
    pass.includes('your_app_password');

  if (isTestMode) {
    // Record to test mailbox for test assertion
    const record = {
      to,
      subject,
      html,
      text,
      sentAt: new Date()
    };
    testMailbox.push(record);
    return { success: true, testMode: true, messageId: `test-${Date.now()}` };
  }

  if (isPlaceholderCreds) {
    const errorMsg = 'SMTP credentials are not configured in environment (EMAIL_USER / EMAIL_PASS). Cannot deliver email.';
    console.error(`[EmailService] Delivery blocked: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"DocBook Care" <${user}>`,
      to,
      subject,
      html,
      text
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error) {
    // Log error code and sanitized message without credentials
    console.error(`[EmailService] SMTP delivery failed for recipient: ${error.code || error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Builds the professional DocBook OTP HTML email template.
 */
function buildOtpEmailTemplate({ name, otp, purpose = 'signup', expiryMinutes = 5 }) {
  const actionTitle = purpose === 'password_reset' ? 'Password Reset Verification' : 'Verify Your Email Address';
  const actionDescription =
    purpose === 'password_reset'
      ? 'You requested to reset your password for your DocBook account. Use the 6-digit verification code below to complete the reset.'
      : 'Thank you for registering with DocBook. To complete your account registration and verify your email address, please enter the 6-digit verification code below:';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionTitle} - DocBook</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%); padding: 32px 36px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                DocBook <span style="font-weight: 300; opacity: 0.85;">Health</span>
              </h1>
              <p style="margin: 6px 0 0 0; color: #c7d2fe; font-size: 13px; font-weight: 500;">Intelligent Healthcare Appointment Management</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                ${name ? `Hello, ${name}` : 'Hello'},
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ${actionDescription}
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #6366f1; border-radius: 10px; padding: 18px 36px; text-align: center;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #312e81;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; color: #1e40af; line-height: 1.5;">
                  ⏱ <strong>Time-sensitive:</strong> This code will expire in <strong>${expiryMinutes} minutes</strong>. Maximum 5 attempts allowed.
                </p>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If you did not initiate this request with DocBook, please disregard this email. Your account remains completely secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                This is an automated security message from DocBook. Please do not reply directly to this email.<br>
                &copy; ${new Date().getFullYear()} DocBook Healthcare. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Sends an OTP email for account verification or password reset.
 */
async function sendOtpEmail({ to, name, otp, purpose = 'signup', expiryMinutes = 5 }) {
  const subject =
    purpose === 'password_reset'
      ? 'DocBook - Password Reset Verification Code'
      : 'DocBook - Verify Your Email Address';

  const html = buildOtpEmailTemplate({ name, otp, purpose, expiryMinutes });
  const text = `Hello ${name || ''},\n\nYour DocBook verification code is: ${otp}\n\nThis code expires in ${expiryMinutes} minutes.\nIf you did not request this code, please ignore this email.`;

  return await sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendOtpEmail,
  buildOtpEmailTemplate,
  getTestMailbox: () => testMailbox,
  clearTestMailbox: () => {
    testMailbox.length = 0;
  },
  setSimulateDeliveryFailure
};
