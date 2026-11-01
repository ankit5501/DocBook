const express = require('express');
const router = express.Router();
const { 
  addReview, 
  getDoctorReviews, 
  getAppointmentReview 
} = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route to view doctor reviews
router.get('/doctor/:doctorId', getDoctorReviews);

// Patient routes
router.post('/', protect, authorize('patient'), addReview);
router.get('/appointment/:appointmentId', protect, authorize('patient'), getAppointmentReview);

module.exports = router;
