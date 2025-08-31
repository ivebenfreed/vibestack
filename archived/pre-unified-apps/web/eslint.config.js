import globals from 'globals'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactCompiler from 'eslint-plugin-react-compiler'
import rootConfig from '../../eslint.config.mjs'

// Start with root config and add web-specific rules
export default [
  ...rootConfig,
  {
    ignores: ['dist', 'src/components/ui', 'src/routeTree.gen.ts'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      '@tanstack/query': pluginQuery,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react-compiler': reactCompiler,
    },
    rules: {
      // React-specific rules
      ...reactHooks.configs.recommended.rules,
      'react-compiler/react-compiler': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // TanStack Query rules
      ...pluginQuery.configs['flat/recommended'].rules,
      
      // Override root config - stricter for web app
      'no-console': 'error', // Already set in root for web files, but being explicit
    },
  },
]