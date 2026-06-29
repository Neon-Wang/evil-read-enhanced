/**
 * @file MockAuthService.ts
 * @description In-memory implementation of IAuthService.
 *
 * Accepts any non-empty email/password pair and returns a synthetic
 * AuthUser keyed by the email. OAuth flows resolve instantly with a
 * synthetic user too — there's no real redirect. Good enough for the
 * demo experience and every unit test that doesn't want to stand up
 * Supabase.
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
import type { IAuthService } from '../interfaces/IAuthService';

// =================================================================================================
// Constants
// =================================================================================================

/**
 * Simulated network latency so loading states are visible (and
 * therefore testable). Matches MockTasksService's range so the demo
 * "feels" consistent across the two flows.
 */
const MOCK_LATENCY_MIN_MS = 350;
const MOCK_LATENCY_MAX_MS = 750;

// =================================================================================================
// Helpers
// =================================================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function simulateLatency(): Promise<void> {
  const ms =
    MOCK_LATENCY_MIN_MS +
    Math.random() * (MOCK_LATENCY_MAX_MS - MOCK_LATENCY_MIN_MS);
  return sleep(ms);
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeUser(email: string, fullName?: string): AuthUser {
  return { id: generateId(), email, fullName };
}

function assertEmailPassword(email: string, password: string): void {
  if (!email.trim() || !password) {
    throw new Error('Email and password are required.');
  }
}

// =================================================================================================
// Implementation
// =================================================================================================

class MockAuthService implements IAuthService {
  async signInWithEmail({ email, password }: SignInPayload): Promise<AuthUser> {
    await simulateLatency();
    assertEmailPassword(email, password);
    return makeUser(email);
  }

  async signUpWithEmail({
    email,
    password,
    fullName,
  }: SignUpPayload): Promise<AuthUser> {
    await simulateLatency();
    assertEmailPassword(email, password);
    return makeUser(email, fullName);
  }

  async signInWithOAuth(
    provider: OAuthProvider
  ): Promise<{ user?: AuthUser; redirectUrl?: string }> {
    await simulateLatency();
    return {
      user: makeUser(`${provider}-user@example.com`),
    };
  }

  async signOut(): Promise<void> {
    await simulateLatency();
  }
}

// =================================================================================================
// Exports
// =================================================================================================

export { MockAuthService };
