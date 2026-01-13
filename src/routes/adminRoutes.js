import express from 'express';
import {
  getDashboardStats,
  getUsersByDepartment,
  bulkUpdateRoles
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users-by-department', getUsersByDepartment);
router.patch('/bulk-update-roles', bulkUpdateRoles);

export default router;