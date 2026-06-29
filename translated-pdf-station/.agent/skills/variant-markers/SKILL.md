---
id: variant-markers
title: Add or modify a `@eikon:variant` marker
description: How to gate code paths on the design / layout / ui / toastPosition / platform axis using the marker grammar that the CLI's strip-features and the playground's simulate-strip both recognise.
keywords: [variant, marker, eikon, axis, design, layout, ui, toast]
applies_to: ["src/**/*.{ts,tsx,css,html}", "index.html", "package.json"]
---

# Skill: add or modify a `@eikon:variant` marker

Use when the user asks to:
- "add a new design preset"
- "make this code only ship for layout=X"
- "remove a layout option"
- "this should only run on platform=desktop"
- or otherwise wants to gate a region of code on a variant axis.

The variant grammar is the contract the CLI (`packages/create-eikon-react/src/strip-features.ts`) and the playground simulator (`packages/preview-site/server/simulate-strip.ts`) both interpret. **Drift between a marker and that grammar will silently ship the wrong code.**

## The two marker shapes

### File-level (whole file)

First non-shebang line of the file:

```tsx
// @eikon:variant(layout=mobile-drawer) file
```

The CLI deletes the entire file when the chosen `--layout` is anything other than `mobile-drawer`. Used by every `*RootLayout.tsx` and by `src/shared/ui/sheet.tsx` (which is mobile-drawer-only).

### Block-level (region inside a file)

```tsx
```

The CLI deletes the lines between `begin` and `end` (inclusive of both marker lines) when `--design` is not `apple`. JSX comment form `{/* @eikon:variant(...) begin */}` works inside JSX. CSS comment form `/* @eikon:variant(...) begin */` works inside CSS.

## The lock-step contract

A new design preset (or layout, ui, etc.) is NOT just a marker — it's three coordinated changes:

1. **Add the value to the schema** at `packages/preview-site/src/lib/params-schema.ts`'s relevant axis entry.
2. **Add the value to the CLI** at `packages/create-eikon-react/src/index.ts`'s `VARIANT_CHOICES.<axis>` array.
3. **Add the markers** (and the actual code/CSS/whatever) the CLI should ship for the new value.

`packages/create-eikon-react/src/__tests__/cli-schema-parity.test.ts` fences (1) ↔ (2). If you only change one side, the test fails before the diff lands. (3) has its own structural fence — see "Safety nets" below.

## Step list

1. **Identify the axis.** `design`, `layout`, `ui`, `toastPosition`, or `platform`. The schema enumerates them; pick one.

2. **Decide file-level vs block.** A whole layout component → file-level on the layout file. A few CSS rules unique to one design → block-level inside `src/styles/index.css`. A handful of imports specific to platform=mobile → block-level inside the consuming file.

3. **Place the marker.** File-level markers MUST be on the first non-shebang line. Block-level markers MUST balance: every `begin` has a matching `end` in the same file. Both markers MUST live inside the same comment form (line `//`, block `/* */`, or JSX `{/* */}`).

4. **Run the structural fence.** `pnpm --filter @eikon/react test marker-balance` walks every file under `src/`, counts `begin` / `end` pairs per (axis, value) per file, and fails when they don't balance. Run this before every commit that touches markers — drift is silent until then.

5. **Run drift parity.** `pnpm --filter @eikon/preview test strip-drift` enumerates every (platform × supabase) combination, copies `template-react/` to a tmp dir, runs the real `stripFeatures`, and compares the output against the playground's simulator. If your new axis combination breaks parity, this test catches it before the iframe shows the wrong files.

6. **(Adding a new value)** Update the schema and the CLI's `VARIANT_CHOICES.<axis>` together. The parity test in step 5 plus `cli-schema-parity.test.ts` together fence the three-way contract.

## Safety nets

| Fence | What it catches |
|-------|-----------------|
| `marker-balance.test.ts` | Unbalanced `begin`/`end`; misplaced `file` markers (must be line 1) |
| `cli-schema-parity.test.ts` | Schema and CLI disagree on which values exist for an axis |
| `platform-parity.test.ts` | `PLATFORM_OVERRIDES` / `PLATFORM_SCRIPT_TAGS` / `PLATFORM_ROOT_FILES` reference unknown platforms |
| `feature-parity.test.ts` | `PACKAGE_DEPS_BY_FEATURE` and `resolveFeatures` cover every `FeatureFlags` field |
| `strip-drift.test.ts` (playground) | Simulator and real stripper disagree on file presence |

If a marker change passes all five, scaffolds reflect the new variant correctly across the CLI, the playground iframe, and the playground's file panel.

## Common mistakes

- **`begin` without `end`** — the parity test fails loudly. Fix: pair them.
- **`file` marker not on line 1** — `marker-balance` treats it as inert prose. Fix: move it to the first non-shebang line.
- **Comment-form mismatch** — `// begin` / `/* end */` won't be recognised as a pair. Fix: pick one form per pair.
- **Skipping the schema update** — the playground keeps offering the old enum, the CLI accepts the new one, and the iframe rebuilds against a mismatched cache key. Fix: always update both, run `cli-schema-parity.test.ts`.
- **Adding a new axis (not just a value) without telling `simulate-strip`** — the file panel will show wrong content. Fix: extend `simulate-strip.ts`'s axis loop AND `keepAllVariants` in `builder.ts` if the axis is runtime-switchable.

## Cross-references

- Marker grammar source of truth: `packages/create-eikon-react/src/strip-features.ts` (regex literals at the top of the file)
- Schema source of truth: `packages/preview-site/src/lib/params-schema.ts`
- CLI mirror: `packages/create-eikon-react/src/index.ts` — `VARIANT_CHOICES`
- Drift fence: `packages/preview-site/__tests__/strip-drift.test.ts`
- Marker balance fence: `packages/template-react/__tests__/structure/marker-balance.test.ts`
