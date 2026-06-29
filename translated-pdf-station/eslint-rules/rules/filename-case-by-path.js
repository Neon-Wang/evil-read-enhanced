/**
 * @file filename-case-by-path.js
 * @description ESLint rule that enforces a per-directory filename casing
 * scheme via a list of `{ glob, case }` rules.
 *
 * Why per-directory and not a single global case: the template lives at
 * the intersection of conflicting conventions —
 *
 *   - feature pages / components / app layouts → React component
 *     filename convention → `PascalCase.tsx`
 *   - feature stores / selectors / services / hooks → JS module
 *     convention → `camelCase.ts`
 *   - shared/ui primitives (shadcn lineage)     → `kebab-case.tsx`
 *   - class-shaped service implementations      → `PascalCase.ts`
 *
 * Trying to flatten this into one case (as `eslint-plugin-unicorn`'s
 * `filename-case` does) loses information. This rule lets the
 * `eslint.config.js` author wire a single ordered table of
 * `{ glob, case }` entries — the first matching glob wins, and the
 * basename is checked accordingly.
 *
 * Options:
 *   - `rules`: ordered array of `{ glob, case, skip? }`.
 *     `case` ∈ `'PascalCase' | 'camelCase' | 'kebab-case' | 'SCREAMING_SNAKE_CASE'`.
 *     `skip` is an optional array of basenames (without extension) to
 *     pass through unchecked even if the glob matches.
 */

import path from 'node:path';

import { detectCase } from '../lib/case.js';
import { globMatch } from '../lib/glob-match.js';

const meta = {
  type: 'suggestion',
  docs: {
    description: 'Enforce filename casing per directory glob',
  },
  messages: {
    wrongCase:
      "File '{{name}}' must use {{expected}} (matched glob {{glob}}). Detected: {{actual}}.",
    unknownCase:
      "File '{{name}}' uses a case that cannot be classified; expected {{expected}} (matched glob {{glob}}).",
  },
  schema: [
    {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              glob: { type: 'string' },
              case: {
                enum: [
                  'PascalCase',
                  'camelCase',
                  'kebab-case',
                  'SCREAMING_SNAKE_CASE',
                ],
              },
              skip: { type: 'array', items: { type: 'string' } },
            },
            required: ['glob', 'case'],
            additionalProperties: false,
          },
        },
      },
      required: ['rules'],
      additionalProperties: false,
    },
  ],
};

function stripKnownExtensions(base) {
  // `Foo.d.ts` → `Foo`; `Foo.test.tsx` → `Foo`; `foo.css` → `foo`.
  let name = base.replace(/\.[^.]+$/, '');
  name = name.replace(/\.(test|spec|d)$/, '');
  return name;
}

const rule = {
  meta,
  create(context) {
    const opts = context.options[0] || { rules: [] };
    const cwd =
      (context.cwd && String(context.cwd)) ||
      (typeof context.getCwd === 'function' ? context.getCwd() : process.cwd());
    return {
      Program(node) {
        const filename = context.filename || context.getFilename();
        if (!filename || filename === '<input>' || filename === '<text>') return;
        const rel = path.relative(cwd, filename).split(path.sep).join('/');
        for (const r of opts.rules) {
          if (!globMatch(r.glob, rel)) continue;
          const name = stripKnownExtensions(path.basename(filename));
          if (r.skip && r.skip.includes(name)) return;
          const actual = detectCase(name, r.case);
          if (actual === r.case) return;
          context.report({
            node,
            messageId: actual ? 'wrongCase' : 'unknownCase',
            data: {
              name,
              expected: r.case,
              actual: actual || 'unknown',
              glob: r.glob,
            },
          });
          return;
        }
      },
    };
  },
};

export default rule;
