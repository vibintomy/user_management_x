module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  transform: {},
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/server.js',
  ],
};