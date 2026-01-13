import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import User from '../models/user.js';
import Admin from '../models/Admin.js';
import RefreshToken from '../models/RefreshToken.js';

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Check if admin or user/lead
      if (decoded.role === 'admin') {
        req.user = await Admin.findById(decoded.id);
      } else {
        req.user = await User.findById(decoded.id).select('-password');
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists'
        });
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Access token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token is invalid'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Authorize specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Generate Access Token (short-lived)
export const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, config.jwtSecret, {
    expiresIn: config.jwtExpire
  });
};

// Generate Refresh Token (long-lived)
export const generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpire
  });
};

// Verify Refresh Token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwtRefreshSecret);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Save Refresh Token to Database
export const saveRefreshToken = async (token, userId, userModel, req) => {
  const decoded = jwt.decode(token);
  
  const refreshToken = await RefreshToken.create({
    token,
    userId,
    userModel,
    expiresAt: new Date(decoded.exp * 1000),
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  });

  return refreshToken;
};

// Backward compatibility - keep old function name
export const generateToken = generateAccessToken;