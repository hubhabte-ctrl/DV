/**
 * eslint.config.js — Build Studio frontend
 *
 * Plan 06 Phase 3 — ESLint boundary rules (final Phase 3 item).
 *
 * NOTE: @typescript-eslint/parser is not installed; TypeScript boundary checks
 * run via `scripts/check-boundaries.mjs` (called by `npm run lint`), which uses
 * grep to verify:
 *   (a) packages/** do not import from src/** (reverse boundary — Plan 06 §3.4)
 *   (b) studios do not import each other (IL-1)
 *
 * ESLint itself covers the same patterns on .js / .mjs config/script files.
 *
 * Run: npm run lint
 */

export default [
  /* ── Global ignores ──────────────────────────────────────────────── */
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'packages/*/node_modules/**',
      'db/**',
      // TypeScript files need @typescript-eslint/parser — boundary checked via
      // scripts/check-boundaries.mjs (called by npm run lint)
      '**/*.ts',
      '**/*.tsx',
    ],
  },

  /* ── JS/MJS files — packages must not import from src ── */
  {
    files: ['packages/**/*.js', 'packages/**/*.mjs', 'packages/**/*.cjs'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '\\.{1,2}(\\/\\.{1,2})*\\/src\\/',
              message:
                'packages/** must not import from src/** — reverse boundary violation (Plan 06 §3.4).',
            },
          ],
        },
      ],
    },
  },
];
