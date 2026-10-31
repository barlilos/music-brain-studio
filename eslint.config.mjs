import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['out/**', 'release/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node.js context: main process, preload, and the build config.
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'electron.vite.config.ts',
      'vitest.config.ts'
    ],
    languageOptions: {
      globals: globals.node
    }
  },

  // Node.js context: repository tooling that never ships with the app.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node
    }
  },

  // Chromium context: the React renderer.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },

  // Isomorphic context: shared code must not assume Node or the DOM, so it gets
  // neither set of globals. Referencing either is a lint error here.
  {
    files: ['src/shared/**/*.ts'],
    languageOptions: {
      globals: {}
    }
  },

  // Must stay last: switches off every rule that would conflict with Prettier.
  prettier
)
