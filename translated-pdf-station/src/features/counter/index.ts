/**
 * @file index.ts
 * @description Public API barrel for the Counter feature.
 */

// =================================================================================================
// Exports
// =================================================================================================

export { counterRoutes } from './routes';
export { useCounterStore } from './stores/counterStore';
export type { CounterState } from './stores/counterStore';
