import User from '../models/user.js';
import Admin from '../models/Admin.js';
import RefreshToken from '../models/RefreshToken.js';
import config from '../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  saveRefreshToken
} from '../middleware/auth.js';
import { sendWelcomeNotification } from '../services/notificationService.js';

// @desc    Admin Login
// @route   POST /api/auth/admin/login
// @access  Public
export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check against hardcoded admin credentials
    if (email !== config.admin.email || password !== config.admin.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Find or create admin in database
    let admin = await Admin.findOne({ email: config.admin.email });
    
    if (!admin) {
      admin = await Admin.create({
        email: config.admin.email,
        password: config.admin.password,
        role: 'admin'
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate tokens
    const accessToken = generateAccessToken(admin._id, 'admin');
    const refreshToken = generateRefreshToken(admin._id, 'admin');

    // Save refresh token to database
    await saveRefreshToken(refreshToken, admin._id, 'Admin', req);

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      accessToken,
      refreshToken,
      data: {
        id: admin._id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    User/Lead Register
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, department, fcmToken } = req.body;

    // Validate role
    if (role && !['user', 'lead'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "user" or "lead"'
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user with approval pending
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
      phone,
      department,
      fcmToken: fcmToken || null,
      approved: false // Default: pending approval
    });

    // Send welcome notification (if FCM token provided)
    if (fcmToken) {
      await sendWelcomeNotification(fcmToken, user.name);
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    // Save refresh token to database
    await saveRefreshToken(refreshToken, user._id, 'User', req);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please wait for admin approval.',
      accessToken,
      refreshToken,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        approved: user.approved
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    User/Lead Login
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password, fcmToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is approved
    if (!user.approved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin to activate your account.',
        code: 'PENDING_APPROVAL'
      });
    }

    // Update FCM token if provided
    if (fcmToken && fcmToken !== user.fcmToken) {
      user.fcmToken = fcmToken;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    // Save refresh token to database
    await saveRefreshToken(refreshToken, user._id, 'User', req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        approved: user.approved
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update FCM Token
// @route   PATCH /api/auth/fcm-token
// @access  Private
export const updateFCMToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.fcmToken = fcmToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if refresh token exists in database and is not revoked
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      isRevoked: false
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is invalid or has been revoked'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(decoded.id, decoded.role);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Revoke the refresh token
    await RefreshToken.updateOne(
      { token: refreshToken },
      { isRevoked: true }
    );

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
export const logoutAll = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userModel = req.user.role === 'admin' ? 'Admin' : 'User';

    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany(
      { userId, userModel, isRevoked: false },
      { isRevoked: true }
    );

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};