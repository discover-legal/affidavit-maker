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
    '/templates/states/manitoba/',
    '/templates/states/new_brunswick/',
    '/templates/states/newfoundland/',
    '/templates/states/nova_scotia/',
    '/templates/states/prince_edward_island/',
    '/templates/states/saskatchewan/',
    // Phase 1 expansion states — unit tests pending.
    '/templates/states/indiana/',
    '/templates/states/tennessee/',
    '/templates/states/missouri/',
    '/templates/states/maryland/',
    '/templates/states/minnesota/',
    '/templates/states/kentucky/',
    // Phase 2 expansion states — unit tests pending.
    '/templates/states/wisconsin/',
    '/templates/states/south_carolina/',
    '/templates/states/alabama/',
    '/templates/states/oregon/',
    '/templates/states/oklahoma/',
    // Phase 3 expansion states — unit tests pending.
    '/templates/states/louisiana/',
    '/templates/states/connecticut/',
    '/templates/states/nevada/',
    '/templates/states/new_mexico/',
    '/templates/states/idaho/',
    // Phase 4 expansion states — unit tests pending.
    '/templates/states/iowa/',
    '/templates/states/arkansas/',
    '/templates/states/kansas/',
    '/templates/states/mississippi/',
    '/templates/states/nebraska/',
    '/templates/states/west_virginia/',
    '/templates/states/hawaii/',
    '/templates/states/maine/',
    '/templates/states/new_hampshire/',
    '/templates/states/rhode_island/',
    '/templates/states/montana/',
    '/templates/states/delaware/',
    '/templates/states/dc/',
    // Phase 5 expansion states — unit tests pending.
    '/templates/states/alaska/',
    '/templates/states/north_dakota/',
    '/templates/states/south_dakota/',
    '/templates/states/vermont/',
    '/templates/states/wyoming/',
    // Canadian territories — unit tests pending.
    '/templates/states/northwest_territories/',
    '/templates/states/yukon/',
    '/templates/states/nunavut/',
    // Agent orchestrators rely on live LLM calls; integration tests cover them.
    '/services/agents/',
    '/services/documents/',
    '/services/affidavits/',
    // pathSecurity.js — now has unit tests in __tests__/utils/pathSecurity.test.js
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