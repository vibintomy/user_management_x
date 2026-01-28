import { jest } from '@jest/globals';
import httpMocks from 'node-mocks-http';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


jest.unstable_mockModule(path.resolve(__dirname, '../../models/Project.js'), () => ({
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../models/user.js'), () => ({
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));


const Project = (await import(path.resolve(__dirname, '../../models/Project.js'))).default;
const User = (await import(path.resolve(__dirname, '../../models/user.js'))).default;
const {
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  assignUsersToProject,
  removeUserFromProject,
  getAvailableUsers,
  getAvailableLeads,
} = await import(path.resolve(__dirname, '../../controllers/projectController.js'));

describe('Project Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE PROJECT ====================
  describe('createProject', () => {
    it('should create a new project successfully', async () => {
      const mockLead = {
        _id: 'lead123',
        name: 'Lead User',
        email: 'lead@example.com',
        role: 'lead',
        approved: true,
        isActive: true,
        department: 'Engineering'
      };

      const mockProject = {
        _id: 'project123',
        name: 'Test Project',
        description: 'Test Description',
        department: 'Engineering',
        assignedLead: 'lead123',
        deadline: new Date('2026-12-31'),
        priority: 'high',
        createdBy: 'admin123',
        populate: jest.fn().mockResolvedValue({
          _id: 'project123',
          name: 'Test Project',
          assignedLead: mockLead
        })
      };

      User.findOne.mockResolvedValue(mockLead);
      Project.create.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'POST',
        body: {
          name: 'Test Project',
          description: 'Test Description',
          department: 'Engineering',
          assignedLead: 'lead123',
          deadline: '2026-12-31',
          priority: 'high'
        },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createProject(req, res, next);

      expect(res.statusCode).toBe(201);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Project created successfully');
    });

    it('should return 404 if lead not found or not approved', async () => {
      User.findOne.mockResolvedValue(null);

      const req = httpMocks.createRequest({
        method: 'POST',
        body: {
          name: 'Test Project',
          description: 'Test Description',
          department: 'Engineering',
          assignedLead: 'invalidLead',
          deadline: '2026-12-31'
        },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createProject(req, res, next);

      expect(res.statusCode).toBe(404);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
    });

    it('should handle errors properly', async () => {
      User.findOne.mockRejectedValue(new Error('Database error'));

      const req = httpMocks.createRequest({
        method: 'POST',
        body: {
          name: 'Test Project',
          description: 'Test Description',
          department: 'Engineering',
          assignedLead: 'lead123',
          deadline: '2026-12-31'
        },
        user: { _id: 'admin123' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await createProject(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ==================== GET ALL PROJECTS ====================
  describe('getAllProjects', () => {
    it('should return all projects for admin', async () => {
      const mockProjects = [
        { _id: 'project1', name: 'Project 1', department: 'Engineering' },
        { _id: 'project2', name: 'Project 2', department: 'Marketing' }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProjects)
      };

      Project.find.mockReturnValue(mockQuery);
      Project.countDocuments.mockResolvedValue(2);

      const req = httpMocks.createRequest({
        method: 'GET',
        query: { page: '1', limit: '10' },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getAllProjects(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });

    it('should return only assigned projects for lead', async () => {
      const mockProjects = [
        { _id: 'project1', name: 'Lead Project', assignedLead: 'lead123' }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProjects)
      };

      Project.find.mockReturnValue(mockQuery);
      Project.countDocuments.mockResolvedValue(1);

      const req = httpMocks.createRequest({
        method: 'GET',
        query: { page: '1', limit: '10' },
        user: { _id: 'lead123', role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getAllProjects(req, res, next);

      expect(res.statusCode).toBe(200);
    });

    it('should apply filters correctly', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      };

      Project.find.mockReturnValue(mockQuery);
      Project.countDocuments.mockResolvedValue(0);

      const req = httpMocks.createRequest({
        method: 'GET',
        query: {
          page: '1',
          limit: '10',
          status: 'in_progress',
          department: 'Engineering',
          priority: 'high'
        },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getAllProjects(req, res, next);

      expect(Project.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_progress',
          department: 'Engineering',
          priority: 'high',
        })
      );
    });
  });

  // ==================== GET SINGLE PROJECT ====================
  describe('getProject', () => {
    it('should return project for admin', async () => {
      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Project',
        assignedLead: { _id: new mongoose.Types.ObjectId() },
        assignedUsers: [{ _id: new mongoose.Types.ObjectId() }]
      };

      // Mock the 3-level populate chain
      // .populate('assignedLead') -> .populate('assignedUsers') -> .populate({ path: 'modules' })
      const thirdPopulate = jest.fn().mockResolvedValue(mockProject);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Project.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: mockProject._id.toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getProject(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should return 404 if project not found', async () => {
      // Mock chain that returns null
      const thirdPopulate = jest.fn().mockResolvedValue(null);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Project.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getProject(req, res, next);

      expect(res.statusCode).toBe(404);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Project not found');
    });

    it('should return 403 if lead tries to access unassigned project', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const otherLeadId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Project',
        assignedLead: { _id: otherLeadId },
        assignedUsers: []
      };

      const thirdPopulate = jest.fn().mockResolvedValue(mockProject);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Project.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: mockProject._id.toString() },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getProject(req, res, next);

      expect(res.statusCode).toBe(403);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
    });

    it('should allow assigned lead to access project', async () => {
      const leadId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Project',
        assignedLead: { _id: leadId },
        assignedUsers: []
      };

      const thirdPopulate = jest.fn().mockResolvedValue(mockProject);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Project.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: mockProject._id.toString() },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getProject(req, res, next);

      expect(res.statusCode).toBe(200);
    });

    it('should allow assigned user to access project', async () => {
      const userId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Project',
        assignedLead: { _id: new mongoose.Types.ObjectId() },
        assignedUsers: [{ _id: userId }]
      };

      const thirdPopulate = jest.fn().mockResolvedValue(mockProject);
      const secondPopulate = jest.fn().mockReturnValue({ populate: thirdPopulate });
      const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });

      Project.findById.mockReturnValue({ populate: firstPopulate });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: mockProject._id.toString() },
        user: { _id: userId, role: 'user' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getProject(req, res, next);

      expect(res.statusCode).toBe(200);
    });
  });

  // ==================== UPDATE PROJECT ====================
  describe('updateProject', () => {
    it('should update project successfully', async () => {
      const mockProject = {
        _id: 'project123',
        name: 'Old Name',
        description: 'Old Description',
        assignedLead: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Project.findById.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: 'project123' },
        body: {
          name: 'New Name',
          description: 'New Description',
          priority: 'urgent'
        },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateProject(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should return 404 if project not found', async () => {
      Project.findById.mockResolvedValue(null);

      const req = httpMocks.createRequest({
        method: 'PUT',
        params: { id: 'invalid123' },
        body: { name: 'New Name' },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await updateProject(req, res, next);

      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== DELETE PROJECT ====================
  describe('deleteProject', () => {
    it('should soft delete project successfully', async () => {
      const mockProject = {
        _id: 'project123',
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };

      Project.findById.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'DELETE',
        params: { id: 'project123' },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await deleteProject(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(mockProject.isActive).toBe(false);
    });

    it('should return 404 if project not found', async () => {
      Project.findById.mockResolvedValue(null);

      const req = httpMocks.createRequest({
        method: 'DELETE',
        params: { id: 'invalid123' },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await deleteProject(req, res, next);

      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== ASSIGN USERS TO PROJECT ====================
  describe('assignUsersToProject', () => {
    it('should assign users to project successfully', async () => {
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();
      const leadId = new mongoose.Types.ObjectId();

      const mockUsers = [
        { _id: userId1, role: 'user', approved: true, isActive: true, department: 'Engineering' },
        { _id: userId2, role: 'user', approved: true, isActive: true, department: 'Engineering' }
      ];

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        assignedLead: leadId,
        assignedUsers: [],
        department: 'Engineering'
      };

      const updatedProject = {
        ...mockProject,
        assignedUsers: [userId1, userId2]
      };

      Project.findById.mockResolvedValue(mockProject);
      User.find.mockResolvedValue(mockUsers);
      Project.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(updatedProject)
      });

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: mockProject._id.toString() },
        body: { userIds: [userId1, userId2] },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await assignUsersToProject(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });

    it('should return 400 if userIds is empty', async () => {
      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: 'project123' },
        body: { userIds: [] },
        user: { _id: 'lead123', role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await assignUsersToProject(req, res, next);

      expect(res.statusCode).toBe(400);
    });

    it('should return 403 if non-lead tries to assign users', async () => {
      const leadId = new mongoose.Types.ObjectId();
      const differentLeadId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        assignedLead: leadId
      };

      Project.findById.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: mockProject._id.toString() },
        body: { userIds: ['user1'] },
        user: { _id: differentLeadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await assignUsersToProject(req, res, next);

      expect(res.statusCode).toBe(403);
    });
  });

  // ==================== REMOVE USER FROM PROJECT ====================
  describe('removeUserFromProject', () => {
    it('should remove user from project successfully', async () => {
      const leadId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        assignedLead: leadId,
        assignedUsers: ['user1', 'user2'],
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Project.findById.mockResolvedValue(mockProject);

      const req = httpMocks.createRequest({
        method: 'PATCH',
        params: { id: mockProject._id.toString(), userId: 'user1' },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await removeUserFromProject(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });
  });

  // ==================== GET AVAILABLE USERS ====================
  describe('getAvailableUsers', () => {
    it('should return available users for assignment', async () => {
      const leadId = new mongoose.Types.ObjectId();

      const mockProject = {
        _id: new mongoose.Types.ObjectId(),
        assignedLead: leadId,
        assignedUsers: ['user1'],
        department: 'Engineering'
      };

      const mockUsers = [
        { _id: 'user2', name: 'User 2', email: 'user2@example.com' },
        { _id: 'user3', name: 'User 3', email: 'user3@example.com' }
      ];

      Project.findById.mockResolvedValue(mockProject);
      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers)
      });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { id: mockProject._id.toString() },
        user: { _id: leadId, role: 'lead' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getAvailableUsers(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });
  });

  // ==================== GET AVAILABLE LEADS ====================
  describe('getAvailableLeads', () => {
    it('should return available leads for a department', async () => {
      const mockLeads = [
        { _id: 'lead1', name: 'Lead 1', email: 'lead1@example.com' },
        { _id: 'lead2', name: 'Lead 2', email: 'lead2@example.com' }
      ];

      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockLeads)
      });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { department: 'Engineering' },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getAvailableLeads(req, res, next);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });

    it('should handle errors properly', async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const req = httpMocks.createRequest({
        method: 'GET',
        params: { department: 'Engineering' },
        user: { _id: 'admin123', role: 'admin' }
      });

      const res = httpMocks.createResponse();
      const next = jest.fn();

      await getAvailableLeads(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});