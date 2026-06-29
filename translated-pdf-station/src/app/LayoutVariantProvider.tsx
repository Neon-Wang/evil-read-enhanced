/**
 * @file LayoutVariantProvider.tsx
 * @description Provider for the runtime layout dispatch. Owns the
 * variant state, the playground's `eikon:set-variant` postMessage
 * subscription, AND the `eikon:preview-ready` outbound signal. Lives
 * in its own file so Fast Refresh can hot-swap it without
 * `LayoutVariantContext.tsx`'s non-component exports (Context object,
 * hook, type) blocking the refresh.
 *
 * Why ready-signal lives here, not in `main.tsx`: the playground
 * shell answers `eikon:preview-ready` with an `eikon:set-variant`
 * carrying every runtime axis. The layout listener can only be
 * installed inside an effect (it owns React state), so if the post
 * fires before that effect runs, the layout arm of the response is
 * dropped on the floor and the iframe sticks at the schema default
 * (`'stacked'`) until the user manually toggles. Posting from
 * INSIDE the same effect, after `addEventListener`, makes the order
 * deterministic. design / ui still get a synchronous module-load
 * listener in `main.tsx`, so they're not affected by this race.
 *
 * The listener is gated by `import.meta.env.DEV` + iframe detection,
 * so production scaffolds drop the bridge entirely via Rollup
 * dead-code elimination once `DEV` evaluates `false`. Standalone
 * `pnpm dev` (template not embedded) skips the bind too — the second
 * gate prevents stray handler accumulation.
 */

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  LayoutVariantContext,
  type LayoutVariant,
} from './LayoutVariantContext';

interface LayoutVariantProviderProps {
  children: ReactNode;
  initial?: LayoutVariant;
}

/**
 * Read the initial layout from `<html data-layout="...">` (CLI scaffold
 * stamps this) and fall back to `'stacked'` — the schema default — when
 * absent (workspace dev or pre-Phase-I scaffolds).
 */
function readInitialVariant(): LayoutVariant {
  if (typeof document === 'undefined') return 'stacked';
  const v = document.documentElement.dataset.layout;
  return (v && (v as LayoutVariant)) || 'stacked';
}

export function LayoutVariantProvider({
  children,
  initial,
}: LayoutVariantProviderProps) {
  const [variant, setVariant] = useState<LayoutVariant>(
    () => initial ?? readInitialVariant()
  );

  const handleSetVariant = useCallback((next: LayoutVariant) => {
    setVariant(next);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || window.parent === window) return;
    function onMessage(e: MessageEvent) {
      // P4.15: only accept layout messages from the embedding shell
      // (same origin as the iframe in playground use).
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; layout?: string } | null;
      if (!data || data.type !== 'eikon:set-variant') return;
      if (typeof data.layout !== 'string') return;
      setVariant(data.layout as LayoutVariant);
    }
    window.addEventListener('message', onMessage);
    // Listener is now armed — only NOW is it safe to tell the
    // playground shell we're ready, because the shell's reply
    // (`eikon:set-variant`) carries the layout we need to receive.
    // See file header for the race this avoids.
    window.parent.postMessage({ type: 'eikon:preview-ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <LayoutVariantContext.Provider
      value={{ variant, setVariant: handleSetVariant }}
    >
      {children}
    </LayoutVariantContext.Provider>
  );
}
