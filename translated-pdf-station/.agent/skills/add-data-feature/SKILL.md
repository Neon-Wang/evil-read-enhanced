---
id: add-data-feature
title: Add a feature with swappable backends (Mock + Supabase)
description: End-to-end scaffold for a feature that talks to a backend via a service-factory abstraction, with Mock + Supabase implementations and a vanilla zustand store fronted by a selectors layer.
keywords: [feature, scaffold, service, mock, supabase, factory, store, selectors, swappable]
applies_to: ["src/features/**"]
---

# Skill: add a data-layer feature (swappable backends)

Use when the new feature must work against **both** an in-memory mock (zero-config demo / tests) and a real backend (Supabase, REST, …) **without changes to the UI code**. The `tasks` feature is the canonical example — copy its shape.

If the feature is pure UI state or has a single fixed backend, use [add-feature](../add-feature/SKILL.md) instead — that's much less boilerplate.

Re-read these rules before starting:

- [rules/00-architecture.md](../../rules/00-architecture.md)
- [rules/40-state-management.md](../../rules/40-state-management.md) — especially the "Swappable backends" section
- [rules/10-react-conventions.md](../../rules/10-react-conventions.md) — for the v1 file banner style

## Target directory shape

```
src/features/<feature>/
├── types.ts                                       # domain types
├── store/<feature>Store.ts                        # vanilla zustand + subscribeWithSelector
├── selectors/
│   ├── basic.ts
│   ├── computed.ts
│   ├── memoized.ts
│   ├── actions.ts
│   └── index.ts
├── services/
│   ├── interfaces/I<Feature>Service.ts            # contract
│   ├── implementations/
│   │   ├── Mock<Feature>Service.ts                # in-memory; always present
│   │   ├── Supabase<Feature>Service.ts            # @eikon:feature(supabase) file
│   │   └── mockData.ts                            # seed data — private to implementations
│   ├── factory/<feature>ServiceFactory.ts         # picks impl using serviceConfig
│   └── <feature>Service.ts                        # facade — `export const <feature>Service = factory.get()`
├── components/                                    # task cards, forms, screens, …
├── pages/                                         # IndexPage / NewPage / DetailsPage
├── i18n/                                          # per-feature translation namespace
│   ├── en.json
│   └── zh.json
├── routes.tsx                                     # lazy-loaded routes; prefetch ns
├── index.ts                                       # PUBLIC API barrel
└── __tests__/
    ├── store/<feature>Store.test.ts
    ├── services/Mock<Feature>Service.test.ts
    └── components/<X>.test.tsx
```

## Prerequisites

- `src/shared/services/config/serviceConfig.ts` exists and exports a `useMock` flag. If it doesn't, the template was scaffolded with `--no-supabase`; create the config file or add it back per [enable-supabase/SKILL.md](../enable-supabase/SKILL.md).

## Step list

### 1. Define the domain types

`types.ts`:

```ts
/**
 * @file types.ts
 * @description Domain types for the <Feature> feature.
 */

// =================================================================================================
// Constants
// =================================================================================================

const <Thing>Status = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;

// =================================================================================================
// Types
// =================================================================================================

type <Thing>Status = (typeof <Thing>Status)[keyof typeof <Thing>Status];

interface <Thing> {
  id: string;
  /* fields */
  createdAt: string;
}

interface Create<Thing>Input { /* required + optional fields */ }
interface Update<Thing>Input { /* partial */ }

// =================================================================================================
// Exports
// =================================================================================================

export { <Thing>Status };
export type { <Thing>, Create<Thing>Input, Update<Thing>Input };
```

### 2. Define the service interface

`services/interfaces/I<Feature>Service.ts`:

```ts
// --- Relative Imports ---
import type { <Thing>, Create<Thing>Input, Update<Thing>Input } from '../../types';

interface I<Feature>Service {
  getAll(): Promise<<Thing>[]>;
  getById(id: string): Promise<<Thing> | null>;
  add(input: Create<Thing>Input): Promise<<Thing>>;
  update(id: string, patch: Update<Thing>Input): Promise<<Thing>>;
  delete(id: string): Promise<void>;
}

export type { I<Feature>Service };
```

### 3. Write the Mock implementation

`services/implementations/Mock<Feature>Service.ts`:

- Class form (`class Mock<Feature>Service implements I<Feature>Service`).
- Mutates a per-instance copy of `SAMPLE_<THINGS>` from `mockData.ts`.
- Awaits a `simulateLatency()` helper (250–600ms) inside every method so loading states are testable.
- Provides a `__resetForTests()` method for vitest beforeEach hooks.
- Generates ids via `crypto.randomUUID()` with a Math.random fallback for older Node.

See [src/features/tasks/services/implementations/MockTasksService.ts](../../../src/features/tasks/services/implementations/MockTasksService.ts) for the canonical implementation.

### 4. Write the Supabase implementation

`services/implementations/Supabase<Feature>Service.ts`:

```ts
// @eikon:feature(supabase) file
/**
 * @file Supabase<Feature>Service.ts
 * @description Supabase-backed implementation of I<Feature>Service.
 */

// --- Absolute Imports ---
import { supabase } from '@/shared/supabase';

// --- Relative Imports ---
import type { I<Feature>Service } from '../interfaces/I<Feature>Service';
import type { <Thing>, … } from '../../types';

const TABLE = '<table>';

class Supabase<Feature>Service implements I<Feature>Service {
  /* implement every method using `supabase.from(TABLE).select/insert/update/delete` */
}

export { Supabase<Feature>Service };
```

The `@eikon:feature(supabase) file` marker MUST be the first line of the file (leading whitespace is fine, comments before it are not). The CLI's `--no-supabase` strip only honours the marker when it appears on line 1; placed anywhere else it's silently inert. This guarantees prose like this paragraph — which quotes the marker as text — never gets the file deleted by accident.

### 5. Write the factory

`services/factory/<feature>ServiceFactory.ts`:

```ts
// --- Absolute Imports ---
import { serviceConfig } from '@/shared/services';

// --- Relative Imports ---
import type { I<Feature>Service } from '../interfaces/I<Feature>Service';

import { Mock<Feature>Service } from '../implementations/Mock<Feature>Service';
class <Feature>ServiceFactory {
  private instance: I<Feature>Service | null = null;

  get<Feature>Service(): I<Feature>Service {
    if (this.instance) return this.instance;

this.instance = new Mock<Feature>Service();
    return this.instance;
  }

  __resetForTests(): void {
    this.instance = null;
  }
}

export const <feature>ServiceFactory = new <Feature>ServiceFactory();
export { <Feature>ServiceFactory };
```

The `@eikon:feature(supabase)` markers around the supabase import AND the `!useMock` branch are mandatory — when stripped, the factory unconditionally returns the Mock impl with no dangling references.

### 6. Write the facade

`services/<feature>Service.ts`:

```ts
/**
 * @file <feature>Service.ts
 * @description Public facade for the <Feature> data layer.
 *  Store / hooks / components import THIS, never the factory or impls.
 */

import { <feature>ServiceFactory } from './factory/<feature>ServiceFactory';

export const <feature>Service = <feature>ServiceFactory.get<Feature>Service();
```

### 7. Write the store

`store/<feature>Store.ts` — see [add-zustand-store/SKILL.md](../add-zustand-store/SKILL.md) (vanilla flavour) for the full template. State should include `items`, `isLoading`, `isInitialized`, `error`, plus the operations: `initialize`, `reload`, `add`, `update`, `delete`, `getById`, `reset`.

The store calls `<feature>Service.*` directly — never the factory, never an impl.

### 8. Write the selectors

`selectors/{basic,computed,memoized,actions,index}.ts` — see [add-zustand-store/SKILL.md](../add-zustand-store/SKILL.md) (vanilla flavour) for the full template.

### 9. Write the routes and pages

`routes.tsx` — lazy-load every page (the router's shared `<Suspense>`
boundary provides the fallback). Every `lazy()` block ALSO prefetches
the feature's i18n namespace in parallel so the bundle and the
translations land at the same time:

```tsx
// --- Absolute Imports ---
import { loadNamespace } from '@/shared/i18n';

const <Feature>IndexPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/<Feature>IndexPage'),
    loadNamespace('<feature>'),
  ]);
  return { default: mod.<Feature>IndexPage };
});
// … same for NewPage / DetailsPage

export const <feature>Routes = (
  <>
    <Route path="/<feature>" element={<<Feature>IndexPage />} />
    <Route path="/<feature>/new" element={<<Feature>NewPage />} />
    <Route path="/<feature>/:id" element={<<Feature>DetailsPage />} />
  </>
);
```

`loadNamespace` is idempotent: the second visit reuses the cached
bundle, so calling it from every page in the feature is the right
default.

In the pages:

- IndexPage calls `useTaskActions().initialize()` from a `useEffect`,
  then reads `useTasks()` / `useTaskLoading()` / `useTaskError()`
  from the selectors barrel.
- DetailsPage prefers `useTaskById(id)` (memoized in-store lookup)
  and falls back to `useTaskActions().getTaskById(id)` when the user
  lands via deep link.
- NewPage owns transient form state via `useState` (per
  [rules/40-state-management.md](../../rules/40-state-management.md):
  form state stays out of stores). Submits via
  `useTaskActions().addTask`.
- Every page binds i18n through the feature ns:
  `const { t } = useTranslation('<feature>');` and uses unprefixed
  keys like `t('index.title')`.

### 10. Write the public barrel

`index.ts`:

```ts
export { <feature>Routes } from './routes';

export { <feature>Store } from './store/<feature>Store';
export type { <Feature>StoreState } from './store/<feature>Store';

export {
  use<Things>, use<Thing>Loading, use<Thing>Initialized, use<Thing>Error,
  use<Thing>sByStatus, use<Thing>CountByStatus, use<Thing>Total,
  use<Thing>ById,
  use<Thing>Actions,
} from './selectors';
export type { <Thing>Actions } from './selectors';

export { <feature>Service } from './services/<feature>Service';

export { <Thing>Status } from './types';
export type { <Thing>, Create<Thing>Input, Update<Thing>Input } from './types';
```

### 11. Register the routes + nav link

Add to [src/app/router.tsx](../../../src/app/router.tsx) and (if it should appear in the header) [src/shared/nav/navLinks.ts](../../../src/shared/nav/navLinks.ts) — the single source of truth consumed by every full-nav layout (Stacked / Sidebar / TopbarSidebar / Centered / MobileDrawer). The two BottomTabs layouts use their own curated `tabs[]` arrays inline and don't read from `navLinks` — if the data feature should also appear there, add it explicitly. Then add the `nav.<key>` translation in every locale's `src/shared/i18n/locales/<lng>/common.json`.

### 12. Add i18n keys

Create `src/features/<feature>/i18n/en.json` and
`src/features/<feature>/i18n/zh.json` — one bundle per locale,
covering every key the new pages, components and screen layout use.
**Keys are NOT prefixed with `<feature>.`** — the namespace already
is the feature directory. Typical shape:

```jsonc
// src/features/<feature>/i18n/en.json
{
  "index":   { "title": "…", "new": "…", "loading": "…", "empty": "…" },
  "new":     { "title": "…", "back": "…", "created": "…", "error": "…",
               "form": { "title": "…", "description": "…", "submit": "…", "submitting": "…" } },
  "details": { "title": "…", "back": "…", "loading": "…", "notFound": "…",
               "notFoundDescription": "…", "createdAt": "…", "id": "…" },
  "status":  { "pending": "…", "in_progress": "…", "completed": "…" },
  "layout":  { "notice": "…", "mode": "…", "modeMock": "…", "modeSupabase": "…" }
}
```

If you added a nav link, also add `nav.<feature>` to every locale's
`src/shared/i18n/locales/<lng>/common.json`.

### 13. Add tests

At minimum:

- `__tests__/store/<feature>Store.test.ts` — exercises every operation via `<feature>Store.getState()`. Mocks `@/shared/supabase` per [rules/30-testing.md](../../rules/30-testing.md).
- `__tests__/services/Mock<Feature>Service.test.ts` — exercises every method on a fresh `new Mock<Feature>Service()` per test.
- `__tests__/components/<X>.test.tsx` for any non-trivial component (e.g. the status-badge logic of `<Thing>Card`).

### 14. Apply the v1 file banner everywhere

Every new file you created needs the `/** @file ... @description ... */` header and the standard `// ===` section separators with `// --- Group ---` import sub-headers. See [rules/10-react-conventions.md](../../rules/10-react-conventions.md).

### 15. Verify

```bash
pnpm --filter @eikon/react lint
pnpm --filter @eikon/react typecheck
pnpm --filter @eikon/react test
```

All three must pass with zero warnings.

## Completion checklist

- [ ] Directory shape matches the target above (singular `store/`, plural `selectors/services`).
- [ ] Every supabase file or import is gated by `@eikon:feature(supabase)` markers.
- [ ] The factory's supabase branch is also gated, AND the factory works with the supabase branch stripped (= always Mock).
- [ ] The store calls only the facade (`<feature>Service`), never the factory or an impl.
- [ ] UI code (pages, components) imports from `selectors/` only, never the store directly, never the service directly.
- [ ] `index.ts` exports the public surface: routes, store (for tests), selectors, service facade, types.
- [ ] `i18n/{en,zh}.json` exists inside the feature folder with the
      same unprefixed key set, and `routes.tsx` prefetches the
      namespace via `loadNamespace('<feature>')` next to each
      `lazy()` import. `nav.<feature>` exists in every locale's
      `common.json` if applicable.
- [ ] Store and Mock service have isolated tests with `@/shared/supabase` mocked.
- [ ] Every file has the v1 banner.
- [ ] Lint / typecheck / test all green.

## Don't

- Don't put `interfaces/implementations/factory` in `src/shared/services/` even though that's where v1 EvoMap kept them. The new architecture is feature-first: each feature owns its full service layer. Only `serviceConfig` (the `useMock` toggle) lives in `shared/`.
- Don't read the factory or an impl from outside `services/`. The facade is the only public service symbol.
- Don't sync the store back from supabase via realtime — the swappable-backends pattern keeps the store as a write-through cache: every write goes service first, then mutates the store on resolution. Realtime sync needs a different pattern (and conflicts with the Mock impl).
- Don't skip the latency simulation in the Mock impl. Without it, loading states become invisible in the demo.
- Don't hard-code i18n keys in the form `status.${status}` without
  enumerating the possible status values somewhere — locale linters
  can't verify dynamic interpolation. The status type acting as the
  source of truth is acceptable, but document it inline. (Inside the
  feature ns the key is unprefixed; the v1 codebase wrote
  `tasks.status.<x>` from the default ns — that shape is gone now.)
