/**
 * @file authStore.test.ts
 * @description Behaviour tests for the auth store (no UI involved).
 *
 * Covers the modal open/close + mode flow and one happy-path /
 * error-path of each async op. The MockAuthService backs the store
 * by default in tests; we still mock `@/shared/supabase` because the
 * factory's marker-gated supabase import is statically resolved by
 * Vitest before strip — the real client constructs a Realtime client
 * that needs WebSocket which happy-dom doesn't provide.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { afterEach, describe, expect, it, vi } from 'vitest';

// =================================================================================================
// Module mocks (must be hoisted ABOVE imports of code-under-test)
// =================================================================================================

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get() {
        throw new Error(
          '@/shared/supabase was accessed in a unit test — mock it explicitly.'
        );
      },
    }
  ),
}));

vi.mock('@/shared/services', () => ({
  serviceConfig: { useMock: true },
}));

// --- Relative Imports (after vi.mock) ---
import { authStore } from '../../store/authStore';
import { AuthMode, OAuthProvider } from '../../types';

// =================================================================================================
// Fixtures / teardown
// =================================================================================================

afterEach(() => {
  authStore.getState().reset();
});

// =================================================================================================
// Modal flow
// =================================================================================================

describe('authStore — modal flow', () => {
  it('defaults to closed, sign-in mode, no user', () => {
    const s = authStore.getState();
    expect(s.open).toBe(false);
    expect(s.mode).toBe(AuthMode.SIGN_IN);
    expect(s.user).toBeNull();
    expect(s.isSubmitting).toBe(false);
    expect(s.error).toBeNull();
  });

  it('openModal() flips open=true and preserves mode by default', () => {
    authStore.getState().setMode(AuthMode.SIGN_UP);
    authStore.getState().openModal();
    expect(authStore.getState().open).toBe(true);
    expect(authStore.getState().mode).toBe(AuthMode.SIGN_UP);
  });

  it('openModal(mode) jumps to the requested tab', () => {
    authStore.getState().openModal(AuthMode.SIGN_UP);
    expect(authStore.getState().mode).toBe(AuthMode.SIGN_UP);
    expect(authStore.getState().open).toBe(true);
  });

  it('closeModal() flips open=false and clears any error', () => {
    authStore.getState().setError('boom');
    authStore.getState().openModal();
    authStore.getState().closeModal();
    const s = authStore.getState();
    expect(s.open).toBe(false);
    expect(s.error).toBeNull();
  });

  it('setMode() clears any error', () => {
    authStore.getState().setError('boom');
    authStore.getState().setMode(AuthMode.SIGN_UP);
    expect(authStore.getState().error).toBeNull();
  });
});

// =================================================================================================
// Async ops
// =================================================================================================

describe('authStore — async ops', () => {
  it('signInWithEmail success: closes the modal, sets the user, clears submitting', async () => {
    authStore.getState().openModal();
    await authStore
      .getState()
      .signInWithEmail({ email: 'a@b.com', password: 'pw' });
    const s = authStore.getState();
    expect(s.user?.email).toBe('a@b.com');
    expect(s.open).toBe(false);
    expect(s.isSubmitting).toBe(false);
    expect(s.error).toBeNull();
  });

  it('signInWithEmail failure: keeps the modal open and records the error', async () => {
    authStore.getState().openModal();
    await expect(
      authStore.getState().signInWithEmail({ email: '', password: '' })
    ).rejects.toThrow();
    const s = authStore.getState();
    expect(s.user).toBeNull();
    expect(s.open).toBe(true);
    expect(s.isSubmitting).toBe(false);
    expect(s.error).toMatch(/email and password are required/i);
  });

  it('signUpWithEmail success: same shape as signIn but accepts fullName', async () => {
    await authStore
      .getState()
      .signUpWithEmail({
        email: 'new@x.com',
        password: 'pw',
        fullName: 'New User',
      });
    const s = authStore.getState();
    expect(s.user?.email).toBe('new@x.com');
    expect(s.user?.fullName).toBe('New User');
  });

  it('signInWithOAuth (mock) resolves with a synthetic user', async () => {
    await authStore.getState().signInWithOAuth(OAuthProvider.GOOGLE);
    expect(authStore.getState().user?.email).toMatch(/google-user/);
  });

  it('signOut clears the user', async () => {
    await authStore
      .getState()
      .signInWithEmail({ email: 'x@y.com', password: 'pw' });
    expect(authStore.getState().user).not.toBeNull();
    await authStore.getState().signOut();
    expect(authStore.getState().user).toBeNull();
  });
});
