/**
 * @file actions.ts
 * @description Write-side hook bundles for the Auth feature.
 *
 * Three flavours:
 *
 *   - `useAuthActions()` — full bundle (open/close/setMode + the four
 *     async ops). Same shape as `useTaskActions()` in features/tasks.
 *   - `useOpenSignInModal()` — single-function shortcut, matches v1.
 *   - `useCloseSignInModal()` — symmetrical pair.
 *
 * Vanilla zustand action functions are themselves stable references;
 * `useMemo` then locks one object identity for the consumer's lifetime
 * so the bundle is safe inside effect dependency arrays.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useMemo } from 'react';

// --- Relative Imports ---
import { authStore } from '../store/authStore';

import type { AuthStoreState } from '../store/authStore';

// =================================================================================================
// Types
// =================================================================================================

type AuthActions = Pick<
  AuthStoreState,
  | 'openModal'
  | 'closeModal'
  | 'setMode'
  | 'signInWithEmail'
  | 'signUpWithEmail'
  | 'signInWithOAuth'
  | 'signOut'
  | 'reset'
>;

// =================================================================================================
// Hooks
// =================================================================================================

function useAuthActions(): AuthActions {
  return useMemo<AuthActions>(() => {
    const s = authStore.getState();
    return {
      openModal: s.openModal,
      closeModal: s.closeModal,
      setMode: s.setMode,
      signInWithEmail: s.signInWithEmail,
      signUpWithEmail: s.signUpWithEmail,
      signInWithOAuth: s.signInWithOAuth,
      signOut: s.signOut,
      reset: s.reset,
    };
  }, []);
}

function useOpenSignInModal(): AuthStoreState['openModal'] {
  return useMemo(() => authStore.getState().openModal, []);
}

function useCloseSignInModal(): AuthStoreState['closeModal'] {
  return useMemo(() => authStore.getState().closeModal, []);
}

// =================================================================================================
// Exports
// =================================================================================================

export { useAuthActions, useCloseSignInModal, useOpenSignInModal };
export type { AuthActions };
