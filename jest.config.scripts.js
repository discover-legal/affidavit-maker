// jest.config.scripts.js - Config for script tests without full setup
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/scripts/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/client/',
    '/documents/',
  ],
};
