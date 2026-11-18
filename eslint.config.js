module.exports = [
  {
    ignores: ['node_modules/**', 'build/**']
  },
  {
    files: ['src/**/*.js', 'webpack/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        document: 'readonly', window: 'readonly', localStorage: 'readonly',
        console: 'readonly', __dirname: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'valid-typeof': 'error',
      'eqeqeq': ['error', 'always']
    }
  }
];
