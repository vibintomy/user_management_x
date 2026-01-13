import DailyUpdate from '../models/DailyUpdate.js';
import Project from '../models/Project.js';
import Module from '../models/Module.js';
import User from '../models/User.js';

// @desc    Create daily update (User only)
// @route   POST /api/daily-updates
// @access  Private (User)
export const createDailyUpdate = async (req, res, next) => {
  try {
    const {
      project,
      module,
      hoursWorked,
      progressPercentage,
      description,
      blockers,
      status
    } = req.body;

    // Verify user is assigned to the project
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isAssigned = projectDoc.assignedUsers.some(
      userId => userId.toString() === req.user._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this project'
      });
    }

    // Verify module belongs to project
    const moduleDoc = await Module.findOne({ _id: module, project });
    if (!moduleDoc) {
      return res.status(404).json({
        success: false,
        message: 'Module not found in this project'
      });
    }

    // Check if user already submitted update today for this module
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingUpdate = await DailyUpdate.findOne({
      user: req.user._id,
      module,
      date: { $gte: today }
    });

    if (existingUpdate) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted an update for this module today'
      });
    }

    // Create daily update
    const dailyUpdate = await DailyUpdate.create({
      user: req.user._id,
      project,
      module,
      hoursWorked,
      progressPercentage,
      description,
      blockers,
      status: status || 'on_track'
    });

    await dailyUpdate.populate('user', 'name email');
    await dailyUpdate.populate('module', 'name');

    res.status(201).json({
      success: true,
      message: 'Daily update submitted successfully',
      data: dailyUpdate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily updates for a project (Lead, Admin)
// @route   GET /api/daily-updates/project/:projectId
// @access  Private (Lead, Admin)
export const getDailyUpdatesByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { date, userId, moduleId } = req.query;

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
        message: 'Not authorized to view these updates'
      });
    }

    const query = { project: projectId };
    
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDay };
    }
    
    if (userId) query.user = userId;
    if (moduleId) query.module = moduleId;

    const updates = await DailyUpdate.find(query)
      .populate('user', 'name email department')
      .populate('module', 'name estimatedTime progress')
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: updates.length,
      data: updates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's own daily updates
// @route   GET /api/daily-updates/my-updates
// @access  Private (User)
export const getMyDailyUpdates = async (req, res, next) => {
  try {
    const { projectId, startDate, endDate } = req.query;

    const query = { user: req.user._id };
    
    if (projectId) query.project = projectId;
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const updates = await DailyUpdate.find(query)
      .populate('project', 'name')
      .populate('module', 'name estimatedTime')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: updates.length,
      data: updates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update daily update (User can edit only their own)
// @route   PUT /api/daily-updates/:id
// @access  Private (User)
export const updateDailyUpdate = async (req, res, next) => {
  try {
    const {
      hoursWorked,
      progressPercentage,
      description,
      blockers,
      status
    } = req.body;

    const dailyUpdate = await DailyUpdate.findById(req.params.id);

    if (!dailyUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Daily update not found'
      });
    }

    // Check if user owns this update
    if (dailyUpdate.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this entry'
      });
    }

    // Check if update is from today (can only edit today's update)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updateDate = new Date(dailyUpdate.date);
    updateDate.setHours(0, 0, 0, 0);

    if (updateDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Can only edit today\'s updates'
      });
    }

    // Update fields
    if (hoursWorked !== undefined) dailyUpdate.hoursWorked = hoursWorked;
    if (progressPercentage !== undefined) dailyUpdate.progressPercentage = progressPercentage;
    if (description) dailyUpdate.description = description;
    if (blockers !== undefined) dailyUpdate.blockers = blockers;
    if (status) dailyUpdate.status = status;

    await dailyUpdate.save();

    await dailyUpdate.populate('user', 'name email');
    await dailyUpdate.populate('module', 'name');

    res.status(200).json({
      success: true,
      message: 'Daily update updated successfully',
      data: dailyUpdate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get team daily updates summary (Lead only)
// @route   GET /api/daily-updates/team-summary/:projectId
// @access  Private (Lead)
export const getTeamDailySummary = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { date } = req.query;

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
        message: 'Not authorized to view this summary'
      });
    }

    // Get date range (today if not specified)
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const updates = await DailyUpdate.find({
      project: projectId,
      date: { $gte: targetDate, $lt: nextDay }
    })
    .populate('user', 'name email')
    .populate('module', 'name');

    // Group by user
    const userSummary = {};
    let totalHours = 0;

    for (const update of updates) {
      const userId = update.user._id.toString();
      
      if (!userSummary[userId]) {
        userSummary[userId] = {
          user: update.user,
          totalHours: 0,
          updates: []
        };
      }
      
      userSummary[userId].totalHours += update.hoursWorked;
      userSummary[userId].updates.push(update);
      totalHours += update.hoursWorked;
    }

    res.status(200).json({
      success: true,
      date: targetDate,
      totalHours,
      teamMembers: Object.values(userSummary).length,
      summary: Object.values(userSummary)
    });
  } catch (error) {
    next(error);
  }
};