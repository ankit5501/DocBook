const express = require('express');
const router = express.Router();
const { 
  bookAppointment, 
  getMyAppointments, 
  getDoctorAppointments, 
  updateAppointmentStatus, 
  cancelAppointment,
  rescheduleAppointment,
  createOrUpdatePrescription,
  getPrescription
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Patient routes
router.post('/', authorize('patient'), bookAppointment);
router.get('/my', authorize('patient'), getMyAppointments);
router.patch('/:id/reschedule', authorize('patient'), rescheduleAppointment);
router.delete('/:id', authorize('patient'), cancelAppointment);

// Doctor routes
router.get('/doctor', authorize('doctor'), getDoctorAppointments);
router.patch('/:id/status', authorize('doctor'), updateAppointmentStatus);
router.post('/:id/prescription', authorize('doctor'), createOrUpdatePrescription);

// Shared prescription viewer (Doctor or Patient of the appointment)
router.get('/:id/prescription', getPrescription);

module.exports = router;

