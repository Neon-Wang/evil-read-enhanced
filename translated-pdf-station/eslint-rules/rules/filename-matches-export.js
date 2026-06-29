/**
 * @file filename-matches-export.js
 * @description ESLint rule asserting that the file basename matches at
 * least one of its exported symbols.
 *
 * Motivation: AI coding agents grep first, read second. When the file
 * `tasksStore.ts` exports a symbol the agent cannot guess from the
 * filename, every "find where this is defined" prompt costs an extra
 * round-trip. Enforcing the file-name ↔ export-name link makes Cursor
 * / Codex / Claude Code able to jump directly from a usage site to
 * the implementation without an indirection.
 *
 * Matching policy — the rule passes if ANY exported identifier equals
 * any of the following candidates derived from the basename:
 *
 *   - `basename`                            verbatim
 *   - `pascalCase(basename)`                class / interface / component
 *   - `camelCase(basename)`                 instance / function
 *   - `use` + pascalCase(basename)          React hook flavour
 *   - `I` + pascalCase(basename)            interface "I"-prefix flavour
 *
 * This list is intentionally generous so that the rule never fights
 * the established naming conventions in `00-architecture.md`
 * (`tasksStore` / `useThemeStore` / `MockTasksService` / `ITasksService`
 * all pass against their respective filenames).
 *
 * Files skipped by default (filename basename, no extension):
 *   `index`, `routes`, `types`, `main`, `setup`, `test-utils`,
 *   `mockData`, `client`, `vite-env.d`
 *
 * Files skipped by filename suffix: `*.test.*`, `*.spec.*`,
 * `*.config.*`, `*.d.ts`.
 *
 * Files with zero export declarations are skipped (there is nothing
 * to compare against).
 */

import path from 'node:path';

import { camelCase, pascalCase } from '../lib/case.js';

const DEFAULT_SKIP_BASENAMES = new Set([
  'index',
  'routes',
  'types',
  'main',
  'setup',
  'test-utils',
  'mockData',
  'client',
  'vite-env.d',
  // App-shell conventional filenames whose exports are intentionally
  // `App<X>`-prefixed (so they don't shadow library names like Router).
  'providers',
  'router',
  // Selector "section" barrels — the file is named after the section
  // (basic/computed/memoized/actions per `40-state-management.md`),
  // not after any single hook exported from it.
  'basic',
  'computed',
  'memoized',
  'actions',
]);

const SKIP_SUFFIX_PATTERN = /\.(test|spec|config|d)\.[tj]sx?$/;

function collectExportNames(programNode) {
  const names = [];
  for (const n of programNode.body) {
    if (n.type === 'ExportNamedDeclaration') {
      if (n.declaration) {
        const d = n.declaration;
        if (d.type === 'VariableDeclaration') {
          for (const decl of d.declarations) {
            if (decl.id?.type === 'Identifier') names.push(decl.id.name);
          }
        } else if (d.id?.name) {
          names.push(d.id.name);
        }
      }
      for (const spec of n.specifiers || []) {
        const exported = spec.exported;
        if (exported && exported.type === 'Identifier' && exported.name) {
          names.push(exported.name);
        }
      }
    } else if (n.type === 'ExportDefaultDeclaration') {
      const d = n.declaration;
      if (d?.id?.name) names.push(d.id.name);
      else if (d?.type === 'Identifier') names.push(d.name);
      else names.push('default');
    }
  }
  return names;
}

function candidatesFor(basename) {
  const p = pascalCase(basename);
  const c = camelCase(basename);
  return new Set([basename, p, c, 'use' + p, 'I' + p]);
}

const meta = {
  type: 'suggestion',
  docs: {
    description:
      'Require file basename to match at least one of its exported symbols (per the camelCase / PascalCase / use-prefix / I-prefix candidate set)',
  },
  messages: {
    mismatch:
      "Filename '{{base}}' does not match any of its exports. Got [{{exports}}]; expected one of [{{candidates}}].",
  },
  schema: [
    {
      type: 'object',
      properties: {
        skip: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  ],
};

const rule = {
  meta,
  create(context) {
    const opts = context.options[0] || {};
    const userSkip = new Set(opts.skip || []);

    return {
      Program(node) {
        const filename = context.filename || context.getFilename();
        if (!filename || filename === '<input>' || filename === '<text>') return;

        const fullBase = path.basename(filename);
        if (SKIP_SUFFIX_PATTERN.test(fullBase)) return;

        const base = fullBase.replace(/\.[^.]+$/, '');
        const baseStripped = base.replace(/\.d$/, '');

        if (
          DEFAULT_SKIP_BASENAMES.has(base) ||
          DEFAULT_SKIP_BASENAMES.has(baseStripped) ||
          userSkip.has(base) ||
          userSkip.has(baseStripped)
        ) {
          return;
        }

        const exportNames = collectExportNames(node);
        if (exportNames.length === 0) return;

        const candidates = candidatesFor(baseStripped);
        const ok = exportNames.some((n) => candidates.has(n));
        if (ok) return;

        context.report({
          node,
          messageId: 'mismatch',
          data: {
            base: baseStripped,
            exports: exportNames.join(', '),
            candidates: [...candidates].join(', '),
          },
        });
      },
    };
  },
};

export default rule;
