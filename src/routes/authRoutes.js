import express from 'express';
import {
  adminLogin,
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  getMe,
  updateFCMToken
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/admin/login', adminLogin);
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout-all', protect, logoutAll);
router.patch('/fcm-token', protect, updateFCMToken);

export default router;