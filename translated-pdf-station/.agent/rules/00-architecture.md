---
id: architecture
title: Feature-first architecture
description: Defines the top-level directory shape, the rules governing cross-module imports, and the public API of every feature.
applies_to: ["src/**"]
severity: must
---

# Architecture

This codebase is **feature-first**. Each user-facing capability lives in its own self-contained module under `src/features/<name>/`. The application shell (`src/app/`) wires features together; `src/shared/` exposes building blocks that any feature may consume.

## Directory shape

```
src/
├── app/                          # Application shell: providers, router, layouts, global pages
│   ├── layouts/
│   ├── pages/                    # Only for shell-owned pages (e.g. NotFound, ErrorBoundary)
│   ├── providers.tsx
│   └── router.tsx
├── features/
│   └── <feature>/
│       ├── components/           # Components used only inside this feature
│       ├── hooks/                # Feature-scoped use* hooks
│       ├── store/                # ONE Zustand store per feature (vanilla + subscribeWithSelector)
│       │   └── <feature>Store.ts
│       ├── selectors/            # Read-side / write-side hooks built on the store
│       │   ├── basic.ts          #   - thin slice subscriptions (REQUIRED)
│       │   ├── computed.ts       #   - derived data (REQUIRED)
│       │   ├── actions.ts        #   - useXActions() bundle of write ops (REQUIRED)
│       │   ├── index.ts          #   - barrel (REQUIRED)
│       │   └── memoized.ts       #   - id-keyed lookups, expensive derivations (optional; add when needed)
│       ├── services/             # API / data access — interface + dual impl + factory
│       │   ├── interfaces/I<Feature>Service.ts
│       │   ├── implementations/
│       │   │   ├── Mock<Feature>Service.ts
│       │   │   └── Supabase<Feature>Service.ts   # @eikon:feature(supabase) file
│       │   ├── factory/<feature>ServiceFactory.ts
│       │   └── <feature>Service.ts               # exported facade — call serviceFactory inside
│       ├── pages/                # Route-level components belonging to this feature
│       ├── i18n/                 # Per-feature translation namespace (en.json, zh.json)
│       ├── routes.tsx            # Optional: <Route> declarations + loadNamespace() prefetch
│       ├── types.ts              # Feature-scoped TypeScript types
│       ├── index.ts              # PUBLIC API barrel — the only file external code may import
│       └── __tests__/            # Tests mirroring this feature's source layout
├── shared/                       # Cross-feature: ui, lib, hooks, services/config, i18n bootstrap, etc.
│   └── services/
│       └── config/serviceConfig.ts  # Global toggle: useMock (Mock impl) vs real backend
└── styles/                       # Tailwind v4 entry + global CSS
```

The expanded `store / selectors / services` shape exists for any feature that
swaps between **Mock** and a real backend (Supabase, REST, …). For pure-client
features with no data layer (e.g. `counter`) the simpler `stores/<x>Store.ts`
shape is canonical — both forms are first-class. Pick by feature
shape: data-layer features use singular `store/`; pure-client
features use plural `stores/`. The `counter` feature in the
template is an example of the pure-client form; `auth` and `tasks` are
examples of the data-layer form.

## Import boundary rules

These are enforced by `eslint-plugin-import`'s `import/no-restricted-paths` in [eslint.config.js](../../eslint.config.js):

1. A feature **must not** import internal files from another feature. To use feature `B` from feature `A`, import only from `@/features/B` (which resolves to `B/index.ts`).
2. `src/shared/` **must not** import from `src/features/`. Shared code is leaf-level.
3. `src/app/` may import features only through their `index.ts` or `routes.tsx`.
4. Anything under `src/styles/` is non-JS asset and must not be imported by application logic except for the entrypoint side-effect import in `src/main.tsx`.

If an agent finds itself wanting to violate these boundaries, the correct move is almost always:

- **Promote** the shared logic up into `src/shared/`, or
- **Expose** the missing piece through the source feature's `index.ts`.

## Each feature's public API

`features/<name>/index.ts` re-exports exactly the symbols this feature is willing to be consumed under. Everything else is private. Adding a new export is an intentional API change — review it as such.

A minimal `index.ts` example for a pure-client feature (`counter`):

```ts
export { counterRoutes } from './routes';
export { useCounterStore } from './stores/counterStore';
export type { CounterState } from './stores/counterStore';
```

A full `index.ts` for a data-layer feature (`tasks`):

```ts
export { tasksRoutes } from './routes';
export { tasksStore } from './store/tasksStore';
export {
  useTasks,
  useTaskLoading,
  useTaskInitialized,
  useTaskCountByStatus,
  useTaskActions,
} from './selectors';
export { tasksService } from './services/tasksService';
export type { Task, TaskStatus, CreateTaskInput } from './types';
```

External callers should only ever read this barrel — internal subpaths are
enforced as private by `eslint-plugin-import`.

## When to create a new feature vs. extending shared/

- The capability has its own **route**, **state**, or **data model** → new feature.
- The piece is a presentational primitive (button variant, layout helper, generic hook) → `src/shared/`.
- The piece is glue between many features (auth context, analytics) → `src/shared/` (potentially a `shared/<area>/`).

When in doubt, prefer creating a feature; "promote to shared" is a cheap later refactor, but "split a feature back apart" is expensive.
