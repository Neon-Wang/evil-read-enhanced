/**
 * @file memoized.ts
 * @description Selectors whose computation is parameterised by a hook
 * argument (e.g. an id) and must therefore be memoised per-argument.
 *
 * Without memoisation, the selector closure would be a fresh function
 * on every render and zustand would re-run the comparison every time.
 * We use `useMemo` over the argument plus a stable equality check.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useMemo } from 'react';

// --- Third-party Libraries ---
import { useStore } from 'zustand';

// --- Relative Imports ---
import { tasksStore } from '../store/tasksStore';

import type { Task } from '../types';

// =================================================================================================
// Selectors
// =================================================================================================

/**
 * Look up a single task in the store cache by id. Returns `undefined`
 * when the task isn't loaded (the caller can then fall through to the
 * service / store action to fetch it).
 */
function useTaskById(id: string | undefined): Task | undefined {
  const selector = useMemo(
    () => (state: { tasks: Task[] }) =>
      id ? state.tasks.find((t) => t.id === id) : undefined,
    [id]
  );
  return useStore(tasksStore, selector);
}

// =================================================================================================
// Exports
// =================================================================================================

export { useTaskById };
