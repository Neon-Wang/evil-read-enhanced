/**
 * @file computed.ts
 * @description Derived selectors over the Auth store.
 *
 * Each hook computes a value from one or more fields of the slice.
 * Keep the derivations cheap (these run on every store change that
 * touches the underlying field) — for anything heavier put the hook
 * in a `memoized.ts` sibling and gate the result with `useMemo`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { useStore } from 'zustand';

// --- Relative Imports ---
import { authStore } from '../store/authStore';

// =================================================================================================
// Selectors
// =================================================================================================

function useIsSignedIn(): boolean {
  return useStore(authStore, (s) => s.user !== null);
}

// =================================================================================================
// Exports
// =================================================================================================

export { useIsSignedIn };
