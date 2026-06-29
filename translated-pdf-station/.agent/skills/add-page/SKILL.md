---
id: add-page
title: Add a route-level page
description: Add a new route inside an existing feature, including the page component, route declaration, navigation entry, and tests.
keywords: [page, route, navigation, new page]
applies_to: ["src/features/**/pages/**", "src/features/**/routes.tsx"]
---

# Skill: add a route-level page

Use when the user asks to "add a page" or "create a new route" that belongs to an existing feature. If the page constitutes a new capability (its own state, its own data model), use [add-feature](../add-feature/SKILL.md) instead.

## Step list

1. **Identify the host feature.** A page lives inside the feature it conceptually belongs to. Avoid creating "misc" or "shared" feature dumping grounds.

2. **Create `src/features/<feature>/pages/<PageName>.tsx`.** Bind
   `useTranslation` to the host feature's namespace; keys are
   unprefixed inside that ns:

   ```tsx
   import { useTranslation } from 'react-i18next';

   export function <PageName>() {
     const { t } = useTranslation('<feature>');
     return (
       <section className="space-y-4">
         <h1 className="text-2xl font-semibold tracking-tight">
           {t('<pageKey>.title')}
         </h1>
         {/* page body */}
       </section>
     );
   }
   ```

3. **Register the route in `src/features/<feature>/routes.tsx`.**
   Lazy-load every page — the app's shared `<Suspense>` boundary
   provides the fallback. Pages use named exports, so the dynamic
   import either uses the `then((m) => ({ default: m.X }))` shim or
   the `async` form below. Prefetch the host feature's i18n namespace
   in parallel so cold navigation doesn't pay two sequential round
   trips:

   ```tsx
   /**
    * @file routes.tsx
    * @description Route declarations for the <Feature> feature.
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

   const <ExistingPage> = lazy(async () => {
     const [mod] = await Promise.all([
       import('./pages/<ExistingPage>'),
       loadNamespace('<feature>'),
     ]);
     return { default: mod.<ExistingPage> };
   });
   const <PageName> = lazy(async () => {
     const [mod] = await Promise.all([
       import('./pages/<PageName>'),
       loadNamespace('<feature>'),
     ]);
     return { default: mod.<PageName> };
   });

   // =================================================================================================
   // Exports
   // =================================================================================================

   export const <feature>Routes = (
     <>
       <Route path="/<existing>" element={<<ExistingPage> />} />
       <Route path="/<new-path>" element={<<PageName> />} />
     </>
   );
   ```

   If `routes.tsx` previously exported a single `<Route>`, wrap
   multiple routes in a `<>` fragment. If `lazy()` wasn't used
   before, convert all existing routes in the same edit — mixing
   eager and lazy loading inside one feature defeats the splitting.
   `loadNamespace` is cheap when the namespace is already cached
   (no-op promise), so calling it from every page in the feature is
   safe.

4. **Add a navigation entry** (if the page should be reachable from
   the header). Edit
   [src/shared/nav/navLinks.ts](../../../src/shared/nav/navLinks.ts) —
   the single `navLinks` array consumed by the **five full-nav
   layouts** (Stacked / Sidebar / TopbarSidebar / Centered /
   MobileDrawer). Append a `{ to, key, fallback, icon }` entry; the
   icon comes from `lucide-react` and is rendered only by the
   mobile-drawer layout (the other four ignore it). The two
   BottomTabs layouts use their own curated `tabs[]` arrays — if the
   route should appear there too, edit them explicitly. Then add
   the `nav.<key>` translation in every locale's
   `src/shared/i18n/locales/<lng>/common.json`.

5. **Add i18n keys** to the host feature's namespace at
   `src/features/<feature>/i18n/{en,zh}.json` — under the
   `<pageKey>.*` group. Keys are unprefixed (the namespace IS the
   feature). See
   [add-i18n-keys/SKILL.md](../add-i18n-keys/SKILL.md).

6. **Add a smoke test** under `src/features/<feature>/__tests__/pages/<PageName>.test.tsx`:

   ```tsx
   import { render, screen } from '@testing-library/react';
   import { MemoryRouter } from 'react-router-dom';
   import { <PageName> } from '../../pages/<PageName>';

   describe('<<PageName> />', () => {
     it('renders the heading', () => {
       render(
         <MemoryRouter>
           <<PageName> />
         </MemoryRouter>
       );
       expect(
         screen.getByRole('heading', { level: 1 })
       ).toBeInTheDocument();
     });
   });
   ```

7. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Completion checklist

- [ ] Page component is in `pages/`, exported as a named export.
- [ ] Route registered inside the feature's `routes.tsx`.
- [ ] Path is unique across the app router (no collision with existing routes).
- [ ] i18n keys exist in every locale's host-feature namespace
      (`src/features/<feature>/i18n/{en,zh}.json`); `nav.<key>`
      exists in `common.json` if the page appears in the header.
- [ ] `routes.tsx` prefetches the host feature's namespace via
      `loadNamespace('<feature>')` next to each `lazy()` import.
- [ ] Smoke test asserts at least the heading or a stable element.

## Don't

- Don't put the route declaration directly in `src/app/router.tsx`. The feature owns its routes.
- Don't create a new feature just for one page — extend an existing one if it fits.
- Don't use a default export on the page just to make `lazy()` simpler. Named exports survive grep/IDE refactors; the `then((m) => ({ default: m.X }))` shim is the standard cost.
- Don't add a per-page `<Suspense>`. The app shell already wraps lazy pages in one fallback.
