const tseslint = require('typescript-eslint');
const eslint = require('@eslint/js');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      '@typescript-eslint/semi': 'warn',
      'curly': 'warn',
      'eqeqeq': 'warn',
      'no-throw-literal': 'warn',
      'semi': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: [
      'out/**',
      'dist/**',
      '**/*.d.ts',
      'node_modules/**',
      '.vscode-test/**',
      'mics/**',
      'scripts/**/*.js',
    ],
  }
);

