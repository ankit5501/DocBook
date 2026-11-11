const express = require('express');
const router = express.Router();
const {
  joinWaitlist,
  getMyWaitlist,
  claimWaitlistSlot,
  cancelWaitlist,
  getDoctorWaitlist
} = require('../controllers/waitlistController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Patient routes
router.post('/', authorize('patient'), joinWaitlist);
router.get('/my', authorize('patient'), getMyWaitlist);
router.post('/:id/claim', authorize('patient'), claimWaitlistSlot);
router.delete('/:id', authorize('patient'), cancelWaitlist);

// Doctor routes
router.get('/doctor', authorize('doctor'), getDoctorWaitlist);

module.exports = router;

