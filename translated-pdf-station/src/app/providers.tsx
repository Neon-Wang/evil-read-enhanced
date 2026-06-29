/**
 * @file providers.tsx
 * @description App-level provider stack.
 *
 * Wraps the children with the router (BrowserRouter), the TanStack Query
 * provider, and the global toast renderer. Add new providers HERE rather
 * than in `main.tsx` so the provider order is a single review point.
 *
 * TanStack Query is treated as baseline infrastructure (alongside React
 * Router) — every scaffold ships with it, so the provider mounts
 * unconditionally. The cost when unused is negligible: one `QueryClient`
 * instance is allocated at module load, and the library itself sits in a
 * dedicated vendor chunk that the app never pulls into the main bundle
 * until something actually calls `useQuery` / `useMutation`.
 *
 * Toast position AND visual defaults (`richColors`, `closeButton`,
 * `toastOptions.classNames`) live at this layer so the variant-strip
 * surface is a single project-authored file. The `<Toaster>` at
 * `@/shared/ui/toaster` is a transparent pass-through that spreads every
 * prop to Sonner — that means the same wiring works whether `--ui`
 * resolved to `custom`, `shadcn` or `animate-ui` (the registry snapshots
 * are 1:1 from upstream and accept Sonner's `ToasterProps`). Lifting all
 * defaults here keeps the variant markers AND the Eikon design-token
 * `classNames` OUT of the snapshots, so they don't need to be patched on
 * each `sync-ui-snapshots`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { type ReactNode, useEffect, useState } from 'react';

// --- Core-related Libraries ---
import { BrowserRouter } from 'react-router-dom';

// --- Third-party Libraries ---
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Absolute Imports ---
import { SignInModalMount } from '@/features/auth';
import { Toaster } from '@/shared/ui/toaster';

// =================================================================================================
// Constants
// =================================================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Strip any trailing slash so react-router accepts the value (it errors on
 * '/foo/'). When the app is served at the site root (the common case) Vite
 * sets BASE_URL to '/', so basename ends up as '' which BrowserRouter treats
 * as the root. When the app is served under a sub-path — e.g. the preview
 * playground mounts each variant at `/preview/<hash>/` — that prefix is
 * preserved so internal links resolve correctly.
 */
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

// =================================================================================================
// Toast: position + visual defaults
// =================================================================================================

type ToastPosition =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center';

/**
 * Schema-default position is the FIRST entry. In the unstripped template
 * (workspace `pnpm dev`, playground iframe, tests) all four variant
 * blocks coexist and the playground swaps positions live via the
 * `eikon:set-variant` postMessage bridge. After CLI strip, only the
 * `--toast-position`-chosen entry survives and the array collapses to
 * one element — so `INITIAL_TOAST_POSITION` becomes a literal string.
 */
const INITIAL_TOAST_POSITION = ([
// @eikon:variant(toastPosition=top-center) begin
  'top-center',
  // @eikon:variant(toastPosition=top-center) end
  ].at(0) ?? 'top-right') as ToastPosition;

/**
 * Eikon-tuned visual defaults applied uniformly across all `--ui` choices.
 * The `classNames` reference design tokens (`--radius-md`,
 * `--surface-border-width`, `--color-card`, etc.) so each design preset
 * paints the toast with its own card surface; dark mode flows through
 * automatically. The shadcn / animate-ui snapshots also set Sonner's
 * own `--normal-bg` / `--normal-border` CSS vars to `var(--popover)` /
 * `var(--border)` — the unprefixed aliases at the top of `index.css`
 * route those to the same Eikon tokens, so the cascade lands on the
 * same colour set whichever path is active.
 */
const TOAST_OPTIONS = {
  classNames: {
    toast:
      'rounded-[var(--radius-md)] border-[length:var(--surface-border-width)] border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow-lg',
    title: 'text-sm font-medium',
    description: 'text-xs text-[var(--color-muted-foreground)]',
  },
} as const;

// =================================================================================================
// Types
// =================================================================================================

interface AppProvidersProps {
  children: ReactNode;
}

// =================================================================================================
// Component
// =================================================================================================

function AppProviders({ children }: AppProvidersProps) {
  const [toastPosition, setToastPosition] = useState<ToastPosition>(
    INITIAL_TOAST_POSITION
  );

  useEffect(() => {
    // Same gating as the design bridge in main.tsx — in a built
    // scaffold this whole block is dead-code-eliminated.
    if (!import.meta.env.DEV || window.parent === window) return;
    function onMessage(e: MessageEvent) {
      // P4.15: same-origin guard — see main.tsx for the rationale.
      if (e.origin !== window.location.origin) return;
      const data = e.data as
        | { type?: string; toastPosition?: string }
        | null;
      if (!data || data.type !== 'eikon:set-variant') return;
      if (typeof data.toastPosition !== 'string') return;
      setToastPosition(data.toastPosition as ToastPosition);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          richColors
          closeButton
          position={toastPosition}
          toastOptions={TOAST_OPTIONS}
        />
        {/*
          Global sign-in / sign-up modal. Lives at provider scope (not
          inside a layout) so the modal is reachable from any route and
          survives layout-level remounts; opens via
          `useOpenSignInModal()()` from anywhere.
        */}
        <SignInModalMount />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { AppProviders };
