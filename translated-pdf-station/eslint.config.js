/**
 * @file eslint.config.js
 * @description Flat-config entry for the template's quality gate.
 *
 * Layered like this:
 *
 *   1. Globals + ignores.
 *   2. The "human-grade" recommended sets (`js`, `tseslint`, `react`,
 *      `react-hooks`, `react-refresh`) plus `prettier` to silence
 *      formatter-style conflicts.
 *   3. The AI-agent-friendly local plugin (`eikon`) — banner, filename
 *      ↔ export linkage, filename casing per directory glob.
 *   4. Workspace boundary rules — `import/no-restricted-paths` plus
 *      `import/no-default-export` to keep grep-ability high.
 *   5. Size cap (`max-lines`) so single files don't grow past what an
 *      agent can hold in one context window.
 *   6. Per-area overrides (test files larger cap, config files allow
 *      default-export, etc.).
 *
 * See `docs/quality-system.md` for the full design rationale and
 * `.agent/rules/80-quality-system.md` for the agent-facing summary.
 */

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

import eikon from './eslint-rules/index.js';

// =================================================================================================
// AI-friendly filename casing table
// =================================================================================================
//
// Ordered. The first matching glob wins. Each entry is a `case` plus
// the directory shape it owns; together they encode the conventions
// from `00-architecture.md` (feature-first) and `10-react-conventions.md`
// (PascalCase components, camelCase hooks/utils, kebab-case shadcn ui).

const FILENAME_CASE_RULES = [
  // -- App shell --
  { glob: 'src/app/layouts/**/*.tsx', case: 'PascalCase' },
  { glob: 'src/app/pages/**/*.tsx', case: 'PascalCase' },

  // -- Feature components / pages --
  { glob: 'src/features/*/components/**/*.tsx', case: 'PascalCase' },
  { glob: 'src/features/*/pages/**/*.tsx', case: 'PascalCase' },

  // -- Feature class-shaped services (interface + impl) --
  {
    glob: 'src/features/*/services/interfaces/**/*.ts',
    case: 'PascalCase',
  },
  {
    glob: 'src/features/*/services/implementations/**/*.ts',
    case: 'PascalCase',
    // Helpers that ship next to implementations (mockData, fixtures …).
    skip: ['mockData'],
  },

  // -- Feature camelCase modules --
  { glob: 'src/features/*/services/factory/**/*.ts', case: 'camelCase' },
  { glob: 'src/features/*/services/*.ts', case: 'camelCase' },
  { glob: 'src/features/*/store/**/*.ts', case: 'camelCase' },
  { glob: 'src/features/*/stores/**/*.ts', case: 'camelCase' },
  { glob: 'src/features/*/selectors/**/*.ts', case: 'camelCase' },
  { glob: 'src/features/*/hooks/**/*.ts', case: 'camelCase' },

  // -- Tests follow source convention. We restrict to .tsx → PascalCase
  //    component tests so .ts store/service tests still satisfy camelCase
  //    via the catch-alls below.
  {
    glob: 'src/features/*/__tests__/components/**/*.tsx',
    case: 'PascalCase',
  },
  { glob: 'src/features/*/__tests__/pages/**/*.tsx', case: 'PascalCase' },

  // -- shared/ui — shadcn lineage (kebab-case) --
  { glob: 'src/shared/ui/**/*.tsx', case: 'kebab-case' },

  // -- shared/* JS/TS modules (camelCase) --
  { glob: 'src/shared/lib/**/*.ts', case: 'camelCase' },
  { glob: 'src/shared/hooks/**/*.ts', case: 'camelCase' },
  { glob: 'src/shared/stores/**/*.ts', case: 'camelCase' },
  { glob: 'src/shared/theme/**/*.ts', case: 'camelCase' },
  { glob: 'src/shared/services/**/*.ts', case: 'camelCase' },
  { glob: 'src/shared/supabase/**/*.ts', case: 'camelCase' },
  { glob: 'src/shared/i18n/**/*.ts', case: 'camelCase' },
];

// =================================================================================================
// Default-export allowlist
// =================================================================================================
//
// Component / module files MUST use named exports (grep-friendly,
// refactor-safe). The exceptions below are framework entrypoints or
// config files that callers expect to default-export.

const ALLOW_DEFAULT_EXPORT_FILES = [
  'src/main.tsx',
  'src/App.tsx',
  // The i18n bootstrap exports the singleton as default for direct
  // `import i18n from '@/shared/i18n'` access alongside its named
  // exports (initI18n, loadNamespace).
  'src/shared/i18n/index.ts',
  '**/vite.config.ts',
  '**/vitest.config.ts',
  '**/vitest.browser.config.ts',
  '**/eslint.config.js',
  '**/*.config.{js,ts,mjs,cjs}',
];

// =================================================================================================
// Flat config
// =================================================================================================

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      '.vite',
      // On-demand build cache produced by packages/preview-site (see
      // packages/preview-site/server/builder.ts). Contents are stripped
      // copies of src/ and will routinely violate import/order etc.
      '.preview-cache',
    ],
  },

  // -----------------------------------------------------------------------------------------------
  // Plugin registration — done in its own block (no `files` filter) so every
  // downstream override can reference these plugins regardless of which
  // extension it targets. Without this, `eslint-rules/**/*.js` overrides
  // referencing `eikon/...` rules would fail with "could not find plugin".
  // -----------------------------------------------------------------------------------------------

  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
      eikon,
    },
  },

  // -----------------------------------------------------------------------------------------------
  // Base layer — recommended sets + project-wide rules
  // -----------------------------------------------------------------------------------------------

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactPlugin.configs.flat.recommended,
      reactPlugin.configs.flat['jsx-runtime'],
      prettier,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: '19.0' },
      'import/resolver': {
        typescript: { project: './tsconfig.app.json' },
        node: true,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // -- AI-agent-friendly quality gate ----------------------------------
      'eikon/file-header-banner': ['error', { minDescription: 10 }],
      'eikon/filename-matches-export': 'error',
      'eikon/filename-case-by-path': ['error', { rules: FILENAME_CASE_RULES }],

      // -- File size cap ----------------------------------------------------
      // 400-line cap balances Agent context-window comfort with the need
      // to host the v1 banner + section separators + per-export JSDoc.
      // Tests get 600 (covered by override below). Generated files /
      // fixtures should ignore via inline `eslint-disable`.
      'max-lines': [
        'error',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],

      // -- Named exports keep file ↔ symbol mapping greppable ---------------
      'import/no-default-export': 'error',

      // -- Source files follow the v1 banner-comment style with three
      //    sub-sections inside the external group (Core / Core-related /
      //    Third-party). `always-and-inside-groups` keeps the top-level
      //    builtin→external→internal→relative ordering AND tolerates
      //    blank lines + custom ordering inside each group so the banners
      //    stay legible. Alphabetisation is intentionally NOT enforced
      //    here for the same reason.
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always-and-inside-groups',
          pathGroups: [
            { pattern: '@/**', group: 'internal', position: 'before' },
            { pattern: '@test/**', group: 'internal', position: 'before' },
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/features/*/!(index.ts|routes.tsx)',
              from: './src/features/*/!(index.ts|routes.tsx)',
              except: ['./src/features/$1/**'],
              message:
                'Cross-feature imports must go through the feature index.ts barrel.',
            },
            {
              target: './src/shared',
              from: './src/features',
              message: 'shared/ must not depend on features/.',
            },
            {
              target: './src/app',
              from: './src/features/*/!(index.ts|routes.tsx)',
              message:
                'app/ may only import a feature via its public index.ts/routes.tsx.',
            },
          ],
        },
      ],
    },
  },

  // -----------------------------------------------------------------------------------------------
  // Overrides
  // -----------------------------------------------------------------------------------------------

  // Allow default-export in framework entrypoints + config files.
  {
    files: ALLOW_DEFAULT_EXPORT_FILES,
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // Tests get a higher max-lines budget (one file often hosts many
  // arrange-act-assert blocks for a single store or component).
  {
    files: [
      '__tests__/**/*.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],
    rules: {
      'max-lines': [
        'error',
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
      // Tests intentionally export nothing or export only helpers; relax
      // the filename-export link there.
      'eikon/filename-matches-export': 'off',
    },
  },

  // The local ESLint plugin lives in `eslint-rules/` and ships as plain
  // ESM JS. Skip the heavier rules on it.
  {
    files: ['eslint-rules/**/*.js'],
    rules: {
      'eikon/file-header-banner': ['error', { minDescription: 10 }],
      'eikon/filename-matches-export': 'off',
      'eikon/filename-case-by-path': 'off',
      'import/no-default-export': 'off',
    },
  },

  // Config files at the repo root: no banner / case rules.
  {
    files: ['*.config.{js,ts,mjs,cjs}', 'eslint.config.js'],
    rules: {
      'eikon/file-header-banner': 'off',
      'eikon/filename-matches-export': 'off',
      'eikon/filename-case-by-path': 'off',
    },
  },

  // Ambient `.d.ts` files (vite-env, generated reference shims) carry
  // only triple-slash directives or module-augmentation declarations.
  // The banner / filename / default-export rules are all noise here.
  {
    files: ['**/*.d.ts'],
    rules: {
      'eikon/file-header-banner': 'off',
      'eikon/filename-matches-export': 'off',
      'import/no-default-export': 'off',
    },
  },

  // -----------------------------------------------------------------------------------------------
  // Vendored UI snapshots (--ui shadcn / --ui animate-ui)
  // -----------------------------------------------------------------------------------------------
  // For `--ui shadcn` / `--ui animate-ui` the `applyUiSnapshot` step at
  // scaffold time writes `eslint.config.ui-snapshot.js` listing the
  // upstream-vendored paths and turning off project-shaped rules
  // (banner / import-order / max-lines / etc.) on those files only.
  // The dynamic import below is a no-op for `--ui custom` (the file
  // doesn't exist) and a no-op in the template-react package itself
  // (also no file), so the strict rules still apply to project-authored
  // primitives.
  ...((await loadOptional('./eslint.config.ui-snapshot.js')) ?? [])
);

/**
 * Best-effort import of an optional flat-config fragment. Returns the
 * default export when the file exists, `null` otherwise. Avoids
 * eslint blowing up on missing snapshot configs.
 */
async function loadOptional(specifier) {
  try {
    const mod = await import(specifier);
    return mod.default ?? null;
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw err;
  }
}
