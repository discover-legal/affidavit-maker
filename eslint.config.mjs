import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-img-element': 'warn',
      // Next 16's preset enables React Compiler-oriented rules. This app does
      // not enable the compiler yet, and its legacy stateful components use
      // valid effect/ref patterns that those advisory rules intentionally
      // reject. Keep the correctness rules used before the migration while
      // the remaining JS components are converted deliberately.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  globalIgnores([
    'client/**',
    'node_modules/**',
    '.next/**',
    'documents/**',
    'coverage/**',
  ]),
]);
