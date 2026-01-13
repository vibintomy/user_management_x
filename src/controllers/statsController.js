import UserStats from '../models/UserStats.js';
import Project from '../models/Project.js';
import DailyUpdate from '../models/DailyUpdate.js';
import User from '../models/user.js';

// @desc    Get user's own statistics
// @route   GET /api/stats/my-stats
// @access  Private (User, Lead)
export const getMyStats = async (req, res, next) => {
  try {
    let stats = await UserStats.findOne({ user: req.user._id })
      .populate('projectHistory.project', 'name department status completedAt');

    if (!stats) {
      stats = await UserStats.create({ user: req.user._id });
    }

    // Get current ongoing projects
    const ongoingProjects = await Project.find({
      $or: [
        { assignedLead: req.user._id },
        { assignedUsers: req.user._id }
      ],
      status: { $in: ['pending', 'in_progress', 'on_hold'] },
      isActive: true
    }).select('name department status progress');

    // Calculate completion rate
    const totalCompleted = stats.completedProjects;
    const totalProjects = stats.totalProjects;
    const completionRate = totalProjects > 0 
      ? Math.round((totalCompleted / totalProjects) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          department: req.user.department
        },
        stats: {
          totalProjects: stats.totalProjects,
          completedProjects: stats.completedProjects,
          ongoingProjects: ongoingProjects.length,
          totalModules: stats.totalModules,
          completedModules: stats.completedModules,
          totalHoursWorked: stats.totalHoursWorked,
          totalPoints: stats.totalPoints,
          completionRate
        },
        projectHistory: stats.projectHistory,
        monthlyStats: stats.monthlyStats,
        currentProjects: ongoingProjects
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard
// @route   GET /api/stats/leaderboard
// @access  Private (All)
export const getLeaderboard = async (req, res, next) => {
  try {
    const { 
      department, 
      role, 
      timeframe = 'all', // all, month, week
      limit = 10 
    } = req.query;

    const query = {};

    // Build query for users
    const userQuery = { approved: true, isActive: true };
    if (department) userQuery.department = department;
    if (role) userQuery.role = role;

    const users = await User.find(userQuery).select('_id');
    const userIds = users.map(u => u._id);

    query.user = { $in: userIds };

    // Get all stats
    let allStats = await UserStats.find(query)
      .populate('user', 'name email department role');

    // Filter by timeframe
    if (timeframe === 'month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      allStats = allStats.map(stat => {
        const monthStat = stat.monthlyStats.find(m => m.month === currentMonth);
        return {
          user: stat.user,
          totalPoints: monthStat?.pointsEarned || 0,
          projectsCompleted: monthStat?.projectsCompleted || 0,
          hoursWorked: monthStat?.hoursWorked || 0,
          timeframe: 'month'
        };
      });
    } else if (timeframe === 'week') {
      // Calculate week stats from project history
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      allStats = allStats.map(stat => {
        const weekProjects = stat.projectHistory.filter(
          p => p.completedAt && new Date(p.completedAt) >= oneWeekAgo
        );
        
        const weekPoints = weekProjects.reduce((sum, p) => sum + p.pointsEarned, 0);
        const weekHours = weekProjects.reduce((sum, p) => sum + p.hoursWorked, 0);
        
        return {
          user: stat.user,
          totalPoints: weekPoints,
          projectsCompleted: weekProjects.length,
          hoursWorked: weekHours,
          timeframe: 'week'
        };
      });
    } else {
      // All time
      allStats = allStats.map(stat => ({
        user: stat.user,
        totalPoints: stat.totalPoints,
        projectsCompleted: stat.completedProjects,
        hoursWorked: stat.totalHoursWorked,
        totalProjects: stat.totalProjects,
        timeframe: 'all'
      }));
    }

    // Sort by points and take top
    allStats.sort((a, b) => b.totalPoints - a.totalPoints);
    const leaderboard = allStats.slice(0, limit);

    // Add rank
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.status(200).json({
      success: true,
      timeframe,
      count: leaderboard.length,
      data: leaderboard
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get department leaderboard
// @route   GET /api/stats/department-leaderboard
// @access  Private (All)
export const getDepartmentLeaderboard = async (req, res, next) => {
  try {
    const { timeframe = 'all' } = req.query;

    // Get all departments
    const departments = await User.distinct('department', { 
      approved: true, 
      isActive: true 
    });

    const departmentStats = [];

    for (const dept of departments) {
      if (!dept) continue;

      const deptUsers = await User.find({ 
        department: dept,
        approved: true,
        isActive: true 
      }).select('_id');

      const userIds = deptUsers.map(u => u._id);

      const stats = await UserStats.find({ user: { $in: userIds } });

      let totalPoints = 0;
      let totalProjects = 0;
      let totalHours = 0;
      let memberCount = stats.length;

      if (timeframe === 'month') {
        const currentMonth = new Date().toISOString().slice(0, 7);
        stats.forEach(stat => {
          const monthStat = stat.monthlyStats.find(m => m.month === currentMonth);
          totalPoints += monthStat?.pointsEarned || 0;
          totalProjects += monthStat?.projectsCompleted || 0;
          totalHours += monthStat?.hoursWorked || 0;
        });
      } else {
        stats.forEach(stat => {
          totalPoints += stat.totalPoints;
          totalProjects += stat.completedProjects;
          totalHours += stat.totalHoursWorked;
        });
      }

      departmentStats.push({
        department: dept,
        totalPoints,
        totalProjects,
        totalHours,
        memberCount,
        averagePointsPerMember: memberCount > 0 ? Math.round(totalPoints / memberCount) : 0
      });
    }

    // Sort by total points
    departmentStats.sort((a, b) => b.totalPoints - a.totalPoints);

    // Add rank
    departmentStats.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.status(200).json({
      success: true,
      timeframe,
      count: departmentStats.length,
      data: departmentStats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user statistics (Admin, Lead can view any user)
// @route   GET /api/stats/user/:userId
// @access  Private (Admin, Lead, Own)
export const getUserStats = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Check authorization
    if (req.user.role !== 'admin' && 
        req.user.role !== 'lead' && 
        req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user\'s stats'
      });
    }

    const user = await User.findById(userId).select('name email department role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let stats = await UserStats.findOne({ user: userId })
      .populate('projectHistory.project', 'name department status completedAt');

    if (!stats) {
      stats = await UserStats.create({ user: userId });
    }

    // Get recent daily updates
    const recentUpdates = await DailyUpdate.find({ user: userId })
      .populate('project', 'name')
      .populate('module', 'name')
      .sort({ date: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        user,
        stats,
        recentUpdates
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get team statistics (Lead only)
// @route   GET /api/stats/team-stats
// @access  Private (Lead)
export const getTeamStats = async (req, res, next) => {
  try {
    // Get all projects where user is lead
    const projects = await Project.find({ 
      assignedLead: req.user._id,
      isActive: true
    })
    .populate('assignedUsers', 'name email')
    .select('name status progress assignedUsers totalEstimatedHours totalActualHours');

    // Get all team members
    const allTeamMembers = new Set();
    projects.forEach(project => {
      project.assignedUsers.forEach(user => {
        allTeamMembers.add(user._id.toString());
      });
    });

    const teamMemberIds = Array.from(allTeamMembers);

    // Get stats for all team members
    const teamStats = await UserStats.find({ 
      user: { $in: teamMemberIds } 
    }).populate('user', 'name email department');

    // Calculate team totals
    const totalPoints = teamStats.reduce((sum, stat) => sum + stat.totalPoints, 0);
    const totalHours = teamStats.reduce((sum, stat) => sum + stat.totalHoursWorked, 0);
    const totalCompleted = teamStats.reduce((sum, stat) => sum + stat.completedProjects, 0);

    // Get top performers
    const topPerformers = teamStats
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 5)
      .map(stat => ({
        user: stat.user,
        points: stat.totalPoints,
        projectsCompleted: stat.completedProjects,
        hoursWorked: stat.totalHoursWorked
      }));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalProjects: projects.length,
          completedProjects: projects.filter(p => p.status === 'completed').length,
          ongoingProjects: projects.filter(p => p.status === 'in_progress').length,
          teamSize: teamMemberIds.length,
          totalPoints,
          totalHours,
          totalCompleted
        },
        projects,
        topPerformers,
        teamMembers: teamStats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get project statistics (Admin, Lead)
// @route   GET /api/stats/project/:projectId
// @access  Private (Admin, Lead)
export const getProjectStats = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('assignedLead', 'name email')
      .populate('assignedUsers', 'name email')
      .populate('modules');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check authorization
    if (req.user.role === 'lead' && 
        project.assignedLead._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this project'
      });
    }

    // Get all daily updates for this project
    const dailyUpdates = await DailyUpdate.find({ project: projectId })
      .populate('user', 'name email');

    // Calculate user contributions
    const userContributions = {};
    
    for (const update of dailyUpdates) {
      const userId = update.user._id.toString();
      if (!userContributions[userId]) {
        userContributions[userId] = {
          user: update.user,
          totalHours: 0,
          updates: 0
        };
      }
      userContributions[userId].totalHours += update.hoursWorked;
      userContributions[userId].updates += 1;
    }

    // Module statistics
    const moduleStats = project.modules.map(module => ({
      name: module.name,
      progress: module.progress,
      estimatedTime: module.estimatedTime,
      actualTime: module.actualTime,
      status: module.status,
      efficiency: module.actualTime > 0 
        ? Math.round((module.estimatedTime / module.actualTime) * 100)
        : 0
    }));

    // Project efficiency
    const efficiency = project.totalActualHours > 0
      ? Math.round((project.totalEstimatedHours / project.totalActualHours) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id,
          name: project.name,
          department: project.department,
          status: project.status,
          progress: project.progress,
          priority: project.priority,
          assignedLead: project.assignedLead,
          assignedUsers: project.assignedUsers
        },
        stats: {
          totalEstimatedHours: project.totalEstimatedHours,
          totalActualHours: project.totalActualHours,
          efficiency,
          totalModules: project.modules.length,
          completedModules: project.modules.filter(m => m.status === 'completed').length,
          startDate: project.startDate,
          deadline: project.deadline,
          completedAt: project.completedAt
        },
        moduleStats,
        userContributions: Object.values(userContributions),
        totalUpdates: dailyUpdates.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overall system statistics (Admin only)
// @route   GET /api/stats/system-stats
// @access  Private (Admin)
export const getSystemStats = async (req, res, next) => {
  try {
    // Count all entities
    const totalProjects = await Project.countDocuments({ isActive: true });
    const completedProjects = await Project.countDocuments({ 
      status: 'completed', 
      isActive: true 
    });
    const ongoingProjects = await Project.countDocuments({ 
      status: 'in_progress', 
      isActive: true 
    });

    const totalUsers = await User.countDocuments({ 
      role: 'user', 
      approved: true, 
      isActive: true 
    });
    const totalLeads = await User.countDocuments({ 
      role: 'lead', 
      approved: true, 
      isActive: true 
    });

    // Calculate total points distributed
    const allStats = await UserStats.find({});
    const totalPoints = allStats.reduce((sum, stat) => sum + stat.totalPoints, 0);
    const totalHours = allStats.reduce((sum, stat) => sum + stat.totalHoursWorked, 0);

    // Get recent completions
    const recentCompletions = await Project.find({ 
      status: 'completed',
      isActive: true
    })
    .populate('assignedLead', 'name email')
    .sort({ completedAt: -1 })
    .limit(5)
    .select('name department completedAt progress');

    // Monthly trends
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyCompletions = await Project.countDocuments({
      status: 'completed',
      completedAt: { $gte: new Date(currentMonth + '-01') }
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProjects,
          completedProjects,
          ongoingProjects,
          totalUsers,
          totalLeads,
          totalPoints,
          totalHours
        },
        monthlyStats: {
          projectsCompleted: monthlyCompletions
        },
        recentCompletions
      }
    });
  } catch (error) {
    next(error);
  }
};