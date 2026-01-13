import express from 'express';
import {
  getAllUsers,
  getPendingApprovalUsers,
  approveUser,
  rejectUser,
  getUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes accessible by admin and lead
router.get('/', authorize('admin', 'lead'), getAllUsers);
router.get('/pending-approval', authorize('admin', 'lead'), getPendingApprovalUsers);

// Routes accessible by all authenticated users
router.get('/:id', getUser);
router.put('/:id', updateUser);

// Admin only routes
router.patch('/:id/approve', authorize('admin'), approveUser);
router.patch('/:id/reject', authorize('admin'), rejectUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.patch('/:id/toggle-status', authorize('admin'), toggleUserStatus);

export default router;