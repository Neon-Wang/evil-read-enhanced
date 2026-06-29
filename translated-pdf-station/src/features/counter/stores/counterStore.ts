/**
 * @file counterStore.ts
 * @description Tiny pure-client Zustand store used by the counter demo.
 *
 * Demonstrates the simpler shape that pure-client features use — no
 * service layer, no selectors split, just `create()` and read it
 * directly. Compare with `features/tasks/store/tasksStore.ts` for the
 * full Service + Store + Selectors flavour.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { create } from 'zustand';

// =================================================================================================
// Types
// =================================================================================================

interface CounterState {
  value: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

// =================================================================================================
// Store
// =================================================================================================

const useCounterStore = create<CounterState>((set) => ({
  value: 0,
  increment: () => set((s) => ({ value: s.value + 1 })),
  decrement: () => set((s) => ({ value: Math.max(0, s.value - 1) })),
  reset: () => set({ value: 0 }),
}));

// =================================================================================================
// Exports
// =================================================================================================

export { useCounterStore };
export type { CounterState };
