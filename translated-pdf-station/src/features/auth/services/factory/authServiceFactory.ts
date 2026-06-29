/**
 * @file authServiceFactory.ts
 * @description Picks the concrete Auth service implementation.
 *
 * Same strategy as `tasksServiceFactory`:
 *   - Always have the Mock impl available (demo / test default).
 *   - When the Supabase feature is present AND `serviceConfig.useMock`
 *     is false, return the Supabase impl instead.
 *
 * The supabase import + branch are bracketed by `@eikon:feature(supabase)`
 * markers so the CLI's `--no-supabase` strip collapses both the import
 * and the conditional. After stripping, the factory unconditionally
 * returns the Mock impl with no dangling references.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Absolute Imports ---
// --- Relative Imports ---

import { MockAuthService } from '../implementations/MockAuthService';
import type { IAuthService } from '../interfaces/IAuthService';
// =================================================================================================
// Factory
// =================================================================================================

class AuthServiceFactory {
  /**
   * Cached instance — the Mock impl is stateless across instances, but
   * the Supabase impl owns a network client; keep the singleton so
   * concurrent sign-ins don't open redundant sessions.
   */
  private instance: IAuthService | null = null;

  getAuthService(): IAuthService {
    if (this.instance) return this.instance;

this.instance = new MockAuthService();
    return this.instance;
  }

  /**
   * Test-only: drop the cached instance so the next `getAuthService()`
   * call returns a fresh impl.
   */
  __resetForTests(): void {
    this.instance = null;
  }
}

// =================================================================================================
// Exports
// =================================================================================================

export const authServiceFactory = new AuthServiceFactory();
export { AuthServiceFactory };
