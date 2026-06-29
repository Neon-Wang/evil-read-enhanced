---
id: ui-axis
title: UI primitive library (`--ui` axis)
description: How `--ui custom`, `--ui shadcn`, and `--ui animate-ui` differ, where primitives live, and which library to extend when adding new ones.
applies_to: ["src/shared/ui/**", "src/features/**/components/**"]
severity: must
---

# UI primitive library

The scaffold's `--ui` flag picks which component library lives under `src/shared/ui/`. The choice is made at scaffold time and baked into the project — there is **no runtime swap**.

| `--ui` value  | What ships in `src/shared/ui/`                                         | `components.json` | When to choose                                            |
| ------------- | ----------------------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| `custom`      | Project-authored Radix wrappers + `motion/react` + `cva`               | absent            | You want to own every primitive end-to-end                |
| `shadcn`      | Official [shadcn](https://ui.shadcn.com/) registry components, copy-pasted in | present | You want shadcn's exact primitives + `npx shadcn add`     |
| `animate-ui` (default) | [animate-ui](https://animate-ui.com/) registry components — shadcn-compatible primitives with motion built in | present | You want shadcn ergonomics + first-class motion           |

## How `--ui` actually works

The choice is resolved at scaffold time by `applyUiSnapshot()` in
[`packages/create-eikon-react/src/apply-ui-snapshot.ts`](../../../create-eikon-react/src/apply-ui-snapshot.ts):

1. The CLI ships pre-baked snapshots at
   `packages/create-eikon-react/template-snapshots/{shadcn,animate-ui}/` —
   each contains its own `src/shared/ui/*.tsx`, a `components.json`, and a
   `package-deps.json` listing the runtime deps that library needs.
2. When you pick `--ui shadcn` or `--ui animate-ui`, the CLI:
   - Deletes the seven REPLACEABLE primitives from the project's
     `src/shared/ui/` (the project-authored ones).
   - Copies the snapshot's `src/shared/ui/*.tsx` over them.
   - Writes the snapshot's `components.json` to the project root (so
     `npx shadcn add <next>` keeps working post-scaffold).
   - Merges the snapshot's `package-deps.json` into the project's
     `package.json` `dependencies`.
3. When you pick `--ui custom`, none of that happens — the
   project-authored files already in the template are exactly what
   you get.

The snapshots themselves are produced by
[`packages/create-eikon-react/scripts/sync-ui-snapshots.mjs`](../../../create-eikon-react/scripts/sync-ui-snapshots.mjs)
(maintainer-only; runs the upstream registry CLIs in a sandbox and
copies the result). End users never touch that script.

## What's project-owned, what's library-replaced

- **Always project-owned, regardless of `--ui`**:
  `theme-toggle.tsx`, `language-switcher.tsx`. These wire i18n + theme
  toggles and aren't part of any UI registry; the scaffold owns them
  in every variant.
- **Project-owned only when `--ui custom`**: the **twenty** primitives in
  `REPLACEABLE_UI_FILES` at
  [apply-ui-snapshot.ts:74](../../../create-eikon-react/src/apply-ui-snapshot.ts) —
  the original 7 (`button.tsx`, `dialog.tsx`, `tabs.tsx`, `sheet.tsx`,
  `command.tsx`, `card.tsx`, `toaster.tsx`) plus the 13 form / display
  primitives shipped by the design-system audit pass (`input.tsx`,
  `textarea.tsx`, `label.tsx`, `select.tsx`, `checkbox.tsx`,
  `radio-group.tsx`, `switch.tsx`, `badge.tsx`, `avatar.tsx`,
  `skeleton.tsx`, `tooltip.tsx`, `popover.tsx`, `alert.tsx`).
- **Library-replaced when `--ui shadcn` or `--ui animate-ui`**: the same
  twenty primitives — sourced from the matching snapshot.

After scaffold, **you own all of these files** — there's no runtime
swap, no `--ui` switch in the generated project. Editing any primitive
is just editing your code.

## Where primitives live

- All ui primitives live in `src/shared/ui/`. Each primitive is one file named in lowercase (`button.tsx`, `dialog.tsx`, `tabs.tsx`, `card.tsx`, `toaster.tsx`).
- Primitives are **never** feature-specific. Anything visual that exists only inside one feature lives in `features/<feature>/components/`.

## Adding a new primitive

The right path depends on `--ui`:

- **`--ui shadcn`** — run `npx shadcn@latest add <name>` and let the registry write the file. `components.json` at the project root tells the CLI where to put things. Upstream docs: <https://ui.shadcn.com/docs/components>.
- **`--ui animate-ui`** — run `npx shadcn@latest add https://animate-ui.com/r/<name>.json` (animate-ui ships a shadcn-compatible registry). Upstream docs: <https://animate-ui.com/docs>.
- **`--ui custom`** — author the primitive yourself in `src/shared/ui/<name>.tsx`:
  1. If the primitive has accessibility semantics (menus, dialogs, popovers, tooltips, switches, tabs, accordions), build on the matching `@radix-ui/react-*` package.
  2. Define `cva` variants, wrap in `forwardRef`, compose with `motion/react` where animation is needed.
  3. Use theme tokens (`var(--color-primary)`, `var(--radius-md)`) — never raw hex.
  4. Primitives are covered by the structural test in `shared-shape.test.ts` plus integration tests in feature folders. There is no `src/shared/ui/__tests__/` directory by convention.

## Adding a new primitive to the *snapshots* (maintainers only)

If you're modifying the CLI itself to add a new primitive that should
exist for all three `--ui` choices, three places must move together:

1. `REPLACEABLE_UI_FILES` in `apply-ui-snapshot.ts`.
2. The COMPONENTS sync list in
   `packages/create-eikon-react/scripts/sync-ui-snapshots.mjs`.
3. The corresponding entry in the animate-ui registry mapping inside
   the same script.

A parity test asserts these three lists stay in lock-step.

See [src/shared/ui/button.tsx](../../src/shared/ui/button.tsx) for the canonical example *under whichever library this project was scaffolded with*.

## Modal primitives (`dialog`, `sheet`, `command`)

The template ships three overlay primitives. Pick by *intent*, not aesthetics — see [skills/add-modal/SKILL.md](../skills/add-modal/SKILL.md) for the full decision tree.

- **`src/shared/ui/dialog.tsx`** — centred overlay built on `@radix-ui/react-dialog`. Use for confirmations, forms, sized panels, nested confirms, or a fullscreen surface (override `DialogContent`'s `className` with `left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none p-0`). The `<DialogTitle>` + `<DialogDescription>` pair is required for a11y — if a use case truly has no description, pass an empty `description=""` instead of skipping it.
- **`src/shared/ui/sheet.tsx`** — edge-anchored drawer with `side="top" | "right" | "bottom" | "left"`. Header + footer stay pinned; `<SheetBody>` owns its own vertical scroll. Top/bottom panels grow to fit content up to `max-h-[80vh]`. **Note:** the file ships behind the `@eikon:variant(layout=mobile-drawer) file` marker — it is only kept for the `mobile-drawer` layout out of the box. To use a Sheet under a different layout, copy the file (and drop the marker) into your scaffolded project.
- **`src/shared/ui/command.tsx`** — searchable command palette wrapping [`cmdk`](https://cmdk.paco.me). Exports `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`. The file ships unconditionally with every scaffold; the only consumer in the unstripped template is the examples showcase, but end users are free to import `Command*` from `@/shared/ui/command` in their own pages. Bind ⌘K / Ctrl+K with a `keydown` listener that calls `preventDefault()` before toggling `open`.

For a globally-openable Modal driven by a store (auth, role switcher, app-wide composer), mirror the `features/auth` feature: a vanilla zustand store + selectors + a controlled `XModal` + an `XModalMount` mounted next to `<Toaster />` in [src/app/providers.tsx](../../src/app/providers.tsx). The Modal primitive stays presentational; the Mount wrapper owns toasts + i18n preload.

These three primitives + the feature-level Modal pattern are showcased end-to-end in `features/examples`: `DialogShowcasePage` (basics / sizes / nested / fullscreen), `SheetShowcasePage` (4 sides + scrollable body), `CommandShowcasePage` (⌘K + inline) and `SignInModalShowcasePage` (mount + 2 triggers). Use those pages as runnable references when extending behaviour.

## Toast notifications

- Toasts are mounted exactly once in [src/app/providers.tsx](../../src/app/providers.tsx) via `<Toaster />` from `@/shared/ui/toaster`. Business code fires events imperatively via `import { toast } from '@/shared/ui/toaster'` (`toast.success`, `toast.error`, `toast.promise`, …). The imperative API surface comes from [`sonner`](https://sonner.emilkowal.ski/).
- Toast **styling** is design-driven — it reads CSS tokens (`--color-card`, `--color-border`, `--radius-md`, `--surface-border-width`) that the active design preset already controls. No separate style files exist; the design preset determines the look automatically.
- Toast **position** is the only user-facing config (`--toast-position`): `top-right` (default), `top-center`, `bottom-center`, `bottom-right`. Position is wired via `@eikon:variant(toastPosition=...)` markers inside [src/app/providers.tsx](../../src/app/providers.tsx) — `<Toaster position={...}>` is a pure pass-through to Sonner so the registry snapshots for `--ui shadcn` / `--ui animate-ui` accept the same prop without per-snapshot patching.
- Tweaking toast styling or position is covered in [skills/customize-toast/SKILL.md](../skills/customize-toast/SKILL.md).

## When to use `motion/react`

Applies under `--ui custom` (project authoring) and `--ui animate-ui` (the registry components already use motion). For `--ui shadcn`, defer to shadcn's own animation conventions (CSS transitions, `data-state` attributes).

Reach for `motion/react` when one of these is true:

- The animation involves **enter/exit** transitions of conditional UI (`<AnimatePresence>`).
- The animation involves **layout shifts** that need spring physics (`layout`).
- The animation involves **gesture-driven** values (`whileHover`, `whileTap`, drag).
- You need **shared element** transitions between routes.

Use a plain Tailwind utility (`transition-colors`, `transition-transform`, `duration-150`) when:

- The animation is a one-shot color, opacity or transform change tied to a state class (`hover:`, `focus-visible:`).
- The cost of bringing in `motion/react` for this component would be the only reason for an extra render.

## Motion guidelines

- Default transition: `{ type: 'spring', stiffness: 380, damping: 28 }` for UI; `{ duration: 0.15 }` for simple opacity fades.
- Respect prefers-reduced-motion. Wrap large layout animations in a check:

  ```tsx
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ```

  (Or pass `transition={{ duration: reduce ? 0 : 0.2 }}`.)
- Don't animate `width`/`height` from layout — animate `scale`, `transform`, `opacity` instead.
- Each motion component must remain useful **without** motion: if `motion` were stripped, the component should still render correctly statically.

## Don't

- Don't pull in `framer-motion` or `react-spring`. Use `motion` only.
- Don't add a parallel "design system" folder. Everything ui lives under `src/shared/ui/`.
- Don't render `motion.*` components inside loops without keys — `<AnimatePresence>` requires stable keys.
- Don't mix libraries — once `--ui` is chosen, keep all primitives under that library. Mixing shadcn + animate-ui in the same project means two motion philosophies fighting each other.
