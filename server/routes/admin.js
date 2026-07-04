const express = require('express');
const router = express.Router();
const { 
  getAllDoctors, 
  verifyDoctor, 
  getStats,
  getAllUsers,
  toggleUserBlock,
  getAllAppointments,
  cancelAppointmentAdmin
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin'));

router.get('/doctors', getAllDoctors);
router.patch('/doctors/:id/verify', verifyDoctor);
router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.patch('/users/:id/block', toggleUserBlock);
router.get('/appointments', getAllAppointments);
router.patch('/appointments/:id/cancel', cancelAppointmentAdmin);

module.exports = router;
