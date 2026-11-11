const { pool } = require('../config/db');

// Helper to determine if the 48-hour consultation chat window is active
const checkChatWindow = (appointmentDate, endTime) => {
  try {
    const slotDateStr = new Date(appointmentDate).toISOString().split('T')[0];
    const slotEndTimeStr = endTime ? endTime.substring(0, 8) : '23:59:59';
    const slotEndDateTime = new Date(`${slotDateStr}T${slotEndTimeStr}`);

    const now = new Date();
    // 48 hours in milliseconds
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    const windowExpiry = new Date(slotEndDateTime.getTime() + fortyEightHoursMs);

    const isExpired = now > windowExpiry;
    const hoursRemaining = Math.max(0, Math.round((windowExpiry.getTime() - now.getTime()) / (1000 * 60 * 60)));

    return {
      isActive: !isExpired,
      hoursRemaining,
      windowExpiry: windowExpiry.toISOString()
    };
  } catch (err) {
    console.error('Chat window calculation error:', err);
    return { isActive: true, hoursRemaining: 48, windowExpiry: null };
  }
};

// @desc Get consultation chat messages & window status
// @route GET /api/chat/:appointmentId
// @access Private (Patient or Doctor of the appointment)
exports.getMessages = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    // 1. Fetch appointment details with doctor and patient user IDs
    const aptRes = await pool.query(`
      SELECT 
        a.id, 
        a.patient_id, 
        a.doctor_id, 
        a.status,
        a.appointment_type,
        a.meeting_room_id,
        s.date as appointment_date, 
        s.start_time, 
        s.end_time,
        u_doc.id as doctor_user_id,
        u_doc.name as doctor_name,
        d.specialty,
        u_pat.id as patient_user_id,
        u_pat.name as patient_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      JOIN users u_pat ON a.patient_id = u_pat.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.id = $1
    `, [appointmentId]);

    if (aptRes.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const apt = aptRes.rows[0];

    // 2. Authorization check
    const isPatient = req.user.id === apt.patient_user_id;
    const isDoctor = req.user.id === apt.doctor_user_id;

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to access this consultation chat' });
    }

    // 3. Check 48h consultation chat window
    const windowStatus = checkChatWindow(apt.appointment_date, apt.end_time);

    // 4. Fetch messages
    const messagesRes = await pool.query(`
      SELECT 
        m.id,
        m.appointment_id,
        m.sender_id,
        m.sender_role,
        m.message,
        m.created_at,
        u.name as sender_name
      FROM consultation_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.appointment_id = $1
      ORDER BY m.created_at ASC
    `, [appointmentId]);

    res.json({
      appointment: {
        id: apt.id,
        doctor_name: apt.doctor_name,
        specialty: apt.specialty,
        patient_name: apt.patient_name,
        appointment_date: apt.appointment_date,
        start_time: apt.start_time,
        end_time: apt.end_time,
        status: apt.status,
        appointment_type: apt.appointment_type,
        meeting_room_id: apt.meeting_room_id
      },
      windowStatus,
      messages: messagesRes.rows
    });
  } catch (err) {
    console.error('Get consultation messages error:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc Send a consultation chat message
// @route POST /api/chat/:appointmentId
// @access Private (Patient or Doctor of the appointment)
exports.sendMessage = async (req, res) => {
  const { appointmentId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message content cannot be empty' });
  }

  try {
    const aptRes = await pool.query(`
      SELECT 
        a.id, 
        a.patient_id, 
        a.doctor_id, 
        s.date as appointment_date, 
        s.end_time,
        u_doc.id as doctor_user_id,
        u_doc.name as doctor_name,
        u_pat.id as patient_user_id,
        u_pat.name as patient_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      JOIN users u_pat ON a.patient_id = u_pat.id
      JOIN slots s ON a.slot_id = s.id
      WHERE a.id = $1
    `, [appointmentId]);

    if (aptRes.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const apt = aptRes.rows[0];

    const isPatient = req.user.id === apt.patient_user_id;
    const isDoctor = req.user.id === apt.doctor_user_id;

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to send messages in this chat' });
    }

    // Verify 48-hour consultation window
    const windowStatus = checkChatWindow(apt.appointment_date, apt.end_time);
    if (!windowStatus.isActive) {
      return res.status(403).json({
        message: 'The 48-hour consultation chat window for this appointment has expired.'
      });
    }

    const senderRole = isPatient ? 'patient' : 'doctor';

    // Insert message into database
    const msgRes = await pool.query(`
      INSERT INTO consultation_messages (appointment_id, sender_id, sender_role, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [appointmentId, req.user.id, senderRole, message.trim()]);

    const savedMsg = {
      ...msgRes.rows[0],
      sender_name: req.user.name || (isPatient ? apt.patient_name : `Dr. ${apt.doctor_name}`)
    };

    // Socket.io Real-Time Broadcast
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    if (io) {
      // 1. Broadcast to the active chat room
      io.to(`chat_${appointmentId}`).emit('new_chat_message', savedMsg);

      // 2. Also send push notification to recipient if not currently in chat room
      const recipientUserId = isPatient ? apt.doctor_user_id.toString() : apt.patient_user_id.toString();
      const recipientSocketId = connectedUsers?.get(recipientUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('notification', {
          message: `New message from ${savedMsg.sender_name} for appointment #APT-${appointmentId}`,
          appointmentId
        });
      }
    }

    res.status(201).json(savedMsg);
  } catch (err) {
    console.error('Send consultation message error:', err.message);
    res.status(500).send('Server Error');
  }
};
