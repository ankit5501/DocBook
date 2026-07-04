const express = require('express');
const router = express.Router();
const { 
  bookAppointment, 
  getMyAppointments, 
  getDoctorAppointments, 
  updateAppointmentStatus, 
  cancelAppointment 
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Patient routes
router.post('/', authorize('patient'), bookAppointment);
router.get('/my', authorize('patient'), getMyAppointments);
router.delete('/:id', authorize('patient'), cancelAppointment);

// Doctor routes
router.get('/doctor', authorize('doctor'), getDoctorAppointments);
router.patch('/:id/status', authorize('doctor'), updateAppointmentStatus);

module.exports = router;
