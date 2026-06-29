/**
 * @file main.tsx
 * @description Application entrypoint.
 *
 * Resolves any async first-paint preconditions (currently: the active
 * i18n bundle), then mounts <App /> inside React StrictMode under the
 * #root element.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { StrictMode } from 'react';

// --- Core-related Libraries ---
import { createRoot } from 'react-dom/client';

// --- Absolute Imports ---
import App from '@/App';
import { LayoutVariantProvider } from '@/app/LayoutVariantProvider';
import { initI18n } from '@/shared/i18n';
import '@/styles/index.css';

// =================================================================================================
// Mount
// =================================================================================================

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

// Apply the initial design variant. Source of truth is the
// `data-design` attribute the CLI stamps on <html> at scaffold time
// (see `create-eikon-react/src/index.ts`). When absent — e.g. running
// the workspace template directly with no CLI step — we leave <html>
// untouched and Tailwind's base @theme tokens render the "default"
// design. The 14 design overrides live as `:root.design-<name>` rules
// in `styles/index.css`; switching is a class swap, no rebuild.
//
// `ui` is intentionally NOT a runtime class axis: the chosen library
// (`custom` / `shadcn` / `animate-ui`) is baked into the source files
// at scaffold time by `apply-ui-snapshot.ts`, so there's nothing to
// toggle once the bundle is built.
function applyClassAxis(prefix: string, value: string | undefined): void {
  if (!value) return;
  const root = document.documentElement;
  for (const cls of Array.from(root.classList)) {
    if (cls.startsWith(`${prefix}-`)) root.classList.remove(cls);
  }
  if (value !== 'default') {
    root.classList.add(`${prefix}-${value}`);
  }
}

const htmlEl = rootElement.ownerDocument.documentElement;
applyClassAxis('design', htmlEl.dataset.design);

// Preview-shell variant bridge. Only mounted when (a) the bundle is a
// dev build — production scaffolds drop this whole branch via Rollup's
// dead-code elimination once `import.meta.env.DEV` evaluates `false` —
// and (b) we're embedded in another window, i.e. the playground iframe.
// Standalone `pnpm dev` skips it entirely.
//
// Class-axis swaps for `design` are handled here. `layout` and
// `toastPosition` are consumed by LayoutVariantContext and Toaster.
// `ui`, `platform`, `pm`, `supabase` deliberately don't ride this
// channel: the library implementation behind `ui` is baked into the
// source at scaffold time (see `apply-ui-snapshot.ts`), platform-specific
// behaviour is gated at scaffold time by `@eikon:variant(platform=…)`
// strip markers (see `90-platform-targets.md`), and the playground
// simulator endpoints own the file-tree / package.json preview for
// `pm` and `supabase`.
if (import.meta.env.DEV && window.parent !== window) {
  window.addEventListener('message', (e: MessageEvent) => {
    // P4.15: only trust messages from the embedding shell. The playground
    // serves the iframe and the parent from the same origin, so any
    // message claiming to be `eikon:set-variant` from a different origin
    // is by definition not from the playground shell.
    if (e.origin !== window.location.origin) return;
    const data = e.data as
      | {
          type?: string;
          design?: string;
        }
      | null;
    if (!data || data.type !== 'eikon:set-variant') return;
    if (typeof data.design === 'string') applyClassAxis('design', data.design);
  });
}

const root = createRoot(rootElement);

/**
 * Async preconditions to settle before the first paint — currently
 * just the active i18n bundle. With an empty list the Promise.all
 * resolves on the next microtask and rendering is effectively
 * synchronous.
 */
const preconditions: Array<Promise<unknown>> = [];

// Wait for the active locale bundle so users never see a flash of
// fallback keys. On failure we still render rather than leave the
// screen blank.
preconditions.push(
  initI18n().catch((err: unknown) => {
    console.error('[i18n] initialisation failed; rendering anyway:', err);
  })
);

void Promise.all(preconditions).then(() => {
  root.render(
    <StrictMode>
      <LayoutVariantProvider>
        <App />
      </LayoutVariantProvider>
    </StrictMode>
  );
  // Preview-site bridge: the `eikon:preview-ready` signal that the
  // playground shell waits on used to be posted here, right after
  // `root.render`. We moved it into `LayoutVariantProvider`'s
  // `useEffect` so it fires AFTER the layout-axis message listener
  // is installed — see that file's header for the race that broke.
  // `design` still gets its listener synchronously at module load
  // (above), so it's not in the same boat.
});
