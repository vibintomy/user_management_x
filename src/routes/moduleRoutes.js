import express from 'express';
import {
  createModule,
  getModulesByProject,
  getModule,
  updateModule,
  deleteModule,
  updateModuleProgress
} from '../controllers/moduleController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Create module for a project (Lead only)
router.post('/projects/:projectId/modules', authorize('lead'), createModule);

// Get all modules for a project (Admin & Lead)
router.get('/projects/:projectId/modules', authorize('admin', 'lead','user'), getModulesByProject);

// Get, Update, Delete single module
router.get('/:id', authorize('admin', 'lead'), getModule);
router.put('/:id', authorize('lead'), updateModule);
router.delete('/:id', authorize('lead'), deleteModule);

// Update module progress (Lead only)
router.patch('/:id/progress', authorize('lead'), updateModuleProgress);

export default router;