/**
 * @file authStore.ts
 * @description Vanilla Zustand store for the Auth feature.
 *
 * Owns:
 *
 *   - Modal open/close + active mode (sign-in vs sign-up).
 *   - The signed-in user (when present) and any in-flight error /
 *     submitting flag.
 *   - The async operations (signInWithEmail / signUpWithEmail /
 *     signInWithOAuth / signOut) that delegate to `authService`
 *     and reconcile the store accordingly.
 *
 * Naming mirrors the v1 EvoMap shape (`open / mode / openModal /
 * closeModal`) so projects migrating from v1 keep their call sites.
 * Concrete selector hooks live next door in `../selectors/`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

// --- Relative Imports ---
import { authService } from '../services/authService';
import { AuthMode } from '../types';

import type {
  AuthUser,
  OAuthProvider,
  SignInPayload,
  SignUpPayload,
} from '../types';

// =================================================================================================
// Types
// =================================================================================================

interface AuthStoreState {
  // -- State --
  open: boolean;
  mode: AuthMode;
  user: AuthUser | null;
  isSubmitting: boolean;
  error: string | null;

  // -- State Setters (low-level, prefer Operations) --
  setOpen: (open: boolean) => void;
  setMode: (mode: AuthMode) => void;
  setUser: (user: AuthUser | null) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;

  // -- Operations --
  openModal: (mode?: AuthMode) => void;
  closeModal: () => void;
  signInWithEmail: (payload: SignInPayload) => Promise<void>;
  signUpWithEmail: (payload: SignUpPayload) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
}

// =================================================================================================
// Initial State
// =================================================================================================

const INITIAL_STATE = {
  open: false,
  mode: AuthMode.SIGN_IN as AuthMode,
  user: null as AuthUser | null,
  isSubmitting: false,
  error: null as string | null,
};

// =================================================================================================
// Helpers
// =================================================================================================

function errorToMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// =================================================================================================
// Store
// =================================================================================================

const authStore = createStore<AuthStoreState>()(
  subscribeWithSelector((set) => ({
    ...INITIAL_STATE,

    // -- State Setters --
    setOpen: (open) => set({ open }),
    setMode: (mode) => set({ mode, error: null }),
    setUser: (user) => set({ user }),
    setSubmitting: (isSubmitting) => set({ isSubmitting }),
    setError: (error) => set({ error }),

    // -- Operations --
    /**
     * Open the modal. Optionally jump to a specific tab; if `mode` is
     * omitted the existing mode is preserved (so the modal remembers
     * where the user last left off across open/close cycles).
     */
    openModal: (mode) => {
      set((s) => ({
        open: true,
        mode: mode ?? s.mode,
        error: null,
      }));
    },

    /** Close without touching `mode` (see openModal above) or `user`. */
    closeModal: () => set({ open: false, error: null }),

    signInWithEmail: async (payload) => {
      set({ isSubmitting: true, error: null });
      try {
        const user = await authService.signInWithEmail(payload);
        set({ user, isSubmitting: false, open: false });
      } catch (e) {
        set({ isSubmitting: false, error: errorToMessage(e) });
        throw e;
      }
    },

    signUpWithEmail: async (payload) => {
      set({ isSubmitting: true, error: null });
      try {
        const user = await authService.signUpWithEmail(payload);
        set({ user, isSubmitting: false, open: false });
      } catch (e) {
        set({ isSubmitting: false, error: errorToMessage(e) });
        throw e;
      }
    },

    signInWithOAuth: async (provider) => {
      set({ isSubmitting: true, error: null });
      try {
        const result = await authService.signInWithOAuth(provider);
        if (result.user) {
          set({ user: result.user, isSubmitting: false, open: false });
        } else {
          // OAuth redirect path: the page will navigate away; clear
          // submitting on the off-chance the redirect doesn't fire.
          set({ isSubmitting: false });
        }
      } catch (e) {
        set({ isSubmitting: false, error: errorToMessage(e) });
        throw e;
      }
    },

    signOut: async () => {
      set({ isSubmitting: true, error: null });
      try {
        await authService.signOut();
        set({ user: null, isSubmitting: false });
      } catch (e) {
        set({ isSubmitting: false, error: errorToMessage(e) });
        throw e;
      }
    },

    reset: () => set({ ...INITIAL_STATE }),
  }))
);

// =================================================================================================
// Exports
// =================================================================================================

export { authStore };
export type { AuthStoreState };
