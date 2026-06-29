/**
 * @file index.ts
 * @description Public API barrel for the Auth feature.
 *
 * External code (app shell, examples, other features, tests living
 * outside this folder) imports ONLY from this file. Adding a symbol
 * here is an intentional public-API change — review it as such.
 *
 * Re-exports flow through sub-barrels (`./components`, `./selectors`,
 * `./store/authStore`, `./services/authService`, `./routes`, `./types`)
 * so the feature can reorganise its internals without breaking
 * downstream imports. The feature ships an empty `authRoutes` today:
 * the user-facing surface is a global modal mounted at provider scope
 * by `<SignInModalMount />`, not a routed page.
 */

// =================================================================================================
// Exports
// =================================================================================================

export { authRoutes } from './routes';

export {
  SignInButton,
  SignInModal,
  SignInModalMount,
} from './components';
export type {
  SignInButtonProps,
  SignInModalProps,
  SignInSubmit,
} from './components';

export { authStore } from './store/authStore';
export type { AuthStoreState } from './store/authStore';

export {
  useAuthActions,
  useAuthError,
  useAuthSubmitting,
  useCloseSignInModal,
  useIsSignedIn,
  useOpenSignInModal,
  useShowSignInModal,
  useSignedInUser,
  useSignInMode,
} from './selectors';
export type { AuthActions } from './selectors';

export { authService } from './services/authService';

export { AuthMode, OAuthProvider } from './types';
export type { AuthUser, SignInPayload, SignUpPayload } from './types';
