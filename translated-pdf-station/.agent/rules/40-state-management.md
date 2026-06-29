---
id: state-management
title: State management decision tree
description: When to reach for useState, useReducer, Zustand, or TanStack Query. Avoid layering them without a reason.
applies_to: ["src/**/*.{ts,tsx}"]
severity: must
---

# State management

Always pick the **least powerful** primitive that solves the problem.

## Decision tree

```
Does the state belong to a single component and not need to survive remounts?
  └── YES → useState / useReducer (local state)
  └── NO  ↓

Is it server data AND the feature needs swappable backends (Mock vs Supabase)?
  └── YES → Service + Store + Selectors pattern  (see "Swappable backends" below)
  └── NO  ↓

Is it server / remote data with fetching, caching, retries, mutations?
  └── YES → TanStack Query (baseline; provider mounted in app/providers.tsx)
  └── NO  ↓

Is it client-side, cross-feature, or cross-route?
  └── YES → Zustand store (in feature/<name>/store/ or shared/stores/)
  └── NO  → Reconsider: maybe it's derivable. Do not store it.
```

## Local state (`useState` / `useReducer`)

- Default choice. Don't promote to a store just because a component grew.
- Use `useReducer` when state transitions form a small state machine (3+ related actions).

## Zustand (client state)

- One store per **logical domain** (counter, theme, auth-session). Do not create a giant root store.
- Pure-client feature stores live in `features/<name>/stores/<storeName>.ts` and use `create(...)`.
- Server-backed feature stores live in `features/<name>/store/<storeName>.ts` (singular) and use `createStore(...)` from `zustand/vanilla` so non-React code (selectors, services, tests) can read and write without owning a render. See "Swappable backends" below.
- `src/shared/stores/` is reserved for the rare genuinely cross-feature store.
- Select narrow slices to minimize rerenders:

  ```ts
  const value = useCounterStore((s) => s.value);
  ```

- Avoid putting derived values in the store. Derive in the selector or component.
- Persistence (localStorage, etc.) goes through Zustand middleware (`persist`); document the migration story before adding versioned persistence.

## Swappable backends — Service + Store + Selectors

Use this pattern when a feature must work against **both** an in-memory mock
(no Supabase env, demos, tests) **and** a real backend (Supabase, REST) **with
the same UI**. The `tasks` feature is the canonical example.

### Layers

```
features/<feature>/
├── services/
│   ├── interfaces/I<Feature>Service.ts          # contract
│   ├── implementations/
│   │   ├── Mock<Feature>Service.ts              # in-memory; always present
│   │   └── Supabase<Feature>Service.ts          # @eikon:feature(supabase) file
│   ├── factory/<feature>ServiceFactory.ts       # picks impl via serviceConfig
│   └── <feature>Service.ts                      # `export const xService = factory.get()`
├── store/<feature>Store.ts                      # vanilla zustand + subscribeWithSelector
└── selectors/
    ├── basic.ts        # `useTasks()`           — thin slice
    ├── computed.ts     # `useTaskCountByStatus()` — derived
    ├── memoized.ts     # `useTaskById(id)`      — id-keyed lookup
    ├── actions.ts      # `useTaskActions()`     — `{ initialize, addTask, ... }`
    └── index.ts
```

The store is the single source of truth for *what is currently on screen*; the
service is the source of truth for *what lives on the backend*. Components
**only** see the selectors barrel — never the store directly, never the
service directly.

### Why not TanStack Query for this case?

TanStack Query is the right tool when the backend choice is fixed at build
time. When the same UI must transparently swap between Mock and Supabase
(which is the demo-driven story this template optimises for), the service
factory pattern is simpler: the swap is one config flag and zero changes to
the calling code. If your feature does NOT need the Mock branch, prefer
TanStack Query and skip this layered structure.

### `shared/services/config/serviceConfig.ts`

The factory reads from `serviceConfig.useMock`. The value is derived from the
Supabase env vars at module load time; the supabase-aware branch is wrapped
in `@eikon:feature(supabase)` markers so the CLI's `--no-supabase` strip
collapses the file down to a constant `true` (= "always mock").

### Public API surface

The feature's `index.ts` is the **only** boundary external callers see. For a
data-layer feature it exports:

```ts
export { tasksRoutes } from './routes';
export { tasksStore } from './store/tasksStore';     // for tests / dev tools
export {
  useTasks, useTaskLoading, useTaskInitialized,
  useTaskCountByStatus, useTaskActions, useTaskById,
} from './selectors';
export { tasksService } from './services/tasksService';
export type { Task, TaskStatus, CreateTaskInput } from './types';
```

Components and pages — even inside the feature — **must not** import the
store or the factory directly; go through `selectors/` and `tasksService`.
The store is exported only so tests and devtools can poke `getState()`.

### Testing the pattern

- Test each service implementation in isolation: instantiate
  `new MockTasksService()` (or the supabase impl with a mocked client), call
  the contract methods.
- Test the store via `tasksStore.getState()` — never render React for store
  tests. See [30-testing.md](./30-testing.md) for the vanilla-store recipe.
- For component tests that touch the store, the test mocks the service
  module so the store never actually hits I/O:
  `vi.mock('@/features/<name>/services/<name>Service', () => ({ … }))`.

## TanStack Query (server state)

- Use for any data loaded from a backend (Supabase, REST, GraphQL).
- Query keys are arrays, prefixed with the feature name: `['counter', 'history', userId]`.
- Co-locate query/mutation hooks in `features/<name>/services/` or `features/<name>/hooks/`. They wrap a thin async function that hits the API.
- Don't shoehorn UI flags into TanStack Query cache. Use local state or a Zustand store.

## Context API

- Use sparingly. React context is appropriate for **stable values** that genuinely concern many descendants (theme, current user, feature flags).
- A context whose value changes often will cause widespread rerenders; use Zustand instead.

## Don't

- Don't combine Redux/MobX/Jotai with the above stack. Pick one of the three primitives this template ships with.
- Don't sync server data into a Zustand store **as a cache layer over TanStack Query**. If TanStack Query owns the fetching, let it own the caching too. The Swappable-backends pattern is a different shape: the store IS the cache because the service layer is direct (no Query in front), and the store and service are co-designed.
- Don't store form state in Zustand. Use React Hook Form locally, or `useState` for trivial forms.
- Don't introduce a fourth flavour of state. The three primitives (`useState`, Zustand store, TanStack Query) cover every case in this codebase. If you reach for something else (event emitter, observable, context-as-state, …), describe the problem in the PR and we'll fold the right primitive's escape hatch into this rule instead.
