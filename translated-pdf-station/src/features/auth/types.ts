/**
 * @file types.ts
 * @description Domain types for the Auth feature.
 *
 * Single source of truth for the User shape + the SignIn / SignUp /
 * OAuth payloads. UI code should import from the feature's public
 * barrel (`@/features/auth`) — NOT from this file.
 */

// =================================================================================================
// Constants
// =================================================================================================

const AuthMode = {
  SIGN_IN: 'signin',
  SIGN_UP: 'signup',
} as const;

const OAuthProvider = {
  GOOGLE: 'google',
  GITHUB: 'github',
} as const;

// =================================================================================================
// Types
// =================================================================================================

type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];
type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

interface SignInPayload {
  email: string;
  password: string;
}

interface SignUpPayload extends SignInPayload {
  fullName?: string;
}

// =================================================================================================
// Exports
// =================================================================================================

export { AuthMode, OAuthProvider };
export type { AuthUser, SignInPayload, SignUpPayload };
