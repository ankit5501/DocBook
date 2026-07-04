const express = require('express');
const router = express.Router();
const { 
  createRazorpayOrder, 
  verifyRazorpayPayment, 
  createOfflinePayment 
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/create-razorpay-order', protect, authorize('patient'), createRazorpayOrder);
router.post('/verify-razorpay', protect, authorize('patient'), verifyRazorpayPayment);
router.post('/offline', protect, authorize('patient'), createOfflinePayment);

module.exports = router;
