/**
 * @file RootLayout.tsx
 * @description Runtime dispatcher for the layout axis. The template
 * ships seven sibling layout files — Stacked / Sidebar / TopbarSidebar /
 * Centered (web / desktop) and MobileDrawer / BottomTabs / BottomTabsFab
 * (mobile) — and this file mounts exactly one based on
 * `useLayoutVariant()`.
 *
 * How the picking works:
 *
 *   - In the unstripped template (workspace `pnpm dev`, playground
 *     iframe, tests) all seven imports + dispatch entries coexist and
 *     the active variant is read from React Context. The playground
 *     can swap variants live via the `eikon:set-variant` postMessage
 *     bridge (see `LayoutVariantContext.tsx`).
 *
 *   - At CLI strip time (`stripFeatures` with `keepAllVariants:false`,
 *     i.e. the default end-user path), every `@eikon:variant(layout=X)`
 *     block below collapses to ONE entry (the chosen variant) and the
 *     six unchosen sibling files are deleted whole-file by their own
 *     file-level markers. The dispatcher table becomes a single-key
 *     object; `LayoutVariantProvider` defaults to that variant; the
 *     dispatch is effectively a constant lookup.
 *
 *   - Per-platform narrowing (which 4 of the 7 are *offered* to the
 *     user) lives in `packages/preview-site/src/lib/params-schema.ts`'s
 *     `valuesWhen` for the `layout` axis. The strip engine itself stays
 *     dumb: it strips whatever value the CLI / playground hands it,
 *     trusting the upstream filter.
 *
 * Callers (router, tests) keep their import stable:
 *
 *     import { RootLayout } from '@/app/layouts/RootLayout';
 *
 * — regardless of which variant was chosen.
 */

// =================================================================================================
// Imports
// =================================================================================================

import {
  useLayoutVariant,
  type LayoutVariant,
} from '@/app/LayoutVariantContext';

// @eikon:variant(layout=sidebar) begin
import { SidebarRootLayout } from './SidebarRootLayout';
// @eikon:variant(layout=sidebar) end
// =================================================================================================
// Dispatch
// =================================================================================================

/**
 * Variant → component lookup. After CLI strip, only the surviving
 * variant's entry remains; the dispatcher then resolves to the single
 * component (or falls back via `Object.values(...)[0]`).
 */
const LAYOUT_BY_VARIANT: Partial<Record<LayoutVariant, React.ComponentType>> = {
// @eikon:variant(layout=sidebar) begin
  sidebar: SidebarRootLayout,
  // @eikon:variant(layout=sidebar) end
  };

function RootLayout() {
  const variant = useLayoutVariant();
  // Active arm if it exists; otherwise the first surviving entry. The
  // `||` fallback is important for CLI scaffolds whose Context default
  // ('stacked') might not match the variant they were stripped to.
  const Picked =
    LAYOUT_BY_VARIANT[variant] ?? Object.values(LAYOUT_BY_VARIANT)[0]!;
  return <Picked />;
}

// =================================================================================================
// Exports
// =================================================================================================

export { RootLayout };
