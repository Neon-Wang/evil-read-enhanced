/**
 * @file ITasksService.ts
 * @description Task service contract.
 *
 * Every implementation (Mock, Supabase, REST, …) must honour this
 * interface so feature code can swap backends with a single config
 * flag and no consumer-side changes.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Relative Imports ---
import type { CreateTaskInput, Task, UpdateTaskInput } from '../../types';

// =================================================================================================
// Interface
// =================================================================================================

interface ITasksService {
  /** Fetch every task, newest-first. */
  getTasks(): Promise<Task[]>;

  /** Look up a single task by id; resolves to `null` when not found. */
  getTaskById(id: string): Promise<Task | null>;

  /** Create a task and return the persisted record (with id + createdAt). */
  addTask(input: CreateTaskInput): Promise<Task>;

  /** Partial update; resolves to the new record. Throws when id is unknown. */
  updateTask(id: string, patch: UpdateTaskInput): Promise<Task>;

  /** Delete by id. Throws when id is unknown. */
  deleteTask(id: string): Promise<void>;
}

// =================================================================================================
// Exports
// =================================================================================================

export type { ITasksService };
