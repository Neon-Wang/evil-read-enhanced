/**
 * @file tasks.browser.test.tsx
 * @description Browser-mode smoke spec for the Tasks feature.
 *
 * Renders the same tree the integration test exercises, but against a
 * real Chromium via vitest's browser mode + Playwright provider. The
 * value over the happy-dom integration test:
 *   - Real CSS layout / hover / focus
 *   - Real keyboard, mouse, scroll
 *   - Catches things happy-dom silently ignores (focus traps, IME, etc.)
 *
 * Run with:
 *   pnpm test:browser:setup    # one-time Chromium download
 *   pnpm test:browser
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { Suspense } from 'react';

// --- Third-party Libraries ---
import { render } from '@testing-library/react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';

// =================================================================================================
// Module mocks (must be hoisted ABOVE imports of code-under-test)
// =================================================================================================

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get() {
        throw new Error('supabase touched in browser test — should never happen.');
      },
    }
  ),
}));

vi.mock('@/shared/services', () => ({
  serviceConfig: { useMock: true },
}));

// --- Relative Imports (after vi.mock) ---
import { tasksRoutes } from '@/features/tasks';
import { MockTasksService } from '@/features/tasks/services/implementations/MockTasksService';
import { tasksService } from '@/features/tasks/services/tasksService';
import { tasksStore } from '@/features/tasks/store/tasksStore';

// =================================================================================================
// Helpers
// =================================================================================================

function resetEverything(): void {
  tasksStore.getState().reset();
  if (tasksService instanceof MockTasksService) {
    tasksService.__resetForTests();
  }
}

function renderApp(initialPath: string): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Suspense fallback={null}>
        <Routes>{tasksRoutes}</Routes>
      </Suspense>
    </MemoryRouter>
  );
}

// =================================================================================================
// Tests
// =================================================================================================

describe('tasks (browser smoke)', () => {
  beforeEach(() => {
    resetEverything();
  });

  afterEach(() => {
    resetEverything();
  });

  it('renders the seed task list', async () => {
    renderApp('/tasks');
    await expect
      .element(page.getByText(/read the eikon readme/i))
      .toBeInTheDocument();
  });

  it('lets the user type a title and submits the form', async () => {
    renderApp('/tasks/new');
    const titleInput = page.getByLabelText(/title/i);
    await expect.element(titleInput).toBeInTheDocument();
    await userEvent.fill(titleInput, 'Created in a real browser');
    await userEvent.click(page.getByRole('button', { name: /create task/i }));
    await expect
      .element(page.getByText('Created in a real browser'))
      .toBeInTheDocument();
  });
});
