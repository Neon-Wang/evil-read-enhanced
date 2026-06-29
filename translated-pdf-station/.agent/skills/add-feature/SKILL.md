---
id: add-feature
title: Add a new feature module
description: Pick the right feature shape (pure-client vs data-layer) and scaffold its directory, public barrel, route, and tests.
keywords: [feature, scaffold, module, new]
applies_to: ["src/features/**"]
---

# Skill: add a new feature

Use this skill whenever the user asks for "a new feature", "a new page with its own state", "a new module", or any similarly scoped capability.

## Background

The codebase is feature-first (see [.agent/rules/00-architecture.md](../../rules/00-architecture.md)). Every feature owns its components, state, services, route, and tests. Cross-feature imports must go through `features/<name>/index.ts`.

There are **two supported feature shapes**. Pick one BEFORE scaffolding — switching later requires a non-trivial rename.

## Step 0 — pick the shape

```
Does the feature need data from a backend (Supabase / REST / GraphQL)?
  └── NO  → Pure-client feature. Follow steps 1–11 below.
  └── YES ↓

Does the feature need to swap between Mock and real backend at runtime
(demos with no env vars vs production with Supabase)?
  └── YES → Use the **add-data-feature** skill instead.
            See ../add-data-feature/SKILL.md
  └── NO  → Use TanStack Query for the data layer; follow steps 1–11 below
            and add a thin `services/<feature>Api.ts` + `hooks/use<X>Query.ts`.
```

Examples:
- `counter`, `home`, `settings` (UI toggles) → pure-client.
- `tasks`, `users`, `comments` (with Mock + Supabase) → use **add-data-feature**.
- `analytics-dashboard` (fixed Supabase backend, no Mock needed) → pure-client shape + TanStack Query.

## Step list — pure-client feature

1. **Confirm the feature name.** Use kebab-case for the directory (`user-profile`), camelCase for symbols (`useUserProfileStore`). Avoid generic names like `common`, `utils`, `core`.

2. **Create the directory skeleton:**

   ```
   src/features/<name>/
   ├── components/
   ├── hooks/              # only if you have feature-scoped use* hooks
   ├── stores/             # plural — pure-client shape
   ├── services/           # only if you have backend calls (with TanStack Query)
   ├── pages/
   ├── i18n/               # per-feature translation namespace
   │   ├── en.json
   │   └── zh.json
   ├── routes.tsx
   ├── types.ts            # only if you have shared types
   ├── index.ts
   └── __tests__/
       ├── components/
       ├── hooks/
       └── stores/
   ```

   Omit subdirectories that aren't needed yet (no empty folders).
   `i18n/` is required as soon as the feature renders any visible
   copy — leave it out only if every component the feature exports
   is text-free.

3. **Define the public API in `index.ts` first.** Decide what the feature is willing to be consumed under. A typical first version:

   ```ts
   /**
    * @file index.ts
    * @description Public API barrel for the <Name> feature.
    */

   // =================================================================================================
   // Exports
   // =================================================================================================

   export { <name>Routes } from './routes';
   ```

4. **Write `routes.tsx`** with lazy-loaded route(s). Prefetch the
   feature's i18n namespace IN PARALLEL with the page chunk so both
   land at the same time — no flash of fallback keys:

   ```tsx
   /**
    * @file routes.tsx
    * @description Route declarations for the <Name> feature.
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

   const <Page> = lazy(async () => {
     const [mod] = await Promise.all([
       import('./pages/<Page>'),
       loadNamespace('<name>'),
     ]);
     return { default: mod.<Page> };
   });

   // =================================================================================================
   // Exports
   // =================================================================================================

   export const <name>Routes = <Route path="/<path>" element={<<Page> />} />;
   ```

5. **Implement the page** under `pages/<Page>.tsx` with the v1 file
   banner (see [rules/10-react-conventions.md](../../rules/10-react-conventions.md)).
   Wire i18n via `useTranslation('<name>')` bound to the feature's
   namespace (see `60-i18n.md`); never hard-code copy. Inside that
   namespace use unprefixed keys: `t('title')`, not `t('<name>.title')`.

6. **If the feature has state**, add a Zustand store under `stores/<name>Store.ts` (see [add-zustand-store/SKILL.md](../add-zustand-store/SKILL.md), pure-client variant).

7. **Register the feature in the app router.** In [src/app/router.tsx](../../../src/app/router.tsx):

   ```tsx
   import { <name>Routes } from '@/features/<name>';
   // …
   {<name>Routes}
   ```

   If the feature has a navigation entry, also update [src/shared/nav/navLinks.ts](../../../src/shared/nav/navLinks.ts) — the single `navLinks` array consumed by the five full-nav layouts (Stacked / Sidebar / TopbarSidebar / Centered / MobileDrawer). Append a `{ to, key, fallback, icon }` entry; lucide-react icons; the mobile-drawer layout renders the icon, the other four full-nav layouts ignore it. The two BottomTabs layouts (`BottomTabsRootLayout`, `BottomTabsFabRootLayout`) use their own curated `tabs[]` arrays — edit them explicitly if the feature should appear there too.

8. **Add translation keys.** Create `src/features/<name>/i18n/en.json`
   and `src/features/<name>/i18n/zh.json` — the namespace name IS the
   feature directory, so the JSON should NOT carry a `<name>.` prefix
   on its keys. Every locale file must contain the same key set.
   See [add-i18n-keys/SKILL.md](../add-i18n-keys/SKILL.md). If the
   feature gets a navigation entry, also add the `nav.<name>` key to
   `src/shared/i18n/locales/<lng>/common.json`.

9. **Write tests.** At minimum:
   - One test per non-trivial function in `stores/` or `services/`.
   - One render test per page asserting the user-facing contract.

10. **Apply the v1 file banner** to every new `.ts` / `.tsx` file you created (file header, `// ===` section separators, `// --- Group ---` import sub-headers). See [rules/10-react-conventions.md](../../rules/10-react-conventions.md).

11. **Verify boundaries.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`. ESLint's `import/no-restricted-paths` will catch accidental cross-feature imports.

## When the feature has a fixed backend (no Mock needed)

Add to the pure-client shape:

```
src/features/<name>/
├── services/
│   └── <name>Api.ts          # thin async functions that call supabase/fetch
└── hooks/
    └── use<X>Query.ts        # TanStack Query wrapper
```

Then consume `useXQuery()` from the page. Don't introduce the `interfaces/implementations/factory/` subfolders — that's the swappable-backends pattern and adds boilerplate the feature doesn't need.

## Completion checklist

- [ ] Picked the right shape in step 0.
- [ ] Directory created with only the subdirectories actually needed.
- [ ] `index.ts` exports exactly the symbols intended for external use.
- [ ] Route is registered in `src/app/router.tsx`.
- [ ] No file outside this feature imports from inside it except via `@/features/<name>`.
- [ ] `i18n/{en,zh}.json` exist inside the feature folder with the
      same set of unprefixed keys, and `routes.tsx` prefetches the
      namespace via `loadNamespace('<name>')`. `nav.<name>` exists in
      every locale's `common.json` if the feature appears in the
      header.
- [ ] Every new file has the v1 file header (`@file` / `@description`) and the standard `// ===` section separators.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.

## Common mistakes

- Picking the swappable-backends shape "to be safe" when the feature has no Mock requirement — that's a lot of boilerplate (5+ extra files) for no gain. Use TanStack Query directly.
- Picking the pure-client shape when the feature needs Mock+Supabase — refactoring later requires renaming `stores/` → `store/` and splitting the file into selectors + service.
- Importing another feature's component directly (`@/features/foo/components/Bar`). Use that feature's `index.ts` barrel.
- Putting cross-feature helpers in this feature's `hooks/` or `services/`. Promote them to `src/shared/`.
- Hard-coding visible strings instead of using `t('<name>.key')`.
