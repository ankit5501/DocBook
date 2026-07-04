const Razorpay = require('razorpay');
const crypto = require('crypto');
const { pool } = require('../config/db');
const sendEmail = require('../utils/email');

// Initialize Razorpay Instance dynamically
let razorpayInstance;
const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

if (key_id && key_secret && !key_id.includes('your_') && !key_secret.includes('your_')) {
  razorpayInstance = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
  });
  console.log('Razorpay Gateway Initialized');
} else {
  console.log('Razorpay Keys missing or placeholder. Running in Simulation Mode.');
}

// Helper to generate the confirmation slip HTML email content
const generateSlipHTML = (details, paymentMethod, paymentStatus) => {
  const formattedDate = new Date(details.date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 25px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Appointment Confirmed</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">DocBook Care Confirmation & Fee Slip</p>
      </div>
      
      <div style="padding: 20px; color: #1f2937;">
        <p>Dear <strong>${details.patient_name}</strong>,</p>
        <p>Your appointment has been successfully scheduled. Below are the consultation details and receipt:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Appointment ID:</td>
            <td style="padding: 10px 0; text-align: right; font-family: monospace;">#APT-${details.id}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Doctor:</td>
            <td style="padding: 10px 0; text-align: right;">Dr. ${details.doctor_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Specialty:</td>
            <td style="padding: 10px 0; text-align: right;">${details.specialty}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Date:</td>
            <td style="padding: 10px 0; text-align: right;">${formattedDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Time Slot:</td>
            <td style="padding: 10px 0; text-align: right;">${details.start_time.substring(0, 5)} - ${details.end_time.substring(0, 5)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Consultation Fee:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #3b82f6;">₹${details.fees}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Payment Mode:</td>
            <td style="padding: 10px 0; text-align: right; text-transform: capitalize;">${paymentMethod}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Payment Status:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold; text-transform: capitalize; color: ${paymentStatus === 'completed' ? '#10b981' : '#f59e0b'};">${paymentStatus}</td>
          </tr>
        </table>
        
        <div style="margin-top: 30px; background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 14px; color: #4b5563; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; font-weight: bold;">Important Guidelines:</p>
          <p style="margin: 5px 0 0 0;">Please keep a digital or printed copy of this fee slip during your clinic check-in.</p>
          ${paymentMethod === 'offline' 
            ? `<p style="margin: 5px 0 0 0; color: #b45309; font-weight: bold;">Note: As you opted for offline payment, please clear the consultation fee of ₹${details.fees} at the reception counter before your session.</p>` 
            : `<p style="margin: 5px 0 0 0; color: #047857; font-weight: bold;">Thank you! Your online payment of ₹${details.fees} has been received and verified.</p>`
          }
        </div>
      </div>
      
      <div style="text-align: center; padding: 20px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 12px; margin-top: 20px;">
        &copy; ${new Date().getFullYear()} DocBook Network Clinic. All rights reserved.
      </div>
    </div>
  `;
};

// @desc Create Razorpay Order
// @route POST /api/payments/create-razorpay-order
// @access Private (Patient)
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { appointment_id } = req.body;

    const result = await pool.query(`
      SELECT a.*, d.fees 
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = $1 AND a.patient_id = $2
    `, [appointment_id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const appointment = result.rows[0];
    const amount = parseFloat(appointment.fees);

    if (razorpayInstance) {
      const options = {
        amount: Math.round(amount * 100), // in paise
        currency: 'INR',
        receipt: `receipt_apt_${appointment_id}`
      };
      
      const order = await razorpayInstance.orders.create(options);
      return res.json({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: key_id,
        simulated: false
      });
    } else {
      // Return simulated order options for development
      return res.json({
        success: true,
        order_id: `sim_order_${appointment_id}_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency: 'INR',
        key_id: 'rzp_test_placeholder',
        simulated: true
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Verify Razorpay Payment Signature
// @route POST /api/payments/verify-razorpay
// @access Private (Patient)
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointment_id, is_simulated } = req.body;

    // Verify signature if not simulated
    if (!is_simulated && razorpayInstance) {
      const hmac = crypto.createHmac('sha256', key_secret);
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generated_signature = hmac.digest('hex');
      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ message: 'Invalid payment signature verification failed.' });
      }
    }

    // Begin database update transaction
    await pool.query('BEGIN');

    // Get appointment amount
    const aptRes = await pool.query(`
      SELECT a.*, d.fees 
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = $1
    `, [appointment_id]);

    if (aptRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const fees = parseFloat(aptRes.rows[0].fees);

    // Update appointment payment status
    await pool.query(
      "UPDATE appointments SET payment_status = 'completed' WHERE id = $1",
      [appointment_id]
    );

    // Insert or update payment record
    const paymentRes = await pool.query(`
      INSERT INTO payments (appointment_id, amount, payment_gateway_order_id, payment_method, status) 
      VALUES ($1, $2, $3, 'online', 'completed')
      ON CONFLICT (id) DO UPDATE SET status = 'completed', payment_gateway_order_id = $3
      RETURNING *
    `, [appointment_id, fees, razorpay_order_id || razorpay_payment_id || 'simulated_payment_id']);

    await pool.query('COMMIT');

    // Retrieve full details for confirmation email
    const detailsRes = await pool.query(`
      SELECT a.id, u.name as patient_name, u.email as patient_email,
             d_u.name as doctor_name, d.specialty, d.fees,
             s.date, s.start_time, s.end_time
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users d_u ON d.user_id = d_u.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.id = $1
    `, [appointment_id]);

    const details = detailsRes.rows[0];

    // Trigger confirmation email
    await sendEmail({
      to: details.patient_email,
      subject: `Booking Confirmed & Fee Slip: Dr. ${details.doctor_name}`,
      html: generateSlipHTML(details, 'online', 'completed')
    });

    res.json({ success: true, payment: paymentRes.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Process Offline Payment Booking (Pay at Clinic)
// @route POST /api/payments/offline
// @access Private (Patient)
exports.createOfflinePayment = async (req, res) => {
  try {
    const { appointment_id } = req.body;

    await pool.query('BEGIN');

    // Get appointment amount
    const aptRes = await pool.query(`
      SELECT a.*, d.fees 
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = $1 AND a.patient_id = $2
    `, [appointment_id, req.user.id]);

    if (aptRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const fees = parseFloat(aptRes.rows[0].fees);

    // Update appointment payment status to pending
    await pool.query(
      "UPDATE appointments SET payment_status = 'pending' WHERE id = $1",
      [appointment_id]
    );

    // Insert payment record as pending / offline
    const paymentRes = await pool.query(`
      INSERT INTO payments (appointment_id, amount, payment_gateway_order_id, payment_method, status) 
      VALUES ($1, $2, 'offline', 'offline', 'pending')
      RETURNING *
    `, [appointment_id, fees]);

    await pool.query('COMMIT');

    // Retrieve details for email confirmation
    const detailsRes = await pool.query(`
      SELECT a.id, u.name as patient_name, u.email as patient_email,
             d_u.name as doctor_name, d.specialty, d.fees,
             s.date, s.start_time, s.end_time
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users d_u ON d.user_id = d_u.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.id = $1
    `, [appointment_id]);

    const details = detailsRes.rows[0];

    // Trigger confirmation email for offline booking
    await sendEmail({
      to: details.patient_email,
      subject: `Booking Confirmed (Pay at Clinic): Dr. ${details.doctor_name}`,
      html: generateSlipHTML(details, 'offline', 'pending')
    });

    res.json({ success: true, payment: paymentRes.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
