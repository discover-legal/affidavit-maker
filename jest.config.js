// jest.config.js — Next.js + TypeScript via next/jest preset.
//
// The preset gives us SWC compilation of .ts/.tsx, jsdom by default,
// and proper handling of CSS / static asset imports.

const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  // jsdom by default for component tests; backend tests under
  // __tests__/{services,templates,utils}/ override per-file via the
  // /** @jest-environment node */ pragma.
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@auth0/nextjs-auth0/server$': '<rootDir>/test-mocks/auth0-server.ts',
    '^@auth0/nextjs-auth0/client$': '<rootDir>/test-mocks/auth0-client.tsx',
  },
  // file-type 22 and its tokenizer stack are ESM-only. Let next/jest's SWC
  // transformer compile those packages so upload tests exercise the real
  // magic-byte parser rather than a permissive test double.
  // Prevent Jest's haste map from crawling Next's standalone output. The
  // copied package.json there has the same package name as the repository
  // root and otherwise produces a module naming collision after a build.
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/client/',
    // Shared helpers for the core/ behaviour tests are not suites themselves.
    '<rootDir>/__tests__/core/helpers/',
    '<rootDir>/__tests__/core/.*/_helpers\\.ts$',
    '<rootDir>/__tests__/fixtures/',
    // Legacy backend tests — many target Express middleware/routes that are
    // being removed in Phase 7. Skip until those tests are rewritten or
    // deleted.
    '<rootDir>/__tests__/api/',
    '<rootDir>/__tests__/middleware/',
    '<rootDir>/__tests__/security/',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/.next/', '/client/', '/documents/'],
};

const resolvedConfig = createJestConfig(config);

// next/jest prepends its own node_modules ignore rule after custom settings,
// which would still win for ESM-only packages. Replace the resolved list so
// SWC receives file-type's complete tokenizer graph on both Windows and Unix.
module.exports = async () => {
  const nextConfig = await resolvedConfig();
  return {
    ...nextConfig,
    transformIgnorePatterns: [
      '[\\\\/]node_modules[\\\\/](?!(file-type|strtok3|token-types|uint8array-extras|@tokenizer|@borewit)[\\\\/])',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  };
};
