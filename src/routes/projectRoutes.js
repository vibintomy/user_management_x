import express from 'express';
import {
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  assignUsersToProject,
  removeUserFromProject,
  getAvailableUsers,
  getAvailableLeads
} from '../controllers/projectController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Admin and Lead can view projects
router.get('/', authorize('admin', 'lead','user'), getAllProjects);

// Admin only - Create, Update, Delete projects
router.post('/', authorize('admin'), createProject);
router.get('/available-leads/:department', authorize('admin'), getAvailableLeads);

// Admin and Lead can view single project
router.get('/:id', authorize('admin', 'lead'), getProject);

// Admin only - Update and Delete
router.put('/:id', authorize('admin'), updateProject);
router.delete('/:id', authorize('admin'), deleteProject);

// Lead only - Assign/Remove users
router.patch('/:id/assign-users', authorize('lead'), assignUsersToProject);
router.patch('/:id/remove-user/:userId', authorize('lead'), removeUserFromProject);
router.get('/:id/available-users', authorize('lead'), getAvailableUsers);

export default router;