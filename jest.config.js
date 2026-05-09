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
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/client/',
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

module.exports = createJestConfig(config);
