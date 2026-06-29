/**
 * @file basic.ts
 * @description Thin slice selectors over the Tasks store.
 *
 * Each hook subscribes to ONE field so a change anywhere else in the
 * store doesn't re-render the consumer. UI code should prefer these
 * over reading the store directly.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { useStore } from 'zustand';

// --- Relative Imports ---
import { tasksStore } from '../store/tasksStore';

// =================================================================================================
// Selectors
// =================================================================================================

function useTasks() {
  return useStore(tasksStore, (s) => s.tasks);
}

function useTaskLoading() {
  return useStore(tasksStore, (s) => s.isLoading);
}

function useTaskInitialized() {
  return useStore(tasksStore, (s) => s.isInitialized);
}

function useTaskError() {
  return useStore(tasksStore, (s) => s.error);
}

// =================================================================================================
// Exports
// =================================================================================================

export { useTaskError, useTaskInitialized, useTaskLoading, useTasks };
