// ============================================================================
// UPDATED moduleController.js - Auto-Assign Users to Project
// ============================================================================

import Module from '../models/Module.js';
import Project from '../models/Project.js';
import User from '../models/user.js';

// @desc    Create module (Lead only)
// @route   POST /api/projects/:projectId/modules
// @access  Private (Lead)
export const createModule = async (req, res, next) => {
  try {
    const { name, description, estimatedTime, priority, assignedUsers, startDate, endDate, notes } = req.body;
    const { projectId } = req.params;

    // Verify project exists
    const project = await Project.findById(projectId);
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
        message: 'Only the assigned lead can create modules'
      });
    }

    // ✅ AUTO-ASSIGN: Add users to project if not already assigned
    if (assignedUsers && assignedUsers.length > 0) {
      const projectUserIds = project.assignedUsers.map(id => id.toString());
      
      // Find users that need to be added to project
      const newUsersForProject = assignedUsers.filter(
        userId => !projectUserIds.includes(userId.toString())
      );

      // Add new users to project automatically
      if (newUsersForProject.length > 0) {
        console.log(`✅ Auto-assigning ${newUsersForProject.length} users to project`);
        project.assignedUsers.push(...newUsersForProject);
        await project.save();
      }
    }

    // Create module
    const module = await Module.create({
      name,
      description,
      project: projectId,
      estimatedTime,
      actualTime: 0,
      progress: 0,
      status: 'pending',
      priority: priority || 'medium',
      startDate,
      endDate,
      notes,
      assignedUsers: assignedUsers || [],
      createdBy: req.user._id
    });

    await module.populate('assignedUsers', 'name email department');

    res.status(201).json({
      success: true,
      message: 'Module created successfully',
      data: module
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all modules for a project
// @route   GET /api/projects/:projectId/modules
// @access  Private (Admin, Lead)
export const getModulesByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check authorization
    if (req.user.role === 'lead' && 
        project.assignedLead.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these modules'
      });
    }

    const query = { project: projectId };
    if (status) query.status = status;

    const modules = await Module.find(query)
      .populate('assignedUsers', 'name email department')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: modules.length,
      data: modules
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single module
// @route   GET /api/modules/:id
// @access  Private (Admin, Lead)
export const getModule = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id)
      .populate('assignedUsers', 'name email department')
      .populate('createdBy', 'name email')
      .populate('project', 'name department assignedLead');

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Check authorization
    if (req.user.role === 'lead' && 
        module.project.assignedLead.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this module'
      });
    }

    res.status(200).json({
      success: true,
      data: module
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update module (Lead only)
// @route   PUT /api/modules/:id
// @access  Private (Lead)
export const updateModule = async (req, res, next) => {
  try {
    const {
      name,
      description,
      estimatedTime,
      actualTime,
      progress,
      status,
      priority,
      startDate,
      endDate,
      notes,
      assignedUsers
    } = req.body;

    const module = await Module.findById(req.params.id).populate('project');

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Check if lead owns the project
   // Authorization check
const isLead =
req.user.role === 'lead' &&
module.project.assignedLead.toString() === req.user._id.toString();

const isAssignedUser =
req.user.role === 'user' &&
module.assignedUsers.some(
  userId => userId.toString() === req.user._id.toString()
);

if (!isLead && !isAssignedUser) {
return res.status(403).json({
  success: false,
  message: 'Not authorized to update this module progress'
});
}


    // ✅ AUTO-ASSIGN: Add users to project if not already assigned
    if (assignedUsers && assignedUsers.length > 0) {
      const projectUserIds = module.project.assignedUsers.map(id => id.toString());
      
      const newUsersForProject = assignedUsers.filter(
        userId => !projectUserIds.includes(userId.toString())
      );

      if (newUsersForProject.length > 0) {
        console.log(`✅ Auto-assigning ${newUsersForProject.length} users to project during module update`);
        module.project.assignedUsers.push(...newUsersForProject);
        await module.project.save();
      }
      
      module.assignedUsers = assignedUsers;
    }

    // Update fields
    if (name) module.name = name;
    if (description !== undefined) module.description = description;
    if (estimatedTime) module.estimatedTime = estimatedTime;
    if (actualTime !== undefined) module.actualTime = actualTime;
    if (progress !== undefined) module.progress = progress;
    if (status) module.status = status;
    if (priority) module.priority = priority;
    if (startDate) module.startDate = startDate;
    if (endDate) module.endDate = endDate;
    if (notes !== undefined) module.notes = notes;

    await module.save();
    await module.populate('assignedUsers', 'name email department');

    res.status(200).json({
      success: true,
      message: 'Module updated successfully',
      data: module
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete module (Lead only)
// @route   DELETE /api/modules/:id
// @access  Private (Lead)
export const deleteModule = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id).populate('project');

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Check if lead owns the project
    if (module.project.assignedLead.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned lead can delete modules'
      });
    }

    await module.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Module deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update module progress (Lead only)
// @route   PATCH /api/modules/:id/progress
// @access  Private (Lead)
const updateModuleProgress = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);
    
    if (!module) {
      return res.status(404).json({ success: false, message: "Module not found" });
    }

    // New permission check
    const isAssigned = module.assignedUsers?.some(
      userId => userId.toString() === req.user._id.toString()
    );

    const isLead = module.assignedLead?.toString() === req.user._id.toString();

    if (!isAssigned && !isLead) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this module"
      });
    }

    // Optional: maybe prevent going backwards or above 100
    if (req.body.progress < module.progress && module.progress > 0) {
      return res.status(400).json({ message: "Cannot decrease progress" });
    }

    module.progress = Math.min(100, Math.max(0, req.body.progress));
    module.status = module.progress === 100 ? "completed" : "in_progress";

    await module.save();

    res.json({ success: true, module });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};