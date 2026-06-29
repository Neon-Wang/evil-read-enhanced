/**
 * @file computed.ts
 * @description Derived hooks that compute values on top of the basic
 * tasks slice.
 *
 * Keep the computation cheap — these run on every store change that
 * touches the underlying field. For expensive derivations (id lookups,
 * group-by, etc.) put the hook in `memoized.ts` and gate the result
 * with `useMemo`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { useStore } from 'zustand';

// --- Relative Imports ---
import { tasksStore } from '../store/tasksStore';

import type { Task, TaskStatus } from '../types';

// =================================================================================================
// Selectors
// =================================================================================================

function useTasksByStatus(status: TaskStatus): Task[] {
  return useStore(tasksStore, (s) => s.tasks.filter((t) => t.status === status));
}

function useTaskCountByStatus(): Record<TaskStatus, number> {
  return useStore(tasksStore, (s) => {
    const counts: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
    };
    for (const t of s.tasks) counts[t.status] += 1;
    return counts;
  });
}

function useTaskTotal(): number {
  return useStore(tasksStore, (s) => s.tasks.length);
}

// =================================================================================================
// Exports
// =================================================================================================

export { useTaskCountByStatus, useTasksByStatus, useTaskTotal };
