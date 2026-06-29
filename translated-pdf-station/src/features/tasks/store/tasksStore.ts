/**
 * @file tasksStore.ts
 * @description Vanilla Zustand store for the Tasks feature.
 *
 * Uses `createStore` from `zustand/vanilla` (not the React `create()`)
 * so non-React code — selectors, services, tests — can read and write
 * without owning a render. `subscribeWithSelector` enables fine-grained
 * change subscriptions for callers that opt in.
 *
 * The state shape and the operations live HERE. UI code never touches
 * the store directly: it consumes hooks exposed by `../selectors/`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

// --- Relative Imports ---
import { tasksService } from '../services/tasksService';

import type { CreateTaskInput, Task, UpdateTaskInput } from '../types';

// =================================================================================================
// Types
// =================================================================================================

interface TasksStoreState {
  // -- State --
  tasks: Task[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // -- State Setters (low-level, prefer Operations) --
  setTasks: (tasks: Task[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;

  // -- Operations --
  initialize: () => Promise<void>;
  reload: () => Promise<void>;
  addTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  getTaskById: (id: string) => Promise<Task | null>;
  reset: () => void;
}

// =================================================================================================
// Initial State
// =================================================================================================

const INITIAL_STATE = {
  tasks: [] as Task[],
  isLoading: false,
  isInitialized: false,
  error: null as string | null,
};

// =================================================================================================
// Store
// =================================================================================================

const tasksStore = createStore<TasksStoreState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,

    // -- State Setters --
    setTasks: (tasks) => set({ tasks }),
    setLoading: (isLoading) => set({ isLoading }),
    setInitialized: (isInitialized) => set({ isInitialized }),
    setError: (error) => set({ error }),

    // -- Operations --
    /**
     * Idempotent. Safe to call from every page that needs the list.
     * Once it has resolved successfully (or errored), subsequent calls
     * are no-ops. Use `reload()` to force a refetch.
     */
    initialize: async () => {
      const { isInitialized, isLoading } = get();
      if (isInitialized || isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const tasks = await tasksService.getTasks();
        set({ tasks, isLoading: false, isInitialized: true });
      } catch (e) {
        set({
          isLoading: false,
          isInitialized: true,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },

    reload: async () => {
      set({ isLoading: true, error: null });
      try {
        const tasks = await tasksService.getTasks();
        set({ tasks, isLoading: false, isInitialized: true });
      } catch (e) {
        set({
          isLoading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },

    addTask: async (input) => {
      const created = await tasksService.addTask(input);
      set((s) => ({ tasks: [created, ...s.tasks] }));
      return created;
    },

    updateTask: async (id, patch) => {
      const next = await tasksService.updateTask(id, patch);
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? next : t)),
      }));
      return next;
    },

    deleteTask: async (id) => {
      await tasksService.deleteTask(id);
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    },

    getTaskById: async (id) => {
      const cached = get().tasks.find((t) => t.id === id);
      if (cached) return cached;
      return tasksService.getTaskById(id);
    },

    reset: () => set({ ...INITIAL_STATE }),
  }))
);

// =================================================================================================
// Exports
// =================================================================================================

export { tasksStore };
export type { TasksStoreState };
