/**
 * @file actions.ts
 * @description Write-side hook bundle for the Tasks feature.
 *
 * `useTaskActions()` returns a stable object of the store's operations
 * (initialize, addTask, updateTask, …). The reference is stable because
 * vanilla zustand action functions are themselves stable references —
 * `useMemo` then locks in one object identity for the lifetime of the
 * consumer, so the hook is safe to pass into effect dependencies.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useMemo } from 'react';

// --- Relative Imports ---
import { tasksStore } from '../store/tasksStore';

import type { TasksStoreState } from '../store/tasksStore';

// =================================================================================================
// Types
// =================================================================================================

type TaskActions = Pick<
  TasksStoreState,
  | 'initialize'
  | 'reload'
  | 'addTask'
  | 'updateTask'
  | 'deleteTask'
  | 'getTaskById'
  | 'reset'
>;

// =================================================================================================
// Hooks
// =================================================================================================

function useTaskActions(): TaskActions {
  return useMemo<TaskActions>(() => {
    const s = tasksStore.getState();
    return {
      initialize: s.initialize,
      reload: s.reload,
      addTask: s.addTask,
      updateTask: s.updateTask,
      deleteTask: s.deleteTask,
      getTaskById: s.getTaskById,
      reset: s.reset,
    };
  }, []);
}

// =================================================================================================
// Exports
// =================================================================================================

export { useTaskActions };
export type { TaskActions };
