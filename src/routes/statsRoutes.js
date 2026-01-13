import express from 'express';
import {
  getMyStats,
  getLeaderboard,
  getDepartmentLeaderboard,
  getUserStats,
  getTeamStats,
  getProjectStats,
  getSystemStats
} from '../controllers/statsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Public stats (all authenticated users)
router.get('/my-stats', getMyStats);
router.get('/leaderboard', getLeaderboard);
router.get('/department-leaderboard', getDepartmentLeaderboard);

// Lead routes
router.get('/team-stats', authorize('lead'), getTeamStats);

// Admin and Lead routes
router.get('/user/:userId', authorize('admin', 'lead'), getUserStats);
router.get('/project/:projectId', authorize('admin', 'lead'), getProjectStats);

// Admin only routes
router.get('/system-stats', authorize('admin'), getSystemStats);

export default router;