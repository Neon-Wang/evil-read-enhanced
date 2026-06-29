/**
 * @file RootLayout.test.tsx
 * @description Layout-agnostic smoke test for the app shell. Asserts
 * only the contract that's true for **every** RootLayout variant:
 *
 *   1. The shell mounts without throwing.
 *   2. The brand link points at `/`.
 *   3. The matched child route renders via `<Outlet />`.
 *
 * Anything layout-specific — always-visible nav links (stacked /
 * sidebar / topbar-sidebar / centered), drawer-gated nav (mobile-
 * drawer), bottom-tab nav (bottom-tabs / bottom-tabs-fab), active-
 * link styling, footer chrome — lives in the per-layout test
 * (`__tests__/app/<Layout>RootLayout.test.tsx`). Keeping THIS file
 * dispatcher-shaped means the same test passes on every scaffolded
 * project regardless of which layout the user picked, which is the
 * correct contract for a `__tests__/app/RootLayout.test.tsx` smoke
 * suite that ships in every scaffold.
 *
 * Lives at the top level because RootLayout is in `src/app/` (the
 * application shell, not a feature) and the test crosses the
 * boundary between routes and the layout dispatcher.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// =================================================================================================
// Module mocks (must be hoisted ABOVE imports of code-under-test)
// =================================================================================================
//
// Every layout now renders <SignInButton /> from `@/features/auth`,
// which transitively imports `@/shared/supabase` via the auth service
// factory. The real supabase client constructs a Realtime client at
// module load that needs a `WebSocket` global — happy-dom doesn't
// provide one, so the import would crash before the layout renders.

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get() {
        throw new Error(
          '@/shared/supabase was accessed in a layout test — mock it explicitly.'
        );
      },
    }
  ),
}));

// --- Absolute Imports ---
import { LayoutVariantProvider } from '@/app/LayoutVariantProvider';
import { RootLayout } from '@/app/layouts/RootLayout';

// =================================================================================================
// Helpers
// =================================================================================================

function renderShell(initialPath = '/') {
  return render(
    <LayoutVariantProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<RootLayout />}>
          <Route path="/" element={<p>home page</p>} />
          <Route path="/counter" element={<p>counter page</p>} />
          <Route path="/tasks" element={<p>tasks page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LayoutVariantProvider>
  );
}

// =================================================================================================
// Tests
// =================================================================================================

describe('<RootLayout />', () => {
  it('renders the brand link pointing at /', () => {
    renderShell();
    // Every layout variant exposes the brand mark in its always-visible
    // header — even mobile-drawer (the link sits next to the hamburger).
    expect(screen.getByRole('link', { name: /eikon app/i })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('renders the matched child via <Outlet />', () => {
    renderShell('/counter');
    expect(screen.getByText('counter page')).toBeInTheDocument();
  });

  it('mounts without throwing on every primary route', () => {
    // Smoke: each route renders its child. We don't probe nav-link
    // visibility here because nav is layout-specific.
    renderShell('/');
    expect(screen.getByText('home page')).toBeInTheDocument();
    renderShell('/counter');
    expect(screen.getByText('counter page')).toBeInTheDocument();
    renderShell('/tasks');
    expect(screen.getByText('tasks page')).toBeInTheDocument();
  });
});
