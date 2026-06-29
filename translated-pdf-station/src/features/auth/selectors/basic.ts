/**
 * @file basic.ts
 * @description Thin slice selectors over the Auth store.
 *
 * Each hook subscribes to ONE field so a change anywhere else in the
 * store doesn't re-render the consumer. Mirrors the v1 EvoMap public
 * hook names (`useShowSignInModal / useSignedInUser / …`) so call
 * sites coming from v1 keep their names. Derivations that compute
 * on top of a field (e.g. `useIsSignedIn`) live in `computed.ts`.
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

function useShowSignInModal() {
  return useStore(authStore, (s) => s.open);
}

function useSignInMode() {
  return useStore(authStore, (s) => s.mode);
}

function useSignedInUser() {
  return useStore(authStore, (s) => s.user);
}

function useAuthSubmitting() {
  return useStore(authStore, (s) => s.isSubmitting);
}

function useAuthError() {
  return useStore(authStore, (s) => s.error);
}

// =================================================================================================
// Exports
// =================================================================================================

export {
  useAuthError,
  useAuthSubmitting,
  useShowSignInModal,
  useSignedInUser,
  useSignInMode,
};
