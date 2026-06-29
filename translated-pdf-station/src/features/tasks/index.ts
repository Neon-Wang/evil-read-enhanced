/**
 * @file index.ts
 * @description Public API barrel for the Tasks feature.
 *
 * External code (app shell, other features, tests living outside this
 * folder) imports ONLY from this file. Adding a symbol here is an
 * intentional public-API change — review it as such.
 */

// =================================================================================================
// Exports
// =================================================================================================

export { tasksRoutes } from './routes';

export { tasksStore } from './store/tasksStore';
export type { TasksStoreState } from './store/tasksStore';

export {
  useTaskActions,
  useTaskById,
  useTaskCountByStatus,
  useTaskError,
  useTaskInitialized,
  useTaskLoading,
  useTaskTotal,
  useTasks,
  useTasksByStatus,
} from './selectors';
export type { TaskActions } from './selectors';

export { tasksService } from './services/tasksService';

export { TaskStatus } from './types';
export type { CreateTaskInput, Task, UpdateTaskInput } from './types';
