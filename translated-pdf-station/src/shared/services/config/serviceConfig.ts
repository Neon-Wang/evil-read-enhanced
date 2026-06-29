/**
 * @file serviceConfig.ts
 * @description Global service-layer toggle used by feature service factories.
 *
 * Reads Supabase env vars once at module load and exposes a single
 * `serviceConfig.useMock` flag. Feature factories pick their Mock or
 * Supabase implementation based on this flag; the rest of the codebase
 * should never reach into env directly.
 *
 * The Supabase-aware branch is wrapped in `@eikon:feature(supabase)`
 * markers so the CLI's `--no-supabase` strip collapses this to a
 * constant `true` (= "always mock"). No follow-up edits required in
 * consumer code.
 */

// =================================================================================================
// Types
// =================================================================================================

interface ServiceConfig {
  /**
   * When `true`, factories MUST return the in-memory Mock implementation.
   * When `false`, factories should return the real backend (Supabase) impl.
   */
  readonly useMock: boolean;
}

// =================================================================================================
// Resolution
// =================================================================================================

/**
 * Whether the Supabase env vars are populated. We treat *missing* env as
 * an implicit Mock mode so the demo "just works" with zero configuration.
 * Setting `VITE_USE_MOCK=true` forces Mock even when env is otherwise
 * complete (handy for screenshots / e2e tests).
 */
const useMock: boolean =
true;

// =================================================================================================
// Exports
// =================================================================================================

export const serviceConfig: ServiceConfig = Object.freeze({ useMock });
export type { ServiceConfig };
