// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import securityPlugin from 'eslint-plugin-security';
import complexityPlugin from 'eslint-plugin-complexity';
import sonarjsPlugin from 'eslint-plugin-sonarjs';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'node_modules/**',
      'jest.config.js',
      'prisma.config.*',
      'prisma/**/*.ts',
      'prisma/prisma.config.*',
      'scripts/**/*.js',
      'scripts/**/*.cjs',
      'src/**/*.js',
    ],
  },

  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,

  // Language & resolver config
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        allowDefaultProject: true,
      },
    },
    settings: {
      'import/resolver': {
        node: {},
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },

  // Plugins & rules MUST be inside an object
  {
    plugins: {
      security: securityPlugin,
      complexity: complexityPlugin,
      sonarjs: sonarjsPlugin,
    },

    rules: {
      // TypeScript safety
      '@typescript-eslint/no-explicit-any': 'off', // 1889
      '@typescript-eslint/no-unsafe-assignment': 'off', // 1750
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Async & unused
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/unbound-method': 'off',

      // Code quality
      'prefer-const': 'error',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-magic-numbers': ['off', { ignore: [0, 1, -1] }],
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'warn',

      // Import rules
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
      'import/no-unused-modules': 'warn',

      // Security
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',

      // Complexity
      complexity: ['off', 10],
      'max-depth': ['off', 4],
      'max-lines': ['off', 300],
      'max-lines-per-function': ['off', 50],
      'max-params': ['off', 4],

      // SonarJS
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/cognitive-complexity': ['off', 15],
      'sonarjs/no-collapsible-if': 'off',
      'sonarjs/no-redundant-jump': 'off',
      'sonarjs/prefer-immediate-return': 'off',
    },
  },
);
