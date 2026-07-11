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
  {
    // AR-2 (inward direction): src/lib/autocomplete/index.ts is the lib's only public API.
    // Consumers outside src/lib/ must import the barrel, never lib internals — so internal
    // files stay renamable and the enumerated barrel exports remain the deliberate contract.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/autocomplete/*', '**/lib/autocomplete/**'],
              message:
                'import from src/lib/autocomplete (the public barrel) — lib internals are not a public API',
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
)
