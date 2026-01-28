import { jest } from '@jest/globals';
import httpMocks from 'node-mocks-http';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* 🔴 MOCK FIRST */
jest.unstable_mockModule(path.resolve(__dirname, '../../models/Module.js'), () => ({
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../models/Project.js'), () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../models/user.js'), () => ({
  default: {
    find: jest.fn(),
  },
}));

/* 🔴 IMPORT AFTER MOCK */
const Module = (await import(path.resolve(__dirname, '../../models/Module.js'))).default;
const Project = (await import(path.resolve(__dirname, '../../models/Project.js'))).default;
const User = (await import(path.resolve(__dirname, '../../models/user.js'))).default;
const {
  createModule,
  getModulesByProject,
  getModule,
  updateModule,
  deleteModule,
  updateModuleProgress,
} = await import(path.resolve(__dirname, '../../controllers/moduleController.js'));

describe('Module Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE MODULE ====================
  describe('createModule', () => {
    it('should create a module successfully', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId().toString();

      const mockProject = {
        _id: projectId,
        assignedLead: leadId,
        assignedUsers: [],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockModule = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Module',
        description: 'Test Description',
        project: projectId,
        estimatedTime: 10,
        assignedUsers: [userId],
        populate: jest.fn().mockResolvedValue({
          name: 'Test Module',
          assignedUsers: [{ _id: userId, name: 'Test User' }]
        })
      };

      Project.findById.mockResolvedValue(mockProject);
      Module.create.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'POST',
        params: { projectId: projectId.toString() },
        body: {
          name: 'Test Module',
          description: 'Test Description',
          estimatedTime: 10,
          priority: 'high',
          assignedUsers: [userId]
        },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createModule(req, res, next);

      expect(res.statusCode).toBe(201);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Module created successfully');
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should return 404 if project not found', async () => {
      Project.findById.mockResolvedValue(null);

      const req = httpMocks.createRequest({
        method: 'POST',
        params: { projectId: new mongoose.Types.ObjectId().toString() },
        body: {
          name: 'Test Module',
          estimatedTime: 10
        },
        user: { _id: new mongoose.Types.ObjectId(), role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createModule(req, res, next);

      expect(res.statusCode).toBe(404);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Project not found');
    });

    it('should return 403 if non-lead tries to create module', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const differentLeadId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: projectId,
        assignedLead: leadId
      };

      Project.findById.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'POST',
        params: { projectId: projectId.toString() },
        body: {
          name: 'Test Module',
          estimatedTime: 10
        },
        user: { _id: differentLeadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createModule(req, res, next);

      expect(res.statusCode).toBe(403);
      const data = res._getJSONData();
      expect(data.message).toBe('Only the assigned lead can create modules');
    });

    it('should auto-assign users to project if not already assigned', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();

      const mockProject = {
        _id: projectId,
        assignedLead: leadId,
        assignedUsers: [new mongoose.Types.ObjectId(userId1)],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockModule = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Module',
        populate: jest.fn().mockResolvedValue({ name: 'Test Module' })
      };

      Project.findById.mockResolvedValue(mockProject);
      Module.create.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'POST',
        params: { projectId: projectId.toString() },
        body: {
          name: 'Test Module',
          estimatedTime: 10,
          assignedUsers: [userId1, userId2]
        },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createModule(req, res, next);

      expect(mockProject.save).toHaveBeenCalled();
      expect(mockProject.assignedUsers).toContain(userId2);
    });

    it('should handle errors properly', async () => {
      Project.findById.mockRejectedValue(new Error('Database error'));

      const req = httpMocks.createRequest({
        method: 'POST',
        params: { projectId: new mongoose.Types.ObjectId().toString() },
        body: {
          name: 'Test Module',
          estimatedTime: 10
        },
        user: { _id: new mongoose.Types.ObjectId(), role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createModule(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ==================== GET MODULES BY PROJECT ====================
  describe('getModulesByProject', () => {
    it('should return all modules for a project', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: projectId,
        assignedLead: leadId
      };

      // Use string projectId to match what controller actually receives
      const mockModules = [
        { _id: 'module1', name: 'Module 1', project: projectId.toString() },
        { _id: 'module2', name: 'Module 2', project: projectId.toString() }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockModules)
      };

      Project.findById.mockResolvedValue(mockProject);
      Module.find.mockReturnValue(mockQuery);

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { projectId: projectId.toString() },
        query: {},
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModulesByProject(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.data).toEqual(mockModules);
    });

    it('should return 404 if project not found', async () => {
      Project.findById.mockResolvedValue(null);

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { projectId: new mongoose.Types.ObjectId().toString() },
        query: {},
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModulesByProject(req, res, next);

      expect(res.statusCode).toBe(404);
      const data = res._getJSONData();
      expect(data.message).toBe('Project not found');
    });

    it('should return 403 if lead tries to view unassigned project modules', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const differentLeadId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: projectId,
        assignedLead: differentLeadId
      };

      Project.findById.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { projectId: projectId.toString() },
        query: {},
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModulesByProject(req, res, next);

      expect(res.statusCode).toBe(403);
      const data = res._getJSONData();
      expect(data.message).toBe('Not authorized to view these modules');
    });

    it('should filter modules by status', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const projectId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: projectId,
        assignedLead: leadId
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      };

      Project.findById.mockResolvedValue(mockProject);
      Module.find.mockReturnValue(mockQuery);

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { projectId: projectId.toString() },
        query: { status: 'in_progress' },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModulesByProject(req, res, next);

      // Check that Module.find was called with the right query
      expect(Module.find).toHaveBeenCalledWith({
        project: projectId.toString(),
        status: 'in_progress'
      });
    });
  });

  // ==================== GET SINGLE MODULE ====================
  describe('getModule', () => {
    it('should return a single module', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        name: 'Test Module',
        project: {
          _id: new mongoose.Types.ObjectId(),
          assignedLead: leadId
        }
      };

      const thirdPopulate = jest.fn().mockResolvedValue(mockModule);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Module.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: moduleId.toString() },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModule(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should return 404 if module not found', async () => {
      const thirdPopulate = jest.fn().mockResolvedValue(null);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Module.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModule(req, res, next);

      expect(res.statusCode).toBe(404);
      const data = res._getJSONData();
      expect(data.message).toBe('Module not found');
    });

    it('should return 403 if lead tries to view unassigned module', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const differentLeadId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Module',
        project: {
          _id: new mongoose.Types.ObjectId(),
          assignedLead: differentLeadId
        }
      };

      const thirdPopulate = jest.fn().mockResolvedValue(mockModule);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Module.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: mockModule._id.toString() },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getModule(req, res, next);

      expect(res.statusCode).toBe(403);
      const data = res._getJSONData();
      expect(data.message).toBe('Not authorized to view this module');
    });
  });

  // ==================== UPDATE MODULE ====================
  describe('updateModule', () => {
    it('should update module successfully by lead', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        name: 'Old Name',
        description: 'Old Description',
        assignedUsers: [],
        project: {
          assignedLead: leadId,
          assignedUsers: [],
          save: jest.fn().mockResolvedValue(true)
        },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockModule)
      });

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: moduleId.toString() },
        body: {
          name: 'New Name',
          description: 'New Description',
          progress: 50
        },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateModule(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Module updated successfully');
      expect(mockModule.name).toBe('New Name');
      expect(mockModule.description).toBe('New Description');
    });

    it('should allow assigned user to update module', async () => {
      const userId = new mongoose.Types.ObjectId();
      const leadId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        name: 'Test Module',
        assignedUsers: [userId],
        project: {
          assignedLead: leadId,
          assignedUsers: [userId],
          save: jest.fn().mockResolvedValue(true)
        },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockModule)
      });

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: moduleId.toString() },
        body: {
          progress: 75
        },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateModule(req, res, next);

      expect(res.statusCode).toBe(200);
    });

    it('should return 403 if unauthorized user tries to update', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        assignedUsers: [],
        project: {
          assignedLead: leadId
        }
      };

      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockModule)
      });

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: moduleId.toString() },
        body: { progress: 50 },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateModule(req, res, next);

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 if module not found', async () => {
      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { name: 'New Name' },
        user: { _id: new mongoose.Types.ObjectId(), role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateModule(req, res, next);

      expect(res.statusCode).toBe(404);
    });

    it('should auto-assign new users to project during update', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();

      const mockModule = {
        _id: new mongoose.Types.ObjectId(),
        assignedUsers: [],
        project: {
          assignedLead: leadId,
          assignedUsers: [new mongoose.Types.ObjectId(userId1)],
          save: jest.fn().mockResolvedValue(true)
        },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockModule)
      });

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: mockModule._id.toString() },
        body: {
          assignedUsers: [userId1, userId2]
        },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateModule(req, res, next);

      expect(mockModule.project.save).toHaveBeenCalled();
      expect(mockModule.assignedUsers).toEqual([userId1, userId2]);
    });
  });

  // ==================== DELETE MODULE ====================
  describe('deleteModule', () => {
    it('should delete module successfully', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        project: {
          assignedLead: leadId
        },
        deleteOne: jest.fn().mockResolvedValue(true)
      };

      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockModule)
      });

      const req = httpMocks.createRequest({
        method: 'DELETE',
        params: { id: moduleId.toString() },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await deleteModule(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Module deleted successfully');
      expect(mockModule.deleteOne).toHaveBeenCalled();
    });

    it('should return 404 if module not found', async () => {
      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const req = httpMocks.createRequest({
        method: 'DELETE',
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await deleteModule(req, res, next);

      expect(res.statusCode).toBe(404);
    });

    it('should return 403 if non-lead tries to delete', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const differentLeadId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: new mongoose.Types.ObjectId(),
        project: {
          assignedLead: leadId
        }
      };

      Module.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockModule)
      });

      const req = httpMocks.createRequest({
        method: 'DELETE',
        params: { id: mockModule._id.toString() },
        user: { _id: differentLeadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await deleteModule(req, res, next);

      expect(res.statusCode).toBe(403);
      const data = res._getJSONData();
      expect(data.message).toBe('Only the assigned lead can delete modules');
    });
  });

  // ==================== UPDATE MODULE PROGRESS ====================
  describe('updateModuleProgress', () => {
    it('should update progress successfully by assigned user', async () => {
      const userId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        progress: 0,
        assignedUsers: [userId],
        project: { assignedLead: new mongoose.Types.ObjectId() },
        save: jest.fn().mockResolvedValue(true)
      };

      Module.findById.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: moduleId.toString() },
        body: { progress: 50 },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(mockModule.progress).toBe(50);
      expect(mockModule.status).toBe('in_progress');
    });

    it('should update progress successfully by lead', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        progress: 50,
        assignedUsers: [],
        project: { assignedLead: leadId },
        save: jest.fn().mockResolvedValue(true)
      };

      Module.findById.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: moduleId.toString() },
        body: { progress: 100 },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(mockModule.progress).toBe(100);
      expect(mockModule.status).toBe('completed');
    });

    it('should return 404 if module not found', async () => {
      Module.findById.mockResolvedValue(null);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { progress: 50 },
        user: { _id: new mongoose.Types.ObjectId(), role: 'user' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(res.statusCode).toBe(404);
      const data = res._getJSONData();
      expect(data.message).toBe('Module not found');
    });

    it('should return 403 if user not assigned to module', async () => {
      const userId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        assignedUsers: [],
        project: { assignedLead: new mongoose.Types.ObjectId() }
      };

      Module.findById.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: moduleId.toString() },
        body: { progress: 50 },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(res.statusCode).toBe(403);
      const data = res._getJSONData();
      expect(data.message).toBe('You are not assigned to this module');
    });

    it('should return 400 if trying to decrease progress', async () => {
      const userId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        progress: 75,
        assignedUsers: [userId],
        project: { assignedLead: new mongoose.Types.ObjectId() }
      };

      Module.findById.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: moduleId.toString() },
        body: { progress: 50 },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.message).toBe('Cannot decrease progress');
    });

    it('should cap progress at 100', async () => {
      const userId = new mongoose.Types.ObjectId();
      const moduleId = new mongoose.Types.ObjectId();

      const mockModule = {
        _id: moduleId,
        progress: 90,
        assignedUsers: [userId],
        project: { assignedLead: new mongoose.Types.ObjectId() },
        save: jest.fn().mockResolvedValue(true)
      };

      Module.findById.mockResolvedValue(mockModule);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: moduleId.toString() },
        body: { progress: 150 },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(mockModule.progress).toBe(100);
    });

    it('should handle errors properly', async () => {
      Module.findById.mockRejectedValue(new Error('Database error'));

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { progress: 50 },
        user: { _id: new mongoose.Types.ObjectId(), role: 'user' }
      });

      const res = httpMocks.createResponse();

      await updateModuleProgress(req, res);

      expect(res.statusCode).toBe(500);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
    });
  });
});