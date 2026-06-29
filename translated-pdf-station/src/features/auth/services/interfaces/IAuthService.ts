/**
 * @file IAuthService.ts
 * @description Auth service contract.
 *
 * Every implementation (Mock, Supabase, …) must honour this interface
 * so feature code can swap backends with a single config flag and no
 * consumer-side changes — same factory pattern as the Tasks feature.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Relative Imports ---
import type {
  AuthUser,
  OAuthProvider,
  SignInPayload,
  SignUpPayload,
} from '../../types';

// =================================================================================================
// Interface
// =================================================================================================

interface IAuthService {
  /** Email + password sign-in. Rejects with `Error` on invalid credentials. */
  signInWithEmail(payload: SignInPayload): Promise<AuthUser>;

  /** Email + password sign-up. Rejects with `Error` if the email is taken. */
  signUpWithEmail(payload: SignUpPayload): Promise<AuthUser>;

  /**
   * OAuth handshake. Mock returns immediately with a synthetic user;
   * Supabase opens the provider redirect (`signInWithOAuth`) and returns
   * the redirect URL so the caller can navigate.
   */
  signInWithOAuth(
    provider: OAuthProvider
  ): Promise<{ user?: AuthUser; redirectUrl?: string }>;

  /** Tear down the session. */
  signOut(): Promise<void>;
}

// =================================================================================================
// Exports
// =================================================================================================

export type { IAuthService };
