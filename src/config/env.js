import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@company.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456'
  }
};

export default config;