import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Global ignores
  { 
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.wrangler/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**',
      // Reference code and external libraries
      'ref/**',
      // Generated files
      'apps/web/src/routeTree.gen.ts',
      'apps/web/src/components/ui/**',
      'packages/dataforge/src/generated/**',
      'packages/dataforge/dist/**',
      // Config files
      'vite.*.config.*',
      'vitest.config.*',
      'tailwind.config.*',
      'tsup.config.*',
      // Test files (can have their own config if needed)
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      // Build outputs
      'apps/web/dev-dist/**',
      'apps/server/worker-configuration.d.ts',
      // Scripts that might have different standards
      'scripts/**/*.js',
      'packages/*/scripts/**/*.js',
    ] 
  },
  
  // Base config for all JavaScript files
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
      },
    },
    ...js.configs.recommended,
    rules: {
      // Errors that should be fixed
      'no-unreachable': 'error',
      'no-duplicate-case': 'error',
      'no-empty-pattern': 'error',
      'no-fallthrough': 'error',
      'no-sparse-arrays': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      
      // Warnings for code quality
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-alert': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn',
      
      // Off for flexibility
      'no-unused-vars': 'off', // TypeScript handles this better
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-useless-escape': 'off',
    },
  },
  
  // TypeScript files - more strict
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript errors
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      
      // Off for flexibility  
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      
      // Async/Promise rules - helpful for catching bugs
      '@typescript-eslint/no-floating-promises': ['error', {
        ignoreVoid: true,
        ignoreIIFE: true,
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: false,
      }],
      '@typescript-eslint/await-thenable': 'error',
      
      // Override base rules
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
  
  // Server-specific overrides
  {
    files: ['apps/server/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off', // Logging is expected in server
      '@typescript-eslint/no-floating-promises': 'off', // Workers have different async patterns
    },
  },
  
  // Web app specific overrides
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error', // Console should not be used in production web code
    },
  },
  
  // Migration and script files
  {
    files: ['**/migrations/**/*.ts', 'scripts/**/*.{js,ts}', '**/scripts/**/*.{js,ts}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)