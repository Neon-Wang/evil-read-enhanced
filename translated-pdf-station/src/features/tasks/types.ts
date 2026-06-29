/**
 * @file types.ts
 * @description Domain types for the Tasks feature.
 *
 * Single source of truth for the Task shape that flows through the
 * service / store / selector layers. UI code should import from the
 * feature's public barrel (`@/features/tasks`), NOT from this file.
 */

// =================================================================================================
// Constants
// =================================================================================================

const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

// =================================================================================================
// Types
// =================================================================================================

type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
}

interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
}

// =================================================================================================
// Exports
// =================================================================================================

export { TaskStatus };
export type { CreateTaskInput, Task, UpdateTaskInput };
