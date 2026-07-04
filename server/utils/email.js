const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASS || '').trim();

  // If no credentials, log to console immediately
  if (!emailUser || !emailPass || emailUser.includes('your_email@') || emailPass.includes('your_app_password')) {
    console.log('\n--- EMAIL NOTIFICATION [SIMULATED] ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('HTML Body Preview:');
    console.log(html);
    console.log('--------------------------------------\n');
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const mailOptions = {
      from: `"DocBook Care" <${emailUser}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully: ' + info.response);
    return { success: true, info };
  } catch (error) {
    console.error('Email sending failed with SMTP, printing to console instead:', error.message);
    
    // Fallback: log the email content so it is visible in the terminal
    console.log('\n--- EMAIL NOTIFICATION [FALLBACK] ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('HTML Body Preview:');
    console.log(html);
    console.log('-------------------------------------\n');
    return { success: false, error };
  }
};

module.exports = sendEmail;
