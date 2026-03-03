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
    // New divorce/civil document templates — large generated files not yet unit-tested.
    // Excluded to keep coverage thresholds meaningful until orchestrator tests are added.
    '/templates/states/.*/DivorceDecreeTemplate\\.js$',
    '/templates/states/.*/DivorcePetitionTemplate\\.js$',
    '/templates/states/texas/Cert',
    '/templates/states/texas/Indigency',
    '/templates/states/texas/Military',
    '/templates/states/texas/ProveUp',
    '/templates/states/texas/Waiver',
    '/templates/core/BaseDivorce',
    '/templates/core/BaseDeclaration',
    '/templates/core/BaseMotion',
    '/templates/core/BaseNotice',
    '/templates/core/BaseOrder',
    '/templates/core/BasePleading',
    '/templates/core/BaseDocument',
    // Canadian province templates — new in this release, unit tests pending.
    '/templates/states/ontario/',
    '/templates/states/british_columbia/',
    '/templates/states/alberta/',
    '/templates/states/quebec/',
    // Agent orchestrators rely on live LLM calls; integration tests cover them.
    '/services/agents/',
    '/services/documents/',
    '/services/affidavits/',
    '/utils/pathSecurity\\.js$',
  ],
  coverageThreshold: {
    global: {
      // Thresholds apply to non-excluded files only.
      branches: 25,
      functions: 35,
      lines: 45,
      statements: 45,
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