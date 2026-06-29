/**
 * @file routes.tsx
 * @description Route declarations for the Examples feature.
 *
 * Every page is lazy-loaded so each showcase lands in its own chunk;
 * the router's shared <Suspense> boundary (see RootLayout) provides
 * the fallback.
 *
 * The page chunk and the `examples` i18n namespace are fetched IN
 * PARALLEL inside each `lazy()` — by the time a showcase page mounts,
 * both its JS and its translations are resident, so the user never
 * sees a flash of fallback keys.
 *
 * Note: this feature is mounted only in dev (see `app/router.tsx`).
 * The lazy chunks still exist in production builds (Rollup statically
 * analyses `import()` calls), but they're unreachable — no route ever
 * resolves to them.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { lazy, Suspense } from 'react';

// --- Core-related Libraries ---
import { Route } from 'react-router-dom';

// --- Absolute Imports ---
import { loadNamespace } from '@/shared/i18n';

// --- Relative Imports ---
import { ExamplesRouteFallback } from './components/ExamplesRouteFallback';

// =================================================================================================
// Lazy pages
// =================================================================================================

const ExamplesLayout = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/ExamplesLayout'),
    loadNamespace('examples'),
  ]);
  return { default: mod.ExamplesLayout };
});

const ExamplesIndexPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/ExamplesIndexPage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.ExamplesIndexPage };
});

const ExamplesSectionPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/ExamplesSectionPage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.ExamplesSectionPage };
});

const ToasterShowcasePage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/ToasterShowcasePage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.ToasterShowcasePage };
});

const DialogShowcasePage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/DialogShowcasePage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.DialogShowcasePage };
});

const CommandShowcasePage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/CommandShowcasePage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.CommandShowcasePage };
});

const SignInModalShowcasePage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/SignInModalShowcasePage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.SignInModalShowcasePage };
});

const MotionShowcasePage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/MotionShowcasePage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.MotionShowcasePage };
});

const PerformanceShowcasePage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/PerformanceShowcasePage'),
    loadNamespace('examples'),
  ]);
  return { default: mod.PerformanceShowcasePage };
});

// =================================================================================================
// Exports
// =================================================================================================

export const examplesRoutes = (
  <Route
    path="/examples"
    element={
      <Suspense fallback={<ExamplesRouteFallback />}>
        <ExamplesLayout />
      </Suspense>
    }
  >
    {/* Overview landing shown at the bare /examples path. */}
    <Route index element={<ExamplesIndexPage />} />

    {/*
      Standalone showcases keep dedicated routes + page components.
      These STATIC segments rank above the `:section` dynamic route
      below, so they always win the match.
    */}
    <Route path="toaster" element={<ToasterShowcasePage />} />
    <Route path="dialog" element={<DialogShowcasePage />} />
    <Route path="command" element={<CommandShowcasePage />} />
    <Route path="sign-in-modal" element={<SignInModalShowcasePage />} />
    <Route path="motion" element={<MotionShowcasePage />} />
    <Route path="performance" element={<PerformanceShowcasePage />} />

    {/* Every inline component showcase, resolved from the registry. */}
    <Route path=":section" element={<ExamplesSectionPage />} />
  </Route>
);
