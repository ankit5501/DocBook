const { pool } = require('../config/db');

/**
 * Handle a freed slot by checking the waitlist and offering to the highest priority eligible patient
 * @param {number} slotId 
 * @param {number} doctorId 
 * @param {object} app Express app instance for socket.io access
 */
async function handleSlotFreed(slotId, doctorId, app) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get slot info and lock it
    const slotRes = await client.query(
      'SELECT id, doctor_id, date, start_time, end_time FROM slots WHERE id = $1 FOR UPDATE',
      [slotId]
    );

    if (slotRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const slot = slotRes.rows[0];
    const docId = doctorId || slot.doctor_id;

    // 2. Find the earliest waiting patient matching doctor and date
    const waitlistRes = await client.query(`
      SELECT w.*, u.name as patient_name, u.email as patient_email
      FROM waitlists w
      JOIN users u ON w.patient_id = u.id
      WHERE w.doctor_id = $1 
        AND w.status = 'waiting'
        AND (w.preferred_date IS NULL OR w.preferred_date = $2)
      ORDER BY w.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [docId, slot.date]);

    if (waitlistRes.rows.length > 0) {
      const waitlistEntry = waitlistRes.rows[0];
      const expiryMinutes = 15;
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Reserve slot for the waitlist offer (so general bookings cannot take it)
      await client.query('UPDATE slots SET is_booked = true WHERE id = $1', [slot.id]);

      // Update waitlist entry to 'offered'
      await client.query(`
        UPDATE waitlists 
        SET status = 'offered',
            offered_slot_id = $1,
            offer_expires_at = $2,
            notification_sent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [slot.id, expiresAt, waitlistEntry.id]);

      await client.query('COMMIT');

      // 3. Send real-time notification to the patient
      if (app) {
        const io = app.get('io');
        const connectedUsers = app.get('connectedUsers');
        const socketId = connectedUsers?.get(waitlistEntry.patient_id.toString());

        // Get doctor name
        const docRes = await pool.query(`
          SELECT u.name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1
        `, [docId]);
        const doctorName = docRes.rows[0]?.name || 'your doctor';

        const offerPayload = {
          message: `🎯 A slot opened up with Dr. ${doctorName}! You have ${expiryMinutes} minutes to claim it before it expires.`,
          waitlist_id: waitlistEntry.id,
          slot_id: slot.id,
          doctor_name: doctorName,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          expires_at: expiresAt.toISOString()
        };

        if (socketId && io) {
          io.to(socketId).emit('notification', { message: offerPayload.message });
          io.to(socketId).emit('waitlist_offer', offerPayload);
        }
      }

      console.log(`Waitlist slot ${slot.id} offered to patient ${waitlistEntry.patient_id}, expires at ${expiresAt.toISOString()}`);
      return waitlistEntry;
    } else {
      // No waiting patient found for this slot; make it openly available for normal booking
      await client.query('UPDATE slots SET is_booked = false WHERE id = $1', [slot.id]);
      await client.query('COMMIT');
      return null;
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('handleSlotFreed error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Scan for any waitlist offers that have expired and advance them to the next waiting patient
 * @param {object} app Express app instance
 */
async function expireUnclaimedOffers(app) {
  try {
    const expiredRes = await pool.query(`
      SELECT w.id, w.patient_id, w.doctor_id, w.offered_slot_id
      FROM waitlists w
      WHERE w.status = 'offered' 
        AND w.offer_expires_at <= CURRENT_TIMESTAMP
    `);

    for (const row of expiredRes.rows) {
      console.log(`Expiring waitlist offer #${row.id} for patient ${row.patient_id}`);
      
      // Mark as expired
      await pool.query(`
        UPDATE waitlists 
        SET status = 'expired', 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [row.id]);

      // Notify expired patient
      if (app) {
        const io = app.get('io');
        const connectedUsers = app.get('connectedUsers');
        const socketId = connectedUsers?.get(row.patient_id.toString());
        if (socketId && io) {
          io.to(socketId).emit('notification', {
            message: '⌛ Your 15-minute waitlist slot offer has expired and has been offered to the next patient in queue.'
          });
          io.to(socketId).emit('waitlist_expired', { waitlist_id: row.id });
        }
      }

      // Re-offer the slot to the next patient in line or release to public
      if (row.offered_slot_id) {
        await handleSlotFreed(row.offered_slot_id, row.doctor_id, app);
      }
    }
  } catch (err) {
    console.error('expireUnclaimedOffers error:', err.message);
  }
}

module.exports = {
  handleSlotFreed,
  expireUnclaimedOffers
};

