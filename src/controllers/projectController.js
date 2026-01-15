import mongoose from 'mongoose';
import Project from '../models/Project.js';
import User from '../models/user.js';

// @desc    Create new project (Admin only)
// @route   POST /api/projects
// @access  Private (Admin)
export const createProject = async (req, res, next) => {
  try {
    const {
      name,
      description,
      department,
      assignedLead,
      deadline,
      priority
    } = req.body;

    // Verify lead exists and is approved
    const lead = await User.findOne({
      _id: assignedLead,
      role: 'lead',
      approved: true,
      isActive: true,
      department: department
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or not approved in this department'
      });
    }

    // Create project
    const project = await Project.create({
      name,
      description,
      department,
      assignedLead,
      deadline,
      priority: priority || 'medium',
      createdBy: req.user._id
    });

    // Populate lead details
    await project.populate('assignedLead', 'name email department');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all projects (Admin sees all, Lead sees assigned only)
// @route   GET /api/projects
// @access  Private (Admin, Lead)
export const getAllProjects = async (req, res, next) => {
  try {
    const { status, department, priority, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };

    // If user is Lead, only show their assigned projects
    if (req.user.role === 'lead') {
      query.assignedLead = req.user._id;
    }else if(req.user.role=='user'){
      query.assignedUsers = req.user._id;
    }

    // Filters
    if (status) query.status = status;
    if (department) query.department = department;
    if (priority) query.priority = priority;

    const projects = await Project.find(query)
      .populate('assignedLead', 'name email department')
      .populate('assignedUsers', 'name email department')
      .populate('modules')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Project.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: projects
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private (Admin, Lead)
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedLead', 'name email department')
      .populate('assignedUsers', 'name email department')
      .populate({
        path: 'modules',
        populate: {
          path: 'assignedUsers',
          select: 'name email'
        }
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const userId = req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isLead = req.user.role === 'lead';
    const isAssignedUser = project.assignedUsers.some(
      u => u._id.toString() === userId
    );
    const isAssignedLead = project.assignedLead?._id?.toString() === userId;

    // Authorization logic
    if (!(
      isAdmin || 
      (isLead && isAssignedLead) ||
      (req.user.role === 'user' && isAssignedUser)
    )) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project (Admin only)
// @route   PUT /api/projects/:id
// @access  Private (Admin)
export const updateProject = async (req, res, next) => {
  try {
    const {
      name,
      description,
      department,
      assignedLead,
      deadline,
      priority,
      status
    } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // If changing lead, verify new lead
    if (assignedLead && assignedLead !== project.assignedLead.toString()) {
      const lead = await User.findOne({
        _id: assignedLead,
        role: 'lead',
        approved: true,
        isActive: true
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found or not approved'
        });
      }

      project.assignedLead = assignedLead;
    }

    // Update fields
    if (name) project.name = name;
    if (description) project.description = description;
    if (department) project.department = department;
    if (deadline) project.deadline = deadline;
    if (priority) project.priority = priority;
    if (status) project.status = status;

    await project.save();
    await project.populate('assignedLead', 'name email department');
    await project.populate('assignedUsers', 'name email department');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project (Admin only)
// @route   DELETE /api/projects/:id
// @access  Private (Admin)
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Soft delete
    project.isActive = false;
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign users to project (Lead only)
// @route   PATCH /api/projects/:id/assign-users
// @access  Private (Lead)
export const assignUsersToProject = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid user IDs'
      });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.assignedLead.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned lead can assign users'
      });
    }

    const users = await User.find({
      _id: { $in: userIds },
      role: 'user',
      approved: true,
      isActive: true,
      department: project.department
    });

    if (users.length !== userIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some users are not found, not approved, or not in the same department'
      });
    }

    // ── CRITICAL FIX ── Convert strings to ObjectIds
    const newUserObjectIds = userIds
      .filter(id => !project.assignedUsers.some(existing => existing.toString() === id))
      .map(id => new mongoose.Types.ObjectId(id));   // ← this is the most important line!

    if (newUserObjectIds.length === 0) {
      // No new users to add
      await project.populate('assignedUsers', 'name email department');
      return res.status(200).json({
        success: true,
        message: 'No new users to assign',
        data: project
      });
    }

    // Use $addToSet instead of push (safer + atomic)
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { assignedUsers: { $each: newUserObjectIds } },
        updatedAt: Date.now()
      },
      { new: true } // return updated document
    ).populate('assignedUsers', 'name email department');

    if (!updatedProject) {
      throw new Error('Failed to update project');
    }

    res.status(200).json({
      success: true,
      message: `${newUserObjectIds.length} user(s) assigned to project`,
      data: updatedProject
    });
  } catch (error) {
    console.error('Assign users error:', error);
    next(error);
  }
};

// @desc    Remove user from project (Lead only)
// @route   PATCH /api/projects/:id/remove-user/:userId
// @access  Private (Lead)
export const removeUserFromProject = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if lead owns this project
    if (project.assignedLead.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned lead can remove users'
      });
    }

    // Remove user
    project.assignedUsers = project.assignedUsers.filter(
      id => id.toString() !== userId
    );

    await project.save();
    await project.populate('assignedUsers', 'name email department');

    res.status(200).json({
      success: true,
      message: 'User removed from project',
      data: project
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available users for assignment (Lead only)
// @route   GET /api/projects/:id/available-users
// @access  Private (Lead)
export const getAvailableUsers = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if lead owns this project
    if (project.assignedLead.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned lead can view available users'
      });
    }

    // Get approved users in same department, excluding already assigned
    const users = await User.find({
      role: 'user',
      approved: true,
      isActive: true,
      department: project.department,
      _id: { $nin: project.assignedUsers }
    }).select('name email department');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available leads by department (Admin only)
// @route   GET /api/projects/available-leads/:department
// @access  Private (Admin)
export const getAvailableLeads = async (req, res, next) => {
  try {
    const { department } = req.params;

    const leads = await User.find({
      role: 'lead',
      approved: true,
      isActive: true,
      department: department
    }).select('name email department');

    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    next(error);
  }
};