---
id: customize-design
title: Customize the design theme / tokens
description: Tweak existing theme tokens, switch between built-in design presets, or add a brand-new preset that plugs into the `--design` CLI variant axis. Light + dark coverage is mandatory.
keywords:
  [
    theme,
    design,
    tokens,
    palette,
    branding,
    dark mode,
    color scheme,
    variant,
    tailwind v4,
    preset,
    skin,
  ]
applies_to:
  - "src/styles/**"
  - "src/shared/theme/**"
---

# Skill: customize the design / theme

Use whenever the user asks to "change the colour scheme", "rebrand the
template", "add a dark blue theme", "switch the default look to
Linear", or "expose another preset to the CLI". Re-read
[rules/20-tailwind-v4.md](../../rules/20-tailwind-v4.md) first — it
encodes the non-negotiables (CSS-first, no `tailwind.config.js`, no
hex/rgb in components, tokens live in `@theme`).

## Built-in presets (the `--design <value>` CLI choices)

Each preset is modelled after a real, publicly-documented design
system so users immediately recognise the look. Anchor colours below
are the **brand-source values**; the actual `index.css` blocks
translate them to OKLCH for perceptual-uniform contrast checking.

| value             | Inspired by                  | Anchor palette                          | Typography                | Density (`--spacing` / base text)         | Vibe                                |
| ----------------- | ---------------------------- | --------------------------------------- | ------------------------- | ----------------------------------------- | ----------------------------------- |
| `default`         | (none — neutral baseline)    | violet `#7B5BD9`-ish on white           | system-ui                 | Tailwind defaults (0.25rem / 16px)        | Brand-agnostic; safe start.         |
| `apple`           | Apple HIG / iOS 17+          | `#007AFF` systemBlue on `#FAFAFA`       | SF Pro / -apple-system    | Spacious (0.27rem) · 17px body            | Friendly, generous radii, native.   |
| `linear`          | [linear.app/brand]           | `#5E6AD2` lavender-blue on `#F4F5F8`    | Inter Variable            | Tight (0.22rem) · 15px body               | Crisp, productivity tool, compact.  |
| `anthropic`       | [Anthropic brand guidelines] | `#d97757` Crail orange on `#faf9f5`     | Lora serif (body)         | Editorial (0.28rem) · 17px body / 1.7 LH  | Warm, humanist, editorial, serif.   |
| `vercel`          | [Vercel Geist]               | Ink `#000` / `#FFF` + `#0070F3` accent  | Geist Sans + Geist Mono   | Tight (0.22rem) · 14px body · 1px ring sh.| Strict monochrome, "less is more".  |
| `notion`          | Notion editor                | warm gray + `#2eaadc` blue              | Inter                     | Standard (Tailwind default) · 16px / 1.6 LH | Document-heavy, dashboard-friendly. |
| `flat`            | Flat / Metro / Swiss         | strong color blocks, visible borders    | Inter Tight               | Standard                                  | Zero shadows; depth from contrast.  |
| `material`        | Material Design 3            | M3 tonal palette + key accent           | Roboto Flex               | Standard · 1rem container radii           | Elevation-driven, no borders.       |
| `skeuomorphism`   | Realistic 3D                 | warm neutrals + bright primary          | Georgia serif             | Standard                                  | Inset highlights, deep shadows.     |
| `neumorphism`     | Soft UI                      | matching-tone fills (no high contrast)  | Quicksand / SF Rounded    | Standard                                  | Soft extruded plastic, paired shadows. |
| `liquid-glass`    | Apple iOS 26                 | refractive overlay on photo backdrop    | SF Pro / -apple-system    | Standard                                  | Heavy backdrop-blur + specular rim. |
| `claymorphism`    | [clay.css] (Adrian Bece)     | playful pastel palette                  | Fredoka + Nunito          | Generous radii                            | Puffy clay, soft outer + inset glow.|
| `aurora`          | Aurora UI                    | dark base + green-cyan / magenta glows  | Space Grotesk             | Standard                                  | Northern-lights dual-hue shadows.   |
| `neo-brutalism`   | Brutalist web                | high-saturation block + ink black       | JetBrains Mono            | Standard                                  | 3px black borders, hard-offset shadow. |
| `cyberpunk`       | Synthwave / cyberpunk        | neon magenta `#d9259e` + electric cyan  | JetBrains Mono            | Tight (0.22rem)                           | Neon outer glow, near-zero radii.   |
| `terminal`        | CRT / phosphor terminal      | phosphor green on near-black            | JetBrains / IBM Plex Mono | Tight (0.22rem)                           | Green-glow shadows, zero radii, mono. |
| `carbon`          | IBM Carbon Design System     | IBM Blue `#0F62FE` on layered grays     | IBM Plex Sans             | Dense (0.22rem)                           | Square corners, 2px focus, enterprise. |
| `editorial`       | Broadsheet / magazine print  | black ink `#262626` on white paper      | Playfair Display / Georgia | Editorial (0.27rem) · 17px · 1.85 LH      | Stark B&W serif, hairline rules, flat. |
| `animal-crossing` | [animal-island-ui]           | mint teal `#19c8b9` + parchment `#f8f8f0`, brown ink `#794f27`, focus yellow `#ffcc00` | Baloo 2 / M PLUS Rounded 1c | Spacious (0.27rem) · chunky 12–24px radii | Cosy island; hard flat-bottom shadow, rounded gothic, bouncy easing. |

[linear.app/brand]: https://linear.app/brand
[Anthropic brand guidelines]: https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md
[Vercel Geist]: https://vercel.com/geist/colors
[clay.css]: https://github.com/adrianbece/claymorphism
[animal-island-ui]: https://github.com/guokaigdg/animal-island-ui

What "density" means here: each preset overrides `--spacing` (Tailwind
v4's base step, consumed by EVERY `p-N` / `gap-N` / `m-N` / `size-*`
utility) plus the `--text-*` / `--text-*--line-height` family. Because
the utilities are token-driven, **components don't change between
presets** — a `<div className="p-6 text-sm">` automatically reads tighter
under `vercel` and more spacious under `apple`.

Switch the project to one of these at scaffold time:

```bash
pnpm dlx create-eikon-react my-app --design linear --yes
pnpm dlx create-eikon-react my-app --design anthropic --layout sidebar --yes
```

Or pick one interactively in the playground (`pnpm preview:dev` → Design dropdown).

## How theming works in this template (one-screen primer)

```
┌──────────────────────────────────────────────────────────────────┐
│ src/styles/index.css        ← ONE FILE, the only place tokens    │
│ ├── @theme  { … }           ← base tokens (colours, radii, fonts)│
│ ├── .dark   { … }           ← dark-mode colour overrides         │
│ ├── @eikon:variant(design=default)        ← presets, each pair of│
│ ├── @eikon:variant(design=apple)          │ @theme + .dark      │
│ ├── @eikon:variant(design=linear)         │ overrides; each     │
│ ├── @eikon:variant(design=anthropic)      │ @theme adds         │
│ ├── @eikon:variant(design=vercel)         │ typography /        │
│ ├── @eikon:variant(design=notion)         │ density / shadow    │
│ ├── @eikon:variant(design=flat)           │ tokens on top of    │
│ ├── @eikon:variant(design=material)       │ palette. 14 in all. │
│ ├── @eikon:variant(design=skeuomorphism)  │                     │
│ ├── @eikon:variant(design=neumorphism)    │                     │
│ ├── @eikon:variant(design=liquid-glass)   │                     │
│ ├── @eikon:variant(design=claymorphism)   │                     │
│ ├── @eikon:variant(design=aurora)         │                     │
│ └── @eikon:variant(design=neo-brutalism)  ┘                     │
└──────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
 src/shared/theme/themeStore.ts            src/shared/ui/*.tsx
   (light | dark | system,                  bg-[var(--color-primary)]
    cycles + persists)                      text-sm   ← reads --text-sm
                                            font-medium ← reads --font-weight-medium
                                            p-6 / gap-2 ← reads --spacing
                                            shadow-md   ← reads --shadow-md
```

Token namespaces (Tailwind v4 CSS-first config) consumed by utilities:

| Namespace             | Drives utility                           | Source of truth in this template               |
| --------------------- | ---------------------------------------- | ---------------------------------------------- |
| `--color-*`           | `bg-* / text-* / border-* / ring-*`      | base `@theme` + every preset's `@theme` + `.dark` — covers `primary/secondary/accent/muted/destructive` plus state colours `success/warning/info`, `sidebar*` chrome family, `overlay`, `popover`, `chart-1..5` |
| `--radius-*`          | `rounded-*`                              | base `@theme` + every preset's `@theme`        |
| `--font-{sans,serif,mono,display}` | `font-sans / font-serif / font-mono / font-display` | base `@theme` (preset overrides per brand). `--font-display` defaults to `--font-sans` and is auto-applied to `:is(h1,h2,h3)` via a global rule in `@layer base` — claymorphism / cyberpunk override it to a distinct headline face |
| `--font-weight-*`     | `font-medium / font-semibold / ...`      | preset `@theme` (Tailwind defaults otherwise)  |
| `--text-*`            | `text-xs / text-sm / text-base / ...`    | base `@theme` covers `text-3xl..6xl` (display); preset `@theme` overrides body sizes per brand |
| `--text-*--line-height` | line-height paired to each `text-*` size | preset `@theme`                              |
| `--leading-*`         | `leading-tight / leading-relaxed / ...`  | preset `@theme` (selective overrides)          |
| `--tracking-*`        | `tracking-tight / tracking-wide / ...`   | preset `@theme` (selective overrides)          |
| `--spacing`           | EVERY `p-N / m-N / gap-N / size-*`       | preset `@theme` (per-density)                  |
| `--shadow-*`          | `shadow-sm / shadow-md / shadow-lg / shadow-xl` | preset `@theme` (per brand shadow personality). `--shadow-xl` is rerouted alongside sm/md/lg via `[class*="design-"]` + `.dark` rules so Tailwind utilities pick up preset overrides at runtime |
| `--ease-*` + `--duration-*` | `ease-{in,out,in-out,spring}` + custom-property reads | preset `@theme` (motion personality — apple's spring, linear's snappy, material's emphasized, cyberpunk's hard-cut) |
| `--chart-1..5`        | `bg-chart-1 / text-chart-2 / ...` (Tailwind v4 reads any `--color-chart-*` form too) | base `@theme` + per-preset (anchored at brand hue) |

Non-utility tokens (consumed directly via `var()` inside `@layer base` or
component styles, not exposed as Tailwind utilities):

| Token                       | Drives                                                       | Per-preset override?               |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `--scrollbar-size`          | width (vertical) / height (horizontal) of `::-webkit-scrollbar` | yes — narrower for `linear`, wider for `anthropic` |
| `--scrollbar-thumb`         | thumb fill, also bound to Firefox `scrollbar-color`           | yes — and a matching `.dark` override |
| `--scrollbar-thumb-hover`   | thumb fill on `:hover` (WebKit only)                          | yes — and a matching `.dark` override |
| `--scrollbar-track`         | track / gutter background (defaults transparent)              | rarely overridden                  |
| `--scrollbar-thumb-radius`  | thumb `border-radius`                                         | yes — square-ish for `vercel`, generous for `apple` |
| `--scrollbar-thumb-border`  | transparent border on the thumb (faux gutter inset)           | yes — 2 px for tight presets, 3 px for spacious ones |
| `--surface-{border-width,backdrop,inset-shadow,ring-width,ring-color,hover-shadow,active-shadow}` | Card / Button / Sheet / Dialog surface treatment via `border-[length:var(...)]`, `[backdrop-filter:var(...)]`, `ring-[length:var(...)]`, `[box-shadow:var(...)]` | yes — `liquid-glass` overrides `--surface-backdrop` to enable `backdrop-blur(28px)`, `neo-brutalism` overrides `--surface-border-width` to 3px, etc. |
| `--ring-width` / `--ring-offset-{width,color}` | Focus halo geometry consumed by Input / Switch / Checkbox / Select via arbitrary classes | yes — Vercel 3px+offset, Linear tight 2px no-offset, Apple 4px halo |
| `--z-{base,dropdown,sticky,fixed,overlay,modal,popover,toast,tooltip}` | Modal / popover / toast layering via `z-[var(--z-modal)]` etc. | rarely overridden — same scale for all presets |
| `--bg-ambient`              | `body { background-image }` ambient backdrop                  | yes — `liquid-glass` (multi-layer radial gradient stack), `claymorphism` (paper-noise SVG); other presets default to `none` |

These don't generate utility classes (no namespace match), but they DO
live inside `@theme { }` so each preset can override them in lock-step
with the palette / typography tokens. The actual `::-webkit-scrollbar`
and `scrollbar-color` rules that consume them are in `@layer base` near
the top of `index.css`.

Four immutable rules:

1. **Components never hard-code colours, sizes, spacings, or shadows.**
   Always reach for utilities (`bg-[var(--color-xxx)]`, `text-sm`,
   `p-6`, `shadow-md`, etc.). If a token doesn't exist, add it to
   `@theme` first; never use arbitrary values like `text-[15px]`.
2. **Every preset MUST ship both halves** — an `@theme` block AND a
   `.dark` block — otherwise the base `.dark` from earlier in the
   same file will punch through the preset's `--color-primary` and
   silently revert it.
3. **Typography / spacing / shadow tokens are optional per preset.**
   Override only what makes the preset's brand voice distinct
   (`apple` widens spacing + larger body; `vercel` tightens both).
   Omitted tokens fall back to Tailwind v4 defaults — that's exactly
   what `default` does intentionally.
4. **Don't touch `themeStore.ts`** unless you are changing the
   `light / dark / system` mechanism itself. The store handles class
   toggling, localStorage, and `prefers-color-scheme`; presets and
   token tweaks never need it.

---

## Decision tree — which task am I doing?

```
Is the user asking to …
├── "change the primary colour" / tweak one token
│       → Task A: edit @theme / .dark in index.css
├── "switch the default to Linear" / "use the Anthropic look"
│       → Task B: change the default in TWO schemas + verify
├── "add a sky-blue theme" / "expose another preset (e.g. Material You)"
│       → Task C: full preset checklist (CSS + CLI + playground)
└── "add a new colour token (e.g. --color-success)"
        → Task D: token addition (touch @theme, .dark, every preset)
```

---

## Task A — tweak existing tokens

Smallest possible change. Use when the user just wants to nudge a
colour (e.g. "make primary slightly more teal").

1. Open
   [src/styles/index.css](../../../src/styles/index.css) and locate
   the relevant `@theme { ... }` block.
2. Change the OKLCH value. Prefer keeping the existing channel format
   (the file standardises on `oklch(L C H)`); don't sprinkle hex /
   rgb — they don't get the perceptual-uniformity benefit and they
   clash with the rule from `20-tailwind-v4.md`.
3. If the token is one whose contrast flips in dark mode (e.g.
   `--color-primary`, `--color-background`, `--color-foreground`,
   `--color-card`), update the matching value in `.dark { ... }`
   too. Aim for **≥ 4.5:1** contrast against the corresponding
   `*-foreground` token (use the OKLCH lightness channel as a quick
   proxy — see "Contrast cheatsheet" below).
4. Run `pnpm --filter @eikon/react dev` and toggle the
   `ThemeToggle` in the top-right of the running app. The change
   should hot-reload; if dark mode is now broken, you skipped step 3.

Tokens you almost never need to touch:

- `--font-sans` — only change if the brand owns a typeface.
- `--radius-sm / --radius-md / --radius-lg` — only change to express
  a brand voice (e.g. `vercel` = near-zero, `apple` = generous round).
- `--spacing` — only change to express a density voice; `apple`
  loosens to `0.27rem`, `linear` / `vercel` tighten to `0.22rem`.
  Don't fiddle here for "make this one card tighter" — that's a
  local `gap-1` / `p-3` decision, not a global step.
- `--text-base` / `--text-*--line-height` — only override when the
  brand has a clear body-size opinion (Vercel's docs are 14px,
  iOS body is 17px). Avoid changing for one-off pages.

---

## Task B — switch the default preset

Use when the user wants the freshly-scaffolded project to look like
e.g. `linear` instead of `default`. Two places must change in
lock-step:

1. **CLI default** — edit
   [packages/create-eikon-react/src/strip-features.ts](../../../../create-eikon-react/src/strip-features.ts)
   `DEFAULT_VARIANTS`:

   ```ts
   export const DEFAULT_VARIANTS: VariantSelections = {
     design: 'linear',   // ← was 'default'
     layout: 'stacked',
     ui: 'animate-ui',
   };
   ```

2. **Playground default** — edit
   [packages/preview-site/src/lib/params-schema.ts](../../../../preview-site/src/lib/params-schema.ts)
   `PARAMS[design].default`:

   ```ts
   {
     id: 'design',
     kind: 'enum',
     values: [...],
     default: 'linear',   // ← was 'default'
     ...
   }
   ```

3. (Optional, **don't** unless requested) re-baseline the unstripped
   template's appearance by re-ordering the variant blocks in
   `index.css` so the new preset's tokens win when nothing is
   stripped. In practice this only matters for screenshots — the
   CLI strips all but one variant anyway.

Verification:

```bash
pnpm --filter create-eikon-react test     # asserts DEFAULT_VARIANTS shape
pnpm --filter @eikon/preview build         # playground compiles
```

---

## Task C — add a brand-new preset (e.g. `cyberpunk`)

Use whenever the user wants a new design option exposed to the
`--design` flag and the playground dropdown. The work crosses 3
files; do them in this order, otherwise the CLI will accept a value
that produces a styled-as-default project.

Pro tip: if the new preset is modelled after a real product (Stripe,
Material You, GitHub Primer, Atlassian, Carbon, etc.), open the
brand-source page first, lift the anchor colours, then translate them
to OKLCH. Keep a comment at the top of the CSS block citing the
source URL — future readers will thank you.

### Step 1 — define the preset in CSS

Edit
[src/styles/index.css](../../../src/styles/index.css), append a new
block at the end of the **design axis** section (after `notion`):

```css
```

Checklist for the preset itself:

- [ ] Block is wrapped in the exact marker `@eikon:variant(design=<name>) begin/end` so `strip-features` can find it.
- [ ] Contains BOTH an `@theme { ... }` block (light) and a `.dark { ... }` block (dark). Skipping the dark block is the #1 mistake — the base `.dark` will leak through.
- [ ] **Palette (required)**: Override at least `--color-primary`, `--color-primary-foreground`, `--color-ring`, `--color-accent`. Override more (`--color-background`, `--color-card`, `--color-border`) when the preset's identity demands it.
- [ ] **Typography / density / shadow (optional)**: Override `--spacing`, `--text-base` (+ `--text-base--line-height`), `--font-weight-medium / -semibold`, `--tracking-tight`, `--shadow-sm / -md / -lg` to express density and typographic rhythm. Omit any that match the default — Tailwind v4 fallbacks will take over.
- [ ] **Scrollbar (optional)**: Override `--scrollbar-{size,thumb,thumb-hover,thumb-radius,thumb-border}` (light) plus matching `--scrollbar-thumb` / `--scrollbar-thumb-hover` in `.dark`. Keep the thumb radius in the same family as `--radius-sm/-md` and the gutter size proportional to `--spacing` so the scrollbar reads as part of the same design language.
- [ ] All colour values use `oklch(...)`. Don't mix in `#hex` / `rgb(...)` / `hsl(...)` — the codebase only uses OKLCH in `index.css` and we want to keep grep clean.
- [ ] Pass the **contrast cheatsheet** (see below).

### Step 2 — register in the CLI

Edit
[packages/create-eikon-react/src/index.ts](../../../../create-eikon-react/src/index.ts)
`VARIANT_CHOICES.design`:

```ts
const VARIANT_CHOICES = {
  design: [
    'default',
    'apple',
    'linear',
    'anthropic',
    'vercel',
    'notion',
    'cyberpunk',   // ← add at the end; order = display order in the prompt
  ] as const,
  ...
};
```

This single edit drives three things:

1. The interactive `select` prompt during `create-eikon-react`.
2. The `--design cyberpunk` flag validation in non-interactive mode.
3. The set of values the type system narrows to.

### Step 3 — register in the playground

Edit
[packages/preview-site/src/lib/params-schema.ts](../../../../preview-site/src/lib/params-schema.ts)
to extend BOTH `values` AND `valueLabels`:

```ts
{
  id: 'design',
  kind: 'enum',
  values: [
    'default', 'apple', 'linear',
    'anthropic', 'vercel', 'notion',
    'cyberpunk',
  ],
  default: 'default',
  cliFlag: 'design',
  label: 'Design',
  axis: 'design',
  valueLabels: {
    default: 'Default (neutral violet)',
    apple: 'Apple HIG (systemBlue + SF Pro)',
    linear: 'Linear (lavender-blue + Inter)',
    anthropic: 'Anthropic (Claude orange + serif)',
    vercel: 'Vercel Geist (mono ink)',
    notion: 'Notion (warm gray + blue)',
    cyberpunk: 'Cyberpunk (neon)',   // ← keep the format consistent
  },
},
```

`valueLabels` is purely cosmetic (the dropdown label); the CLI and URL
hash still use the raw `value`. Missing entries fall back to the
raw value, so a missing label is graceful but ugly.

### Step 4 — verify end-to-end

```bash
# 1. The CSS marker actually strips correctly.
pnpm --filter create-eikon-react test

# 2. Scaffold into a throwaway dir and visually confirm.
node packages/create-eikon-react/dist/index.js my-cyberpunk-app \
     --design cyberpunk --yes --no-install --no-git
# inspect: my-cyberpunk-app/src/styles/index.css should contain ONLY
# the cyberpunk block from the design axis.

# 3. Playground compiles + the new option appears.
pnpm --filter @eikon/preview dev
# open http://localhost:5173 and choose Design → Cyberpunk
```

### Step 5 — run the gates

```bash
pnpm lint
pnpm typecheck
pnpm test
```

The structure guard tests don't enforce the design axis specifically,
but the variant-strip tests + CLI tests do — they'll catch a missing
end marker or a value that's in the CSS but not in `VARIANT_CHOICES`.

---

## Task D — add a new colour token (e.g. `--color-brand-secondary`)

Use when the design needs a semantic colour that isn't covered by the
existing token set. The previous edition of this skill used
`--color-success` as the example, but success/warning/info now ship by
default — pick a token name that doesn't collide with anything in the
base `@theme` (use `grep -n "^  --color-" src/styles/index.css` to
audit the current set).

1. Add the variable to the **base** `@theme` and the base `.dark` in
   [src/styles/index.css](../../../src/styles/index.css):

   ```css
   @theme {
     ...
     --color-brand-secondary: oklch(0.68 0.16 200);
     --color-brand-secondary-foreground: oklch(0.98 0 0);
   }
   .dark {
     ...
     --color-brand-secondary: oklch(0.78 0.16 200);
     --color-brand-secondary-foreground: oklch(0.14 0.04 200);
   }
   ```

2. **If any existing design preset should override this token**, add
   matching entries to that preset's `@theme` AND `.dark` blocks too.
   It's fine — and usually preferred — for presets to inherit the
   base value silently; only override when the preset's identity
   demands a different value (e.g. `vercel` would want a monochrome
   variant, not a coloured pill).

3. Consume in components via the same pattern:

   ```tsx
   className="bg-[var(--color-brand-secondary)] text-[var(--color-brand-secondary-foreground)]"
   ```

4. Don't forget the corresponding `*-foreground` pair. Every colour
   used as a background needs a foreground partner with adequate
   contrast.

---

## Contrast cheatsheet

OKLCH's `L` channel is roughly perceptual lightness. As a rule of
thumb on this template:

| Pair                                         | `L_bg` | `L_fg` | `|ΔL|` | OK?  |
| -------------------------------------------- | ------ | ------ | ------ | ---- |
| `--color-background` ↔ `--color-foreground`  | 1.00   | 0.18   | 0.82   | Yes  |
| `--color-primary` ↔ `--color-primary-foreground` | 0.55 | 0.98  | 0.43   | Yes  |
| `--color-muted` ↔ `--color-muted-foreground` | 0.96   | 0.45   | 0.51   | Yes  |

Targets:

- Body text on background: `|ΔL| ≥ 0.5` (≈ 4.5:1 in sRGB).
- Large headlines / button labels: `|ΔL| ≥ 0.35` is usually safe.
- For brand accents on background, also check the chroma — a high-C
  primary on a high-C background is hard to read even when L
  contrasts.

If you're unsure, paste both OKLCH values into
[oklch.com](https://oklch.com) and read off the WCAG ratio.

---

## Completion checklist

- [ ] All token edits live in `src/styles/index.css`. No new
      `*.css` file. No `tailwind.config.js` introduced.
- [ ] Every preset block has BOTH `@theme` and `.dark` halves.
- [ ] Every override uses `oklch(...)`. No hex / rgb / hsl.
- [ ] `--color-X` always paired with `--color-X-foreground` if it
      can appear as a background.
- [ ] If a new preset value was added: `VARIANT_CHOICES.design`
      (CLI) AND `params-schema.ts` `design.values` (playground)
      both list it. `valueLabels` carries a human-friendly label.
- [ ] If the default preset was changed: `DEFAULT_VARIANTS.design`
      in `strip-features.ts` AND `default` in `params-schema.ts`
      both moved.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` is green.
- [ ] Smoke-checked the preset in BOTH light and dark mode in the
      running app (the `ThemeToggle` in the header cycles
      light → dark → system).

## Common mistakes

- **Forgetting the `.dark` half of a preset.** The base `.dark`
  block earlier in `index.css` still applies, and its values for
  `--color-primary`, `--color-background`, etc. will leak through.
  Visible symptom: dark-mode primary looks like the default violet
  even though light-mode is clearly your new preset.
- **Adding a value to `VARIANT_CHOICES.design` but no CSS block.**
  `strip-features` will silently produce a default-looking project
  (no block to keep, so all blocks get stripped, base `@theme`
  wins). Add the CSS block first.
- **Adding a CSS block but not updating `VARIANT_CHOICES.design`.**
  The CLI's `--design <newname>` validation rejects the value
  silently and falls back to the default; user reports "the flag
  did nothing".
- **Hard-coding colours inside a component to "see how it would
  look".** Don't — that's a one-way ratchet. Add a token (Task D)
  or override an existing one (Task A), and consume via
  `var(--color-...)`.
- **Editing `themeStore.ts` to switch presets at runtime.** Presets
  are scaffold-time, not runtime. If you actually need a runtime
  "skin" switcher (rare — e.g. allowing end users to pick from N
  palettes), open a design discussion first; it's a different
  architecture (multiple `.dark`-like classes on `<html>`, store
  manages which one is active).

## See also

- [rules/20-tailwind-v4.md](../../rules/20-tailwind-v4.md) —
  Tailwind v4 CSS-first contract; theme tokens, dark mode,
  forbidden patterns.
- [src/shared/theme/themeStore.ts](../../../src/shared/theme/themeStore.ts) —
  the light/dark/system runtime switch (don't touch unless you're
  changing the switch mechanism itself).
- [packages/create-eikon-react/src/strip-features.ts](../../../../create-eikon-react/src/strip-features.ts) —
  the `@eikon:variant` marker grammar; read if you're adding a new
  axis (not just a new value).
