import User from '../models/user.js';
import {
  sendAccountApprovedNotification,
  sendAccountRejectedNotification
} from '../services/notificationService.js';

// @desc    Get all users (Admin & Lead only)
// @route   GET /api/users
// @access  Private (Admin, Lead)
export const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, department, approved, page = 1, limit = 10 } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (department) query.department = department;
    if (approved !== undefined) query.approved = approved === 'true';

    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending approval users
// @route   GET /api/users/pending-approval
// @access  Private (Admin, Lead)
export const getPendingApprovalUsers = async (req, res, next) => {
  try {
    const users = await User.find({ approved: false })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve user account (Admin only)
// @route   PATCH /api/users/:id/approve
// @access  Private (Admin)
export const approveUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.approved) {
      return res.status(400).json({
        success: false,
        message: 'User is already approved'
      });
    }

    // Approve user
    user.approved = true;
    user.approvedAt = new Date();
    user.approvedBy = req.user._id; // Admin who approved
    await user.save();

    // Send push notification
    if (user.fcmToken) {
      await sendAccountApprovedNotification(user.fcmToken, user.name);
    }

    res.status(200).json({
      success: true,
      message: 'User approved successfully and notification sent',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject user account (Admin only)
// @route   PATCH /api/users/:id/reject
// @access  Private (Admin)
export const rejectUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Send rejection notification before deleting/deactivating
    if (user.fcmToken) {
      await sendAccountRejectedNotification(user.fcmToken, user.name, reason);
    }

    // Option 1: Deactivate user
    user.isActive = false;
    await user.save();

    // Option 2: Delete user (uncomment if you prefer)
    // await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User rejected and notification sent'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Users can only view their own profile unless they're admin/lead
    if (req.user.role !== 'admin' && req.user.role !== 'lead' && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
export const updateUser = async (req, res, next) => {
  try {
    const { name, phone, department, password, fcmToken } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Users can only update their own profile unless they're admin/lead
    if (req.user.role !== 'admin' && req.user.role !== 'lead' && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department) user.department = department;
    if (password) user.password = password;
    if (fcmToken) user.fcmToken = fcmToken;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user active status (Admin only)
// @route   PATCH /api/users/:id/toggle-status
// @access  Private (Admin)
export const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    next(error);
  }
};