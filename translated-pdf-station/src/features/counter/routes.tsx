/**
 * @file routes.tsx
 * @description Route declarations for the Counter feature.
 *
 * Lazy-loaded so the counter page lands in its own chunk; the router's
 * shared <Suspense> boundary (see RootLayout) provides the fallback.
 *
 * The page chunk and the `counter` i18n namespace are fetched in
 * parallel inside `lazy()` so the user never sees a flash of fallback
 * keys when navigating into `/counter`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { lazy } from 'react';

// --- Core-related Libraries ---
import { Route } from 'react-router-dom';

// --- Absolute Imports ---
import { loadNamespace } from '@/shared/i18n';

// =================================================================================================
// Lazy pages
// =================================================================================================

const CounterPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/CounterPage'),
    loadNamespace('counter'),
  ]);
  return { default: mod.CounterPage };
});

// =================================================================================================
// Exports
// =================================================================================================

export const counterRoutes = (
  <Route path="/counter" element={<CounterPage />} />
);
