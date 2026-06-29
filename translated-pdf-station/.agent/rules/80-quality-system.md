---
id: quality-system
title: Quality system — structure guard + AI-friendly lint
description: The two-layer quality model (structural guards in vitest + AI-friendly lint via the local eikon plugin). Read this before changing source layout, banners, filenames, or file size.
applies_to: ["src/**", "__tests__/**", ".github/workflows/**", "eslint-rules/**"]
severity: must
---

# Quality system

This template ships a two-layer quality model. **Both layers are
mandatory** and both fail the CI pipeline shipped at
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

| Layer | Where | Catches | What break means |
|---|---|---|---|
| Structural guard | `__tests__/structure/*.test.ts` | Filesystem layout, public API barrel, i18n parity, app shell wiring, repo-root files, import boundaries | **High probability of runtime bug**. Stop and fix the shape — do not relax the test. |
| Quality gate | `eslint.config.js` + `eslint-rules/` | File header banner, filename ↔ export linkage, per-directory filename casing, file size cap, named-export discipline, import order | **Long-term agent-navigability regression**. Run `pnpm lint:fix`, then fix what auto-fix can't. |

`pnpm check` runs the full local stack: `typecheck → lint → test`.

`pnpm ci` is identical plus `build` and is what CI invokes.

`pnpm test:structure` runs only the 12 structural tests (fast, for
inner-loop iteration).

Note on `.agent/`: the meta-protocol surface (rules, skills, this
file) is intentionally NOT covered by either layer. It is the agent's
own working surface — rules they author, skills they iterate on,
README they curate — and gating it with tests would just create
friction in the layer we want the agent to feel free to mutate. Treat
the conventions in `.agent/README.md` as guidance, not as a gate.

---

## Structural guard

Lives under [`__tests__/structure/`](../../__tests__/structure/) with
a shared helper [`_helpers.ts`](../../__tests__/structure/_helpers.ts).
The 12 specs map 1:1 to the structural concerns in
[`00-architecture.md`](./00-architecture.md):

| Spec | Guards |
|---|---|
| `feature-shape.test.ts` | Per-feature directory shape (pure-client vs data-layer) and allowlist of top-level files/dirs |
| `feature-public-api.test.ts` | Each feature `index.ts` exports the canonical set of symbols and does not leak private subpaths |
| `feature-i18n-parity.test.ts` | en/zh key sets match exactly per feature; key segments are camelCase |
| `app-shell.test.ts` | `src/app/` has providers/router/RootLayout + sibling layout(s) + no feature-flavoured subdirs |
| `apps-shape.test.ts` | Platform-shell directories (`apps/desktop` Tauri 2, `apps/mobile` Capacitor 6) match the build layout each shell expects; absent under `--platform web` |
| `shared-shape.test.ts` | `src/shared/` only contains whitelisted subdirs; barrels exist where required |
| `styles-shape.test.ts` | Only `src/styles/index.css` exists; `@theme` declared; no `tailwind.config.*` |
| `src-root.test.ts` | `src/` root has only `main.tsx`/`App.tsx`/`vite-env.d.ts` + 4 fixed dirs |
| `tests-root.test.ts` | `__tests__/` has setup/test-utils + the 4 fixed subfolders; no loose specs |
| `repo-root-files.test.ts` | Every config file the workflow assumes exists; `package.json` has the full script set |
| `boundary-imports.test.ts` | Rules 1–5 of the import boundary contract enforced via filesystem scan |
| `marker-balance.test.ts` | Per-file balance of `@eikon:variant(axis=value) begin / end` pairs across `src/**/*.{ts,tsx,css}` + root `index.html` |

When adding a new feature, the first three (`feature-shape`,
`feature-public-api`, `feature-i18n-parity`) get coverage automatically
because they iterate `src/features/*`. **Do not** add a per-feature copy.

When adding a new SHARED area (e.g. `shared/analytics/`):
1. Update `ALLOWED_SHARED_DIRS` in
   [`__tests__/structure/shared-shape.test.ts`](../../__tests__/structure/shared-shape.test.ts).
2. Decide whether it's a barrel-required area (a coherent module) or a
   flat collection (files imported individually). Add to
   `BARREL_REQUIRED_DIRS` accordingly.
3. If barrel-required, also add it to `BARREL_REQUIRED_SHARED_AREAS`
   in [`boundary-imports.test.ts`](../../__tests__/structure/boundary-imports.test.ts).
4. Explain the why in the PR description.

---

## Quality gate (lint)

### Local eikon plugin

`eslint-rules/` ships three project-specific rules (zero npm deps):

- **`eikon/file-header-banner`** — first non-leading-comment thing in
  every source file MUST be a JSDoc block with `@file` and a
  non-trivial `@description` (≥10 chars). Allows leading `//` lines
  for `@eikon:feature(...)` markers.
- **`eikon/filename-matches-export`** — file basename must match at
  least one of its exports under any of these candidates: verbatim /
  PascalCase / camelCase / `use<Pascal>` / `I<Pascal>`. Skips
  `index.ts`, `routes.tsx`, `types.ts`, `main.tsx`, `setup.ts`,
  `test-utils.tsx`, `providers.tsx`, `router.tsx`, `mockData.ts`,
  `client.ts`, `vite-env.d.ts`, and any `*.test.*` / `*.spec.*` /
  `*.config.*` / `*.d.ts`.
- **`eikon/filename-case-by-path`** — per-directory casing table. First
  matching glob wins. See `FILENAME_CASE_RULES` in
  [`eslint.config.js`](../../eslint.config.js).

### Built-in rules in play

- **`max-lines`** — 400 lines (source), 600 lines (`__tests__/**`).
  Skips blanks and comment-only lines. Hard-cap motivated by AI
  context-window comfort and "one file = one mental model".
- **`import/no-default-export`** — named exports keep grep / refactor
  reliable. Allowed in framework entrypoints (`main.tsx`, `App.tsx`)
  and config files.
- **`import/no-restricted-paths`** — the same boundary contract that
  `boundary-imports.test.ts` re-asserts at the test layer.
- **`import/order`** — top-level group order; intra-group flexibility
  for the v1 banner sub-headers.

### Common failure → fix mapping

| Lint error | Fix |
|---|---|
| `eikon/file-header-banner missing` | Add `/** @file <name> @description <text> */` at the top of the file (above any code, but below any leading `// @eikon:feature(...)` marker). |
| `eikon/filename-matches-export mismatch` | Rename the file to match the export, or vice versa. If the file truly has no primary export (helper data, fixture), add the basename to `DEFAULT_SKIP_BASENAMES` in the rule and explain in the PR. |
| `eikon/filename-case-by-path wrongCase` | Rename the file. If the directory's case convention is wrong, change `FILENAME_CASE_RULES` and `shared-shape.test.ts` together. |
| `max-lines` | Split the file along section banners. Components → extract subcomponents into siblings. Stores → split write actions into a separate `actions/` file (data-layer features already do this via `selectors/actions.ts`). |
| `import/no-default-export` | Convert to a named export and update callers. The only exceptions live in `ALLOW_DEFAULT_EXPORT_FILES`. |

---

## Why two layers (and not just one)

Structural rules can theoretically all live in ESLint. We split them
because of an Agent behaviour pattern: when an ESLint rule fires
during a generation step, the model often "fixes" it by silencing the
rule (`/* eslint-disable */`) rather than addressing the underlying
shape. ESLint suppressions disappear into a comment, but a failing
**test** is a much louder signal: deleting the test or marking it
`skip` is an obviously suspicious diff in code review.

The lint layer therefore handles drift that's safe to auto-fix or
that requires no structural decision (banner, filename casing, file
size). The test layer handles structural decisions an agent
shouldn't be allowed to "fix" by silencing.

---

## When to add a new rule

Adding to the lint layer is appropriate when:

- The rule produces a clean, single-file diagnostic.
- A future violation is something an agent could trivially auto-fix
  given the rule message.

Adding to the test layer is appropriate when:

- The rule needs to reason about multiple files or whole-directory
  contents.
- Allowing the agent to silence the rule would defeat its purpose.

If unsure, prefer **test layer** for first introductions — promote to
lint later once the rule's friction is understood.
