const express = require('express');
const router = express.Router();
const { 
  getDoctors, 
  getDoctorSlots, 
  updateProfile, 
  getProfile,
  getMySlots,
  deleteSlot,
  addSlots, 
  getEarningsDashboard 
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Doctor only routes (put these before parametric routes to avoid conflicts)
router.get('/profile', protect, authorize('doctor'), getProfile);
router.get('/profile/slots', protect, authorize('doctor'), getMySlots);
router.delete('/slots/:id', protect, authorize('doctor'), deleteSlot);
router.put('/profile', protect, authorize('doctor'), updateProfile);
router.post('/slots', protect, authorize('doctor'), addSlots);
router.get('/earnings', protect, authorize('doctor'), getEarningsDashboard);

// Public routes
router.get('/', getDoctors);
router.get('/:id/slots', getDoctorSlots);

module.exports = router;
