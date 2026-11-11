const express = require('express');
const router = express.Router();
const {
  checkIn,
  getAppointmentTokenStatus,
  getDoctorLiveQueue,
  callNextToken,
  completeCurrentConsultation,
  markNoShow
} = require('../controllers/clinicQueueController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Check-in (Patient or Doctor/receptionist)
router.post('/check-in', checkIn);

// Patient token & live wait status for an appointment
router.get('/appointment/:appointmentId', getAppointmentTokenStatus);

// Doctor live clinic queue operations
router.get('/doctor/live', authorize('doctor'), getDoctorLiveQueue);
router.post('/call-next', authorize('doctor'), callNextToken);
router.post('/complete', authorize('doctor'), completeCurrentConsultation);
router.post('/:tokenId/no-show', authorize('doctor'), markNoShow);

module.exports = router;

