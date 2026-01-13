import User from '../models/user.js';

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getDashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalLeads = await User.countDocuments({ role: 'lead' });
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const stats = {
      totalUsers,
      totalLeads,
      activeUsers,
      inactiveUsers,
      totalAccounts: totalUsers + totalLeads,
      recentUsers
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users by department
// @route   GET /api/admin/users-by-department
// @access  Private (Admin)
export const getUsersByDepartment = async (req, res, next) => {
  try {
    const departments = await User.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          users: { $push: { name: '$name', email: '$email', role: '$role' } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update user roles
// @route   PATCH /api/admin/bulk-update-roles
// @access  Private (Admin)
export const bulkUpdateRoles = async (req, res, next) => {
  try {
    const { userIds, newRole } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid user IDs'
      });
    }

    if (!['user', 'lead'].includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { role: newRole }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} users updated successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};