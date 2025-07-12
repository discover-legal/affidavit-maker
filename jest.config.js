// jest.config.js
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Coverage settings
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/client/',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module paths
  moduleDirectories: ['node_modules', 'src'],
  
  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/client/',
    '/documents/',
  ],
  
  // Mock files
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // Global variables
  globals: {
    'process.env': {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/affidavit_test',
      OPENAI_API_KEY: 'test-key',
      AUTH0_DOMAIN: 'https://test.auth0.com',
      AUTH0_AUDIENCE: 'test-audience',
      STRIPE_SECRET_KEY: 'sk_test_123',
    },
  },
};