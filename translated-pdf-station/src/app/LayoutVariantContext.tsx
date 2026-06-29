/**
 * @file LayoutVariantContext.tsx
 * @description Type, React Context object, and consumer hook for the
 * runtime layout dispatch. The Provider component lives next door in
 * `LayoutVariantProvider.tsx` — split because Fast Refresh
 * (`react-refresh/only-export-components`) requires component modules
 * to not co-export hooks / constants alongside the component.
 *
 * In the unstripped template (workspace dev, playground iframe) all
 * seven sibling layouts coexist on disk; this Context picks which one
 * `RootLayout` mounts. After CLI strip, only one layout file remains
 * AND the consumer (`<RootLayout />`) collapses to a single arm of its
 * dispatch table — the Context still works but only ever resolves to
 * that one entry, so it costs essentially nothing in the shipped
 * scaffold.
 */

import { createContext, useContext } from 'react';

/**
 * The set of layout variant names the template ships. Mirrors the
 * `layout` axis values in `packages/preview-site/src/lib/params-schema.ts`.
 * After CLI strip only one of these is reachable, but typing them all
 * here keeps the dispatcher generic.
 */
export type LayoutVariant =
  | 'stacked'
  | 'sidebar'
  | 'topbar-sidebar'
  | 'centered'
  | 'mobile-drawer'
  | 'bottom-tabs'
  | 'bottom-tabs-fab';

export interface LayoutVariantContextValue {
  variant: LayoutVariant;
  setVariant: (next: LayoutVariant) => void;
}

export const LayoutVariantContext =
  createContext<LayoutVariantContextValue | null>(null);

/**
 * Read the active layout variant. Throws if used outside a
 * `<LayoutVariantProvider>` so tests catch missing wrappers early.
 */
export function useLayoutVariant(): LayoutVariant {
  const ctx = useContext(LayoutVariantContext);
  if (!ctx)
    throw new Error('useLayoutVariant must be used inside LayoutVariantProvider');
  return ctx.variant;
}
