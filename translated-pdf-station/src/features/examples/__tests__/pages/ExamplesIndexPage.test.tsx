/**
 * @file ExamplesIndexPage.test.tsx
 * @description Tests for the examples shell: the overview landing page
 * (the index Outlet) and the persistent sidebar in ExamplesLayout.
 *
 * The examples feature moved from one long scroll-spied page to a
 * route-per-component shell, so these assert the overview surfaces the
 * dev hero + component links, and the layout sidebar links to both the
 * inline sub-pages and the standalone showcase routes.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

// --- Absolute Imports ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports ---
import { ExamplesIndexPage } from '../../pages/ExamplesIndexPage';
import { ExamplesLayout } from '../../pages/ExamplesLayout';

// =================================================================================================
// Tests
// =================================================================================================

describe('<ExamplesIndexPage /> (overview)', () => {
  it('renders the translated meta header', () => {
    renderWithRouter(<ExamplesIndexPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /component showcase/i })
    ).toBeInTheDocument();
  });

  it('links each component card to its own sub-page', () => {
    const { container } = renderWithRouter(<ExamplesIndexPage />);
    expect(container.querySelector('a[href="/examples/button"]')).toHaveAttribute(
      'href',
      '/examples/button'
    );
    expect(container.querySelector('a[href="/examples/table"]')).toHaveAttribute(
      'href',
      '/examples/table'
    );
  });
});

describe('<ExamplesLayout /> sidebar', () => {
  function renderLayout() {
    return renderWithRouter(
      <Routes>
        <Route path="/examples" element={<ExamplesLayout />}>
          <Route index element={<div>overview</div>} />
          <Route path="button" element={<div>button page</div>} />
        </Route>
      </Routes>,
      { routerEntries: ['/examples'] }
    );
  }

  function sidebarQueries() {
    return within(screen.getByRole('complementary', { name: /components/i }));
  }

  it('shows the dev-only notice once in the shell', () => {
    renderLayout();
    expect(screen.getByText(/dev only/i)).toBeInTheDocument();
  });

  it('navigates inline components to their route', () => {
    renderLayout();
    expect(sidebarQueries().getByRole('link', { name: 'Button' })).toHaveAttribute(
      'href',
      '/examples/button'
    );
  });

  it('links the standalone showcases too', () => {
    renderLayout();
    expect(
      screen.getAllByRole('link', { name: /toast/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: /performance/i }).length
    ).toBeGreaterThan(0);
  });

  it('lists the newly added primitives', () => {
    renderLayout();
    const sidebar = sidebarQueries();
    expect(sidebar.getByRole('link', { name: 'Progress' })).toHaveAttribute(
      'href',
      '/examples/progress'
    );
    expect(sidebar.getByRole('link', { name: 'Breadcrumb' })).toHaveAttribute(
      'href',
      '/examples/breadcrumb'
    );
    expect(sidebar.getByRole('link', { name: 'Keyboard' })).toHaveAttribute(
      'href',
      '/examples/kbd'
    );
  });

  it('filters the nav list as you type', () => {
    renderLayout();
    const sidebar = sidebarQueries();
    fireEvent.change(sidebar.getByRole('searchbox'), {
      target: { value: 'button' },
    });
    expect(sidebar.getByRole('link', { name: 'Button' })).toBeInTheDocument();
    expect(
      sidebar.queryByRole('link', { name: 'Table' })
    ).not.toBeInTheDocument();
  });

  it('renders standalone chrome and compact top navigation', () => {
    renderLayout();

    expect(
      screen.getByRole('link', { name: /back to app/i })
    ).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /basics/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Button' })[0]).toHaveAttribute(
      'href',
      '/examples/button'
    );
  });
});
