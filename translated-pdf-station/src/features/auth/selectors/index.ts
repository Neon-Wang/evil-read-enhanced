/**
 * @file index.ts
 * @description Barrel re-export for all Auth selector hooks.
 *
 * Components import from this file only — never the individual
 * selector files. Keeps the import surface flat and makes it cheap to
 * reorganise the selector implementation later.
 */

// =================================================================================================
// Exports
// =================================================================================================

export {
  useAuthError,
  useAuthSubmitting,
  useShowSignInModal,
  useSignedInUser,
  useSignInMode,
} from './basic';
export { useIsSignedIn } from './computed';
export {
  useAuthActions,
  useCloseSignInModal,
  useOpenSignInModal,
} from './actions';
export type { AuthActions } from './actions';
