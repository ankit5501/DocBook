const express = require('express');
const router = express.Router();
const { 
  getProfile, 
  updateProfile, 
  getPatientProfileById 
} = require('../controllers/patientController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Patient endpoints
router.get('/profile', authorize('patient'), getProfile);
router.put('/profile', authorize('patient'), updateProfile);

// Doctor & Admin review endpoint
router.get('/profile/:patientId', authorize('doctor', 'admin'), getPatientProfileById);

module.exports = router;
