import app from './src/app.js';
import connectDB from './src/config/database.js';
import config from './src/config/env.js';

// Connect to database
connectDB();

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT} in ${config.nodeEnv} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`❌ Error: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});