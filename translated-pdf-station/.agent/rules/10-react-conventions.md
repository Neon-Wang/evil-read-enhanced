---
id: react-conventions
title: React 19 + TypeScript component conventions
description: Authoring rules for React 19 components, hooks, props, and refs in this codebase.
applies_to: ["src/**/*.{ts,tsx}"]
severity: must
---

# React 19 conventions

## Components

- **Function components only.** No class components, no `React.FC` typing alias — type props directly via an `interface` / `type`.
- File and exported component names use **PascalCase**; the filename matches the default-exported component when one exists, e.g. `CounterDisplay.tsx` exports `CounterDisplay`.
- Co-locate small subcomponents in the same file when they are tightly coupled and not reused elsewhere. Promote them to their own file once they exceed ~40 lines or get reused.
- Server-only or environment-specific code must guard with `typeof window` checks; the template is currently CSR-only but rules should remain SSR-safe.

## Hooks

- Custom hooks are named `useSomething` and live in `<feature>/hooks/` (or `shared/hooks/` if cross-cutting).
- Hooks must obey the rules of hooks (no conditional calls). Lint enforces this via `react-hooks/rules-of-hooks`.
- Effects: prefer event handlers and derived values over `useEffect`. Use `useEffect` only for synchronization with **external** systems (subscriptions, focus, document title, etc.).
- `useState` initializer functions must be cheap; expensive initialization belongs in a memoized initializer (`useState(() => createX())`).
- React 19 enables automatic memoization for many patterns. Do **not** wrap everything in `useCallback`/`useMemo` reflexively — only when profiling or a referential-equality contract demands it.

## Props

- Define `interface FooProps { ... }` adjacent to the component.
- Use `React.ReactNode` for children, `React.ComponentPropsWithoutRef<'tag'>` to extend native elements, `React.ComponentPropsWithoutRef<typeof Comp>` to wrap Radix-style primitives.
- Discriminated unions are preferred over boolean prop pairs when behavior changes:

  ```ts
  type Variant =
    | { kind: 'text'; text: string }
    | { kind: 'icon'; icon: ReactNode };
  ```

## Refs and forwarding

- Use `React.forwardRef` for primitives that wrap a native element and need a ref (`Button`, `Input`, etc.).
- React 19's `ref` as a regular prop is fine in new code; existing primitives in `src/shared/ui/` use `forwardRef` for compatibility.

## Imports

- Use the `@/` alias for any cross-directory import (`@/shared/ui/button`, `@/features/counter`). Reserve relative paths for siblings within the same directory or for `__tests__/` referencing the unit under test.
- Type-only imports use the inline syntax: `import { type CounterState } from '@/features/counter'`. Lint (`@typescript-eslint/consistent-type-imports`) enforces this.
- Import order at the **group** level: built-ins → external → `@/...` internal → relative (parent / sibling / index). Type-only imports stay in the syntactic group that matches their package (a `import type { ReactNode } from 'react'` goes in the external group, NOT in a trailing "types" group). ESLint's `import/order` enforces the top-level group order; **within a group** blank lines and arbitrary ordering are allowed so that the v1 banner sub-headers below can group imports visually.

## File structure & banners

Every non-trivial source file follows the v1 banner convention. Tooling (Prettier / ESLint) does not enforce the banners themselves, but reviewers do — they exist so an agent can locate a file's pieces in one read.

```ts
/**
 * @file <fileName>
 * @description <1–3 sentences describing what the file is responsible for.
 *  Explain the "why" — what other files in the repo would the reader
 *  want to know about? Trade-offs the file makes? Add a blank line and
 *  a short paragraph when the rationale needs it.>
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useEffect } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// --- Third-party Libraries ---
import { Loader2 } from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';

// --- Relative Imports ---
import { TaskCard } from '../components/TaskCard';
import type { Task } from '../types';

// =================================================================================================
// Types
// =================================================================================================

interface MyProps { /* … */ }

// =================================================================================================
// Component
// =================================================================================================

function My({ … }: MyProps) { /* … */ }

// =================================================================================================
// Exports
// =================================================================================================

export { My };
export type { MyProps };
```

### Rules for the file header

- Every `.ts` / `.tsx` source file under `src/` and every test file under `__tests__/` opens with a `/** @file ... @description ... */` JSDoc block.
- `@file` matches the filename. `@description` is mandatory.
- **Do not** include `@author` — template files are anonymised; PRs and `git blame` carry authorship.

### Rules for `// ====` section separators

- A separator is the 4-line block above (comment, `// ===...`, header, `// ===...`, comment). The `=` line is exactly 99 characters so headers visually stack in any terminal.
- Use a separator before each of: Imports, Types, Constants, Helpers, Component(s), Hooks, Tests, Fixtures, Exports. Pick the headers that apply; omit the ones that don't.
- Order is approximately: Imports → Types → Constants → Helpers → main exports (Component / Store / Service / etc.) → Exports.
- For test files, the inner separators are: Imports → (Fixtures or Module mocks) → Tests.

### Rules for `// --- Group ---` import sub-headers

- The five sub-groups used inside a single file's `Imports` block are: **Core Libraries** (React, `react-dom`), **Core-related Libraries** (`react-router-dom`, `react-i18next`, other React-ecosystem packages), **Third-party Libraries** (everything else from npm), **Absolute Imports** (`@/...`), **Relative Imports** (`./`, `../`).
- Skip sub-headers that have zero imports.
- Inside a sub-group: blank lines between imports are allowed, but try to keep related imports together (e.g. all `react-router-dom` imports adjacent).
- Inline `@eikon:feature(...)` markers around imports are preserved; do not relocate an import out of its marker bracket just to satisfy alphabetical instinct.

### Exception: trivial files

Files under ~15 lines whose only content is one or two imports plus a single re-export MAY skip the section banners entirely. The file header (`@file` / `@description`) is still required. Example: `src/features/<x>/index.ts` barrels with one or two exports.

## Error handling and loading states

- Routes that fetch data should render an explicit loading state and error state; never rely on undefined intermediate values.
- Throwing from a component is acceptable when an upstream `ErrorBoundary` exists; otherwise return an error UI.

## Anti-patterns to avoid

- `default export` is acceptable for `main.tsx`-style entries but **prefer named exports** for components and hooks. Named exports improve grep-ability and IDE refactor safety.
- Do not put network requests directly in components. Put them in `services/` and call from hooks (`useFooQuery`) or events.
- Do not store derivable values in state; derive them during render or with `useMemo` when expensive.
