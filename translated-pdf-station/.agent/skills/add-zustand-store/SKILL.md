---
id: add-zustand-store
title: Add a Zustand store to a feature
description: Create a Zustand store inside a feature in either the pure-client (`create()`) or vanilla (`createStore()` + selectors) flavour.
keywords: [zustand, store, state, client state, vanilla, selectors, subscribeWithSelector]
applies_to: ["src/features/**/store/**", "src/features/**/stores/**", "src/shared/stores/**"]
---

# Skill: add a Zustand store

Use when the user asks for client-side state that needs to survive component unmount, be shared across siblings, or persist across routes. Re-read [rules/40-state-management.md](../../rules/40-state-management.md) to confirm Zustand is the right tool — usually it is not, and `useState` will do.

## Step 0 — pick the flavour

```
Is the store going to hold data that flows through a service layer
(Mock + Supabase swappable, or even just one backend you want to
read/write from non-React code like tests)?
  └── YES → Vanilla flavour: createStore() + subscribeWithSelector
  └── NO  → Hook flavour:    create()
```

The hook flavour is the right default for pure UI state (counter, modal open
flags, theme toggle). The vanilla flavour is the right default for any store
that pairs with a service layer.

---

## Hook flavour — `create()`

Best for: counter-style local UI state, toggles, transient view models.

> **Folder name: singular vs plural matters.** Pure-client features
> with no service layer use the plural `stores/<x>Store.ts` shape (e.g.
> `features/counter/stores/counterStore.ts`). Data-layer features that
> swap between Mock and a real backend use the singular `store/<x>Store.ts`
> alongside `services/`, `selectors/` (e.g.
> `features/auth/store/authStore.ts`). Pick by feature shape, not by
> taste — both are canonical (see `00-architecture.md` for the
> distinction).

1. **Decide ownership.** Feature-scoped pure-client state →
   `src/features/<feature>/stores/<name>Store.ts` (plural folder).
   Feature-scoped state for a feature that already has a `services/`
   layer → `src/features/<feature>/store/<name>Store.ts` (singular —
   it's the data-layer shape). Cross-feature state →
   `src/shared/stores/<name>Store.ts` (rare; justify it in the PR
   description).

2. **Define the state shape and actions** in one file:

   ```ts
   /**
    * @file <name>Store.ts
    * @description <one sentence describing the domain this store owns>.
    */

   // =================================================================================================
   // Imports
   // =================================================================================================

   // --- Third-party Libraries ---
   import { create } from 'zustand';

   // =================================================================================================
   // Types
   // =================================================================================================

   interface <Name>State {
     value: number;
     increment: () => void;
     reset: () => void;
   }

   // =================================================================================================
   // Store
   // =================================================================================================

   const use<Name>Store = create<<Name>State>((set) => ({
     value: 0,
     increment: () => set((s) => ({ value: s.value + 1 })),
     reset: () => set({ value: 0 }),
   }));

   // =================================================================================================
   // Exports
   // =================================================================================================

   export { use<Name>Store };
   export type { <Name>State };
   ```

3. **Export from the feature barrel.** In `src/features/<feature>/index.ts`:

   ```ts
   export { use<Name>Store } from './stores/<name>Store';
   export type { <Name>State } from './stores/<name>Store';
   ```

4. **Consume with narrow selectors:**

   ```ts
   const value = use<Name>Store((s) => s.value);
   const increment = use<Name>Store((s) => s.increment);
   ```

   Do not select the whole state object — that defeats Zustand's bailout-on-equal-reference rerender behaviour.

5. **Persistence (only if needed).** Wrap with the `persist` middleware:

   ```ts
   import { persist } from 'zustand/middleware';

   const use<Name>Store = create<<Name>State>()(
     persist(
       (set) => ({ /* … */ }),
       { name: '<feature>:<name>', version: 1 },
     ),
   );
   ```

   Document the migration story whenever you change the persisted shape.

6. **Write tests** under `src/features/<feature>/__tests__/stores/<name>Store.test.ts`. See [`counter` example](../../../src/features/counter/__tests__/stores/counterStore.test.ts).

---

## Vanilla flavour — `createStore()` + selectors split

Best for: stores that pair with a service layer (Mock + Supabase, or any
store that tests need to drive from outside React).

This flavour is part of the broader Service + Store + Selectors pattern —
if your feature also needs the service layer, use the
[add-data-feature](../add-data-feature/SKILL.md) skill which scaffolds the
whole thing in one pass. The steps below are the **store-only** subset.

1. **Layout.** Singular `store/` folder + sibling `selectors/` folder:

   ```
   src/features/<feature>/
   ├── store/<name>Store.ts          # createStore + subscribeWithSelector
   └── selectors/
       ├── basic.ts                  # useTasks, useTaskLoading, …
       ├── computed.ts               # useTaskCountByStatus, …
       ├── memoized.ts               # useTaskById(id), …
       ├── actions.ts                # useTaskActions() bundle
       └── index.ts                  # selectors barrel
   ```

2. **Write the store.** Use `createStore` from `zustand/vanilla` and the `subscribeWithSelector` middleware. State shape stays a single TypeScript interface; expose every operation as a method on the state itself.

   ```ts
   /**
    * @file <name>Store.ts
    * @description Vanilla zustand store for the <Name> feature. UI code
    * must NOT import this directly — go through ../selectors/.
    */

   // =================================================================================================
   // Imports
   // =================================================================================================

   // --- Third-party Libraries ---
   import { subscribeWithSelector } from 'zustand/middleware';
   import { createStore } from 'zustand/vanilla';

   // --- Relative Imports ---
   // (only if the store calls into a service layer)
   import { <name>Service } from '../services/<name>Service';
   import type { <Thing>, Create<Thing>Input } from '../types';

   // =================================================================================================
   // Types
   // =================================================================================================

   interface <Name>StoreState {
     // -- State --
     items: <Thing>[];
     isLoading: boolean;
     isInitialized: boolean;
     error: string | null;

     // -- Operations --
     initialize: () => Promise<void>;
     add: (input: Create<Thing>Input) => Promise<<Thing>>;
     reset: () => void;
   }

   // =================================================================================================
   // Store
   // =================================================================================================

   const INITIAL = { items: [] as <Thing>[], isLoading: false, isInitialized: false, error: null };

   const <name>Store = createStore<<Name>StoreState>()(
     subscribeWithSelector((set, get) => ({
       ...INITIAL,

       initialize: async () => {
         if (get().isInitialized || get().isLoading) return;
         set({ isLoading: true, error: null });
         try {
           const items = await <name>Service.getAll();
           set({ items, isLoading: false, isInitialized: true });
         } catch (e) {
           set({ isLoading: false, isInitialized: true, error: String(e) });
         }
       },

       add: async (input) => {
         const created = await <name>Service.add(input);
         set((s) => ({ items: [created, ...s.items] }));
         return created;
       },

       reset: () => set({ ...INITIAL }),
     })),
   );

   // =================================================================================================
   // Exports
   // =================================================================================================

   export { <name>Store };
   export type { <Name>StoreState };
   ```

3. **Write `selectors/basic.ts`** — one thin slice subscription per state field:

   ```ts
   import { useStore } from 'zustand';
   import { <name>Store } from '../store/<name>Store';

   function use<Things>() { return useStore(<name>Store, (s) => s.items); }
   function use<Thing>Loading() { return useStore(<name>Store, (s) => s.isLoading); }
   function use<Thing>Initialized() { return useStore(<name>Store, (s) => s.isInitialized); }
   function use<Thing>Error() { return useStore(<name>Store, (s) => s.error); }

   export { use<Things>, use<Thing>Loading, use<Thing>Initialized, use<Thing>Error };
   ```

4. **Write `selectors/computed.ts`** — cheap derived values (`*Total`, `*ByStatus`, etc).

5. **Write `selectors/memoized.ts`** — id-keyed or argument-parameterised selectors that wrap `useMemo` over the selector function:

   ```ts
   function use<Thing>ById(id: string | undefined): <Thing> | undefined {
     const selector = useMemo(
       () => (state: { items: <Thing>[] }) =>
         id ? state.items.find((x) => x.id === id) : undefined,
       [id],
     );
     return useStore(<name>Store, selector);
   }
   ```

6. **Write `selectors/actions.ts`** — bundle every write operation into one `useXActions()` hook:

   ```ts
   import { useMemo } from 'react';
   import { <name>Store } from '../store/<name>Store';
   import type { <Name>StoreState } from '../store/<name>Store';

   type <Name>Actions = Pick<<Name>StoreState, 'initialize' | 'add' | 'reset'>;

   function use<Thing>Actions(): <Name>Actions {
     return useMemo(() => {
       const s = <name>Store.getState();
       return { initialize: s.initialize, add: s.add, reset: s.reset };
     }, []);
   }

   export { use<Thing>Actions };
   export type { <Name>Actions };
   ```

   Vanilla zustand action references are stable; the `useMemo` locks in one object identity for the caller's lifetime so the hook is safe to put into effect dependencies.

7. **Write `selectors/index.ts`** — barrel that re-exports every selector hook. UI code imports from this barrel only.

8. **Export from the feature barrel** (`src/features/<feature>/index.ts`):

   ```ts
   export { <name>Store } from './store/<name>Store';
   export type { <Name>StoreState } from './store/<name>Store';
   export { use<Things>, use<Thing>Loading, /* … */, use<Thing>Actions } from './selectors';
   export type { <Name>Actions } from './selectors';
   ```

9. **Test the store via `getState()`** (no React). See [rules/30-testing.md](../../rules/30-testing.md) for the vanilla-store recipe and the `@/shared/supabase` mock pattern.

## Completion checklist

- [ ] Flavour picked in step 0 matches the feature's needs.
- [ ] Hook flavour: store file under `<feature>/stores/` (plural); state + actions in a single `interface`.
- [ ] Vanilla flavour: store under `<feature>/store/` (singular); selectors split into `basic / computed / memoized / actions / index`.
- [ ] Exported through the feature's `index.ts` if external code needs it.
- [ ] Consumers select narrow slices (hook flavour) or use the selectors barrel (vanilla flavour).
- [ ] Tests reset state in `beforeEach` and cover every action.
- [ ] If persisted: `version` is set and migration is documented.

## Don't

- Don't combine multiple unrelated domains into one store.
- Don't use the vanilla flavour for trivial UI toggles. It's significantly more boilerplate.
- Don't bypass the selectors barrel from UI code in the vanilla flavour — that's how the abstraction earns its keep.
- Don't store form state in Zustand — use React Hook Form locally.
- Don't put derived values in the store. Derive in the selector.
