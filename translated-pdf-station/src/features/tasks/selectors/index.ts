/**
 * @file index.ts
 * @description Barrel re-export for all Tasks selector hooks.
 *
 * Pages and components import from this file only — never the
 * individual selector files. That keeps the import surface flat and
 * makes it cheap to reorganise the selector implementation later.
 */

// =================================================================================================
// Exports
// =================================================================================================

export {
  useTaskError,
  useTaskInitialized,
  useTaskLoading,
  useTasks,
} from './basic';
export {
  useTaskCountByStatus,
  useTasksByStatus,
  useTaskTotal,
} from './computed';
export { useTaskById } from './memoized';
export { useTaskActions } from './actions';
export type { TaskActions } from './actions';
