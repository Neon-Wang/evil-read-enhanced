/**
 * @file test-utils.tsx
 * @description Shared helpers for component and integration tests.
 *
 * Tests should import `renderWithRouter` instead of @testing-library's bare
 * `render` whenever the unit under test uses react-router primitives — it
 * wires up a MemoryRouter and (optionally) the matching `Routes` tree so
 * tests don't repeat the boilerplate.
 *
 * The Proxy-based `supabaseMockTrap` is the canonical "the test should NOT
 * touch supabase" sentinel: any access throws, surfacing missing mocks
 * loudly instead of silently making a network call. Use it in `vi.mock`
 * calls at the top of any test file that transitively loads the store.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { type ReactElement, type ReactNode } from 'react';

// --- Third-party Libraries ---
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

// =================================================================================================
// Helpers
// =================================================================================================

interface RouterOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial entries for MemoryRouter (defaults to `['/']`). */
  routerEntries?: MemoryRouterProps['initialEntries'];
}

/**
 * Render a UI tree wrapped in MemoryRouter. The router context is what
 * makes `<Link>`, `<NavLink>`, `useNavigate`, `useParams`, etc. work in
 * tests; without it react-router throws synchronously on first render.
 */
function renderWithRouter(
  ui: ReactElement,
  { routerEntries = ['/'], ...options }: RouterOptions = {}
): ReturnType<typeof render> {
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={routerEntries}>{children}</MemoryRouter>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * A Proxy that throws on every property access. Use it as the `supabase`
 * export in `vi.mock('@/shared/supabase', ...)` so any accidental call into
 * the real client during a unit test produces an immediate, clearly-worded
 * error rather than a silent network attempt.
 *
 * Tests that legitimately want to assert on a Supabase call should pass a
 * real mock object instead.
 */
const supabaseMockTrap = new Proxy(
  {},
  {
    get() {
      throw new Error(
        '@/shared/supabase was accessed in a unit test — mock it explicitly.'
      );
    },
  }
);

// =================================================================================================
// Exports
// =================================================================================================

export { renderWithRouter, supabaseMockTrap };
