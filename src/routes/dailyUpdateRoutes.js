import express from 'express';
import {
  createDailyUpdate,
  getDailyUpdatesByProject,
  getMyDailyUpdates,
  updateDailyUpdate,
  getTeamDailySummary
} from '../controllers/dailyUpdateController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// User routes
router.post('/', authorize('user'), createDailyUpdate);
router.get('/my-updates', authorize('user', 'lead'), getMyDailyUpdates);
router.put('/:id', authorize('user'), updateDailyUpdate);

// Lead and Admin routes
router.get('/project/:projectId', authorize('admin', 'lead'), getDailyUpdatesByProject);
router.get('/team-summary/:projectId', authorize('lead'), getTeamDailySummary);

export default router;