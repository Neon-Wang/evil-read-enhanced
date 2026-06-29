---
id: platform-targets
title: Platform targets — respect the active web/desktop/mobile context
description: Rules every coding agent must follow when editing a generated project so that suggestions stay coherent with the platform it was scaffolded for (web | desktop | mobile).
applies_to: ["src/**", "apps/**", "package.json", "vite.config.ts", "index.html"]
severity: must
---

# Platform targets

Every project scaffolded by `create-eikon-react` is targeted at exactly
**one** of three platforms — `web`, `desktop` (Tauri 2), or `mobile`
(Capacitor 6). The same React app under `src/` runs on all three; the
host shell, layout choices, and a small handful of build flags differ.

When you read a project as a coding agent, **figure out the platform
first**, then constrain every suggestion you make to that platform's
shape.

## Detect the platform first

Use this signal order — the first one that matches wins:

1. `apps/desktop/` exists and `package.json#scripts` contains
   `tauri:dev` → **desktop**.
2. `apps/mobile/` exists and `package.json#scripts` contains
   `cap:sync` → **mobile**.
3. Neither directory exists → **web**.

Cross-check with the layout file under `src/app/layouts/RootLayout.tsx`
— a project on `mobile` will only have one of `MobileDrawerRootLayout`,
`BottomTabsRootLayout`, or `BottomTabsFabRootLayout` left after the
strip.

## Hard rules

### Layout suggestions MUST narrow per platform

| Platform  | Allowed layouts                                                  |
| --------- | ----------------------------------------------------------------- |
| `web`     | `stacked`, `sidebar`, `topbar-sidebar`, `centered`                |
| `desktop` | `stacked`, `sidebar`, `topbar-sidebar`, `centered`                |
| `mobile`  | `centered`, `mobile-drawer`, `bottom-tabs`, `bottom-tabs-fab`     |

- Never propose `sidebar` / `topbar-sidebar` for a mobile project — they
  assume hover and a wide viewport.
- Never propose `mobile-drawer` / `bottom-tabs(-fab)` for a web or
  desktop project — they assume a touch viewport and safe-area insets
  that don't apply.
- If the user asks for "navigation" without specifying, follow their
  platform's default: `stacked` (web), `sidebar` (desktop),
  `mobile-drawer` (mobile).

### Mobile projects MUST respect touch ergonomics

- Every interactive element MUST be at least `var(--touch-target-min)`
  (44px) on its smaller axis. Use the `@utility safe-py` / `safe-pb`
  / `safe-px` / `safe-pt` helpers in `src/styles/index.css` instead of
  hand-rolling `padding: env(safe-area-inset-…)`.
- Use `min-h-dvh` (dynamic viewport) rather than `min-h-screen` on
  full-height containers — iOS Safari's URL bar makes `100vh`
  inaccurate.
- Wrap hover-only affordances in `@media (hover: hover)` so they don't
  fire on tap.
- Prefer `Sheet` (`src/shared/ui/sheet.tsx`) over a custom slide-in
  drawer for any side panel.

### Desktop projects MUST treat Tauri as the host

- Never write code that assumes `window.location.protocol === 'https:'`;
  the production build runs over `tauri://` (or `https://tauri.localhost`
  on Windows).
- File-system, shell, and notification access goes through
  `@tauri-apps/api`; never via `eval`, native dialog hacks, or browser
  APIs that silently fail in WebView.
- Don't add `electron`, `electron-builder`, or any Electron-shaped
  dependency. Tauri is the only desktop runtime this template supports.
- Asset paths MUST stay relative to `dist/`; absolute `/foo.png` paths
  break in the packaged binary.

### Mobile projects MUST treat Capacitor as the host

- The web bundle is loaded via `file://` → `vite.config.ts` already
  emits `base: ''` under `mode === 'capacitor'`. Don't change `base`
  without preserving that branch.
- Use plugins from the `@capacitor/*` namespace
  (`@capacitor/camera`, `@capacitor/geolocation`, `@capacitor/haptics`,
  …) — don't import React Native modules.
- Re-run `pnpm cap:sync` after every web build that should ship to a
  device; suggest this in any "how do I see my change on the phone"
  reply.

### Build / scripts MUST stay consistent

- A web project MUST NOT contain `tauri:*` or `cap:*` scripts. If you
  see one, the strip pass was bypassed — fix the strip rule, not the
  generated code.
- A desktop project MUST NOT contain `cap:*` scripts and MUST NOT
  contain `apps/mobile/`.
- A mobile project MUST NOT contain `tauri:*` scripts and MUST NOT
  contain `apps/desktop/`.
- A web project MUST NOT contain `pnpm-workspace.yaml` (the `apps/*`
  glob would resolve to nothing); desktop and mobile DO ship it because
  the `tauri:*` / `cap:*` scripts use `pnpm --filter "./apps/<x>"`.

### Cross-platform residue MUST stay stripped

The unstripped template ships every variant for the playground; the
CLI's strip pass keeps only the chosen platform's content. The
`@eikon:variant(platform=…)` markers below are the source of truth —
if you grow the template with new platform-specific code, mirror this
list:

| File                                | Marker scope                         | Effect                                                                |
| ----------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `index.html`                        | `<!-- @eikon:variant(platform=mobile) begin -->` block | Drops `apple-mobile-web-app-*` and `mobile-web-app-capable` PWA tags on web/desktop. |
| `src/styles/index.css`              | `/* @eikon:variant(platform=mobile) begin */` blocks | Drops `--touch-target-min` token + `safe-pt`/`safe-pb`/`safe-px`/`safe-py`/`safe-pl`/`safe-pr` `@utility` defs on web/desktop. |
| `vite.config.ts`                    | `// @eikon:variant(platform=mobile) begin` block | Drops the `mode === 'capacitor'` base branch on web/desktop. The `({ mode: _mode })` alias preserves lint cleanliness when the body is stripped. |
| `src/shared/ui/sheet.tsx`           | `// @eikon:variant(layout=mobile-drawer) file` first line | Whole-file removed unless `layout = mobile-drawer`. |
| `apps/desktop/`, `apps/mobile/`     | Directory-level (no marker)          | Removed by `strip-features.ts` based on `platform`. |
| `pnpm-workspace.yaml`               | Root-file-level (no marker)          | Removed by `prunePlatformOnlyRootFiles` when `platform=web`. |
| `tauri:*` / `cap:*` scripts in root `package.json` | Inline (no marker)        | Removed by `prunePackageScripts` based on `platform`. |

Known exception — JSON files cannot carry comment markers, so a few
mobile-only i18n keys live in `src/shared/i18n/locales/{en,zh}/common.json`
without strip:

```json
"nav": {
  "menu": "Open navigation",                              // MobileDrawer hamburger
  "menuDescription": "Primary navigation for the application", // MobileDrawer Sheet a11y
  "primary": "Primary navigation",                        // BottomTabs / BottomTabsFab nav
  "compose": "New task"                                   // BottomTabsFab FAB
}
```

These ~4 keys × 2 locales = ~8 lines remain in scaffolded `web` /
`desktop` projects as inert i18n bundle entries. Their cost (a few
hundred bytes) is dwarfed by the engineering overhead of moving them
to a separate namespace, so the residue is **deliberate** rather than
a missing strip rule. If you add new mobile-only navigation labels,
keep them in `nav.*` so the cluster stays small and obvious.

### Cross-platform code in `src/` SHOULD avoid platform sniffing

The same React tree runs on every target. Where a feature genuinely
needs to know the host (e.g. picking between a Web File Input and the
Capacitor Camera plugin), gate the difference at the **edge** —
typically a thin adapter under `src/shared/<capability>/`. Never sniff
`navigator.userAgent` or `window.__TAURI__` from a feature's
component code; that's a reliable way to make tests flaky and SSR
impossible.

## When the user changes platforms

If the user asks to "switch this project from web to mobile" (or
similar), do **not** edit files by hand. Tell them:

1. The recommended path is to scaffold a fresh project with
   `npx create-eikon-react <name> --platform mobile --yes` and copy
   their `src/features/*` over — those are platform-agnostic.
2. If they insist on in-place migration, the changes are: copy
   `apps/mobile/` from the template repo, swap `tauri:*` for `cap:*`
   in `package.json`, switch `RootLayout.tsx` to a mobile layout, and
   add the `mode === 'capacitor'` branch to `vite.config.ts`.

Either way, ask before editing — these are large, one-way changes.

## Reference

- [docs/platform-targets.md](../../../../docs/platform-targets.md) — full
  user-facing guide.
- `apps/desktop/README.md` and `apps/mobile/README.md` — per-shell
  prerequisites and commands.
