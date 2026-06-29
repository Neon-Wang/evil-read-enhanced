/**
 * @file MockTasksService.ts
 * @description In-memory implementation of ITasksService.
 *
 * Backs the demo experience and every unit test that doesn't want to
 * stand up Supabase. Mutates a single shared list at module scope so
 * created tasks survive cross-page navigation (matches the original
 * EvoMap v1 behaviour). State resets on a full page reload — good
 * enough for a demo, NOT durable.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Relative Imports ---
import { SAMPLE_TASKS } from './mockData';

import type { CreateTaskInput, Task, UpdateTaskInput } from '../../types';
import type { ITasksService } from '../interfaces/ITasksService';


// =================================================================================================
// Constants
// =================================================================================================

/**
 * Simulated network latency for the mock path. Short enough that the
 * UI feels snappy, long enough that loading states are still visible
 * (and therefore testable).
 */
const MOCK_LATENCY_MIN_MS = 250;
const MOCK_LATENCY_MAX_MS = 600;

// =================================================================================================
// Helpers
// =================================================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function simulateLatency(): Promise<void> {
  const ms =
    MOCK_LATENCY_MIN_MS +
    Math.random() * (MOCK_LATENCY_MAX_MS - MOCK_LATENCY_MIN_MS);
  return sleep(ms);
}

function generateId(): string {
  // Browser crypto is available in every supported runtime (modern
  // browsers + Node 19+); fall back to a Math.random ID so unit tests
  // running in older Node images don't blow up.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// =================================================================================================
// Implementation
// =================================================================================================

class MockTasksService implements ITasksService {
  /**
   * Mutable copy of the seed data. Class-level so multiple instances
   * (e.g. instantiated by tests) start from the same fresh baseline
   * but don't leak mutations into each other across runs.
   */
  private tasks: Task[];

  constructor(seed: ReadonlyArray<Task> = SAMPLE_TASKS) {
    this.tasks = seed.map((t) => ({ ...t }));
  }

  async getTasks(): Promise<Task[]> {
    await simulateLatency();
    return this.tasks
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ ...t }));
  }

  async getTaskById(id: string): Promise<Task | null> {
    await simulateLatency();
    const found = this.tasks.find((t) => t.id === id);
    return found ? { ...found } : null;
  }

  async addTask(input: CreateTaskInput): Promise<Task> {
    await simulateLatency();
    const created: Task = {
      id: generateId(),
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(created);
    return { ...created };
  }

  async updateTask(id: string, patch: UpdateTaskInput): Promise<Task> {
    await simulateLatency();
    const i = this.tasks.findIndex((t) => t.id === id);
    if (i === -1) throw new Error(`Task not found: ${id}`);
    this.tasks[i] = { ...this.tasks[i]!, ...patch };
    return { ...this.tasks[i]! };
  }

  async deleteTask(id: string): Promise<void> {
    await simulateLatency();
    const i = this.tasks.findIndex((t) => t.id === id);
    if (i === -1) throw new Error(`Task not found: ${id}`);
    this.tasks.splice(i, 1);
  }

  /**
   * Test-only: reset the instance back to the seed data. Exported so
   * vitest suites can isolate cases without poking the private state.
   */
  __resetForTests(): void {
    this.tasks = SAMPLE_TASKS.map((t) => ({ ...t }));
  }
}

// =================================================================================================
// Exports
// =================================================================================================

export { MockTasksService };
