module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2021
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off'
  },
  ignorePatterns: [
    'node_modules/',
    'client/',
    'documents/',
    'logs/',
    'coverage/'
  ]
};
