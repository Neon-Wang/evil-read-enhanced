---
id: customize-toast
title: Customize the toast notification
description: Adjust the toast position, tweak styling (classNames), change Sonner props, or (rarely) swap the underlying library. Business code keeps using `toast.success/error/info/...` from `@/shared/ui/toaster` regardless.
keywords:
  [
    toast,
    notification,
    snackbar,
    sonner,
    toaster,
    position,
    banner,
  ]
applies_to:
  - "src/shared/ui/toaster.tsx"
---

# Skill: customize the toast / notification

Use whenever the user asks to "change how toasts look", "move
notifications to the bottom", "use a different toast style", "switch to
react-hot-toast", or similar. The imperative API
(`toast.success('...')`, `toast.error('...')`, etc.) is **identical
regardless of configuration** — business code in features never changes.

## Architecture (one-screen primer)

```
src/app/providers.tsx           ← owns ALL toast config (variant strip + visual defaults)
   │   • INITIAL_TOAST_POSITION array gated by @eikon:variant(toastPosition=...)
   │   • TOAST_OPTIONS — Eikon-tuned classNames (rounded, border, bg via design tokens)
   │   • DEV postMessage bridge for live playground swap
   └── <Toaster richColors closeButton position={...} toastOptions={TOAST_OPTIONS} />

src/shared/ui/toaster.tsx        ← thin pure pass-through (no defaults of its own)
   │   • re-exports `toast` from 'sonner'   ← identical API everywhere
   └── return <SonnerToaster {...props} />
       (the snapshot files at template-snapshots/<ui>/ are 1:1 from upstream
        and likewise spread `...props`, so providers' wiring drives every --ui)
```

The toast **styling** is design-driven — `TOAST_OPTIONS.classNames` in
providers.tsx references CSS tokens (`--color-card`, `--color-border`,
`--radius-md`, `--surface-border-width`) that each design preset already
overrides. No per-toast-style files exist; the active `design` preset
controls the look automatically. For `--ui shadcn` / `--ui animate-ui`
the registry snapshots additionally reference shadcn token names
(`--popover`, `--border`, `--radius`, `--color-popover`) — those are
aliased to the Eikon equivalents at the top of `src/styles/index.css`,
so the same design preset cascade flows through.

The only user-facing toast config is **position** (`--toast-position`):
`top-right` (default), `top-center`, `bottom-center`, `bottom-right`.

## How position wiring works

Position is selected at scaffold time via `--toast-position <value>`.
Inside `src/app/providers.tsx`, the `@eikon:variant(toastPosition=...)`
markers narrow the array to one entry:

```tsx
const INITIAL_TOAST_POSITION = ([
// @eikon:variant(toastPosition=top-center) begin
  'top-center',
  // ...
].at(0) ?? 'top-right') as ToastPosition;
```

After strip, only the chosen position string survives. The provider
renders `<Toaster position={toastPosition} ... />`; `toaster.tsx` (and
the shadcn / animate-ui snapshot equivalents) just forward every prop
to Sonner — so the same wiring drives every `--ui` choice.

## Decision tree — which task am I doing?

```
Is the user asking to …
├── "move toasts to the bottom" / "change position"
│       → Task A: change the default position
├── "make toasts rounder / add blur / tweak styling"
│       → Task B: edit classNames in toaster.tsx
├── "remove the close button" / "change duration"
│       → Task C: edit Sonner props
└── "switch to react-hot-toast / radix-ui"
        → Task D: library swap (rare)
```

---

## Task A — change the default position

Two places:

1. **CLI default** — edit
   [packages/create-eikon-react/src/strip-features.ts](../../../../create-eikon-react/src/strip-features.ts)
   `DEFAULT_VARIANTS.toastPosition`:

   ```ts
   toastPosition: 'bottom-center',   // ← was 'top-right'
   ```

2. **Playground default** — edit
   [packages/preview-site/src/lib/params-schema.ts](../../../../preview-site/src/lib/params-schema.ts)
   the `toastPosition` param's `default` field.

---

## Task B — tweak toast styling

Edit `src/app/providers.tsx`, specifically the `TOAST_OPTIONS.classNames`
object. Use design tokens so the style responds to presets and dark mode:

```tsx
const TOAST_OPTIONS = {
  classNames: {
    toast: 'rounded-[var(--radius-md)] border-[length:var(--surface-border-width)] ...',
    title: 'text-sm font-medium',
    description: 'text-xs text-[var(--color-muted-foreground)]',
  },
} as const;
```

These flow through the `<Toaster ... toastOptions={TOAST_OPTIONS} />`
spread to Sonner regardless of `--ui`, so all three UI choices pick up
the same Eikon-tuned look.

---

## Task C — change Sonner props

Edit the `<Toaster>` props in `src/app/providers.tsx`:
`richColors`, `closeButton`, `expand`, `duration`, `offset`, `gap`,
`visibleToasts`, `theme`, etc. The `toaster.tsx` wrapper is a pure
pass-through — never edit it for prop tweaks. See Sonner docs for the
full list.

---

## Task D — switch the underlying library (advanced)

Only when explicitly requested. Keep the dispatcher surface intact:

1. Add new library, remove sonner.
2. Rewrite `toaster.tsx` to render the new library's provider.
3. Write an adapter that exports a `toast` object with the same
   method signatures (`success`, `error`, `info`, `promise`, `message`).
4. Run `pnpm lint && pnpm typecheck && pnpm test`.

---

## Immutable rules

1. **The dispatcher exports are fixed.** Always re-exports `Toaster`
   (the component) AND `toast` (the imperative API). Feature code
   imports only from `@/shared/ui/toaster`.
2. **Style tokens over hardcoded values.** Card colours, borders, and
   shadows reference design tokens so presets and dark mode flow through.
3. **Single mount point.** `<Toaster />` is mounted in
   `src/app/providers.tsx` — never add a second.

## Common mistakes

- **Hard-coding position in business code.** Don't use Sonner's per-call
  `position` override. The global position should win.
- **Adding a `<Toaster>` elsewhere.** Renders duplicate toasts.

## See also

- [src/shared/ui/toaster.tsx](../../../src/shared/ui/toaster.tsx)
- [src/app/providers.tsx](../../../src/app/providers.tsx)
- [packages/create-eikon-react/src/strip-features.ts](../../../../create-eikon-react/src/strip-features.ts)
