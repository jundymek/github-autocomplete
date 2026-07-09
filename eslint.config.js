import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // AR-2: src/lib/autocomplete/ is the reusable deliverable and must never import from
    // src/features/** or app/demo code. The import direction is one-way:
    // lib/ <- features/github-search/ <- demo/App. This rule enforces that boundary mechanically.
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/features/*',
                '**/features/**',
                '**/App',
                '**/App.tsx',
                '**/App.ts',
                '**/main',
                '**/main.tsx',
                '**/main.ts',
                '**/demo',
                '**/demo/*',
                '**/demo/**',
              ],
              message:
                'src/lib/autocomplete/ is the reusable deliverable and must never import from src/features/** or app/demo code (AR-2). The import direction is one-way: lib/ <- features/github-search/ <- demo/App.',
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
)
