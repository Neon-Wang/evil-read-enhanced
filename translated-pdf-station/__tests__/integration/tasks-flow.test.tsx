/**
 * @file tasks-flow.test.tsx
 * @description End-to-end-ish integration test for the Tasks feature.
 *
 * Crosses every layer of the swappable-backend pattern: router →
 * page → selectors → store → service facade → real MockTasksService.
 * The only boundary mocked is `@/shared/supabase` (so importing the
 * Supabase impl in a Node test never touches the real client) and
 * `serviceConfig.useMock` (forced to `true` so the factory picks the
 * Mock implementation regardless of env vars).
 *
 * The flow under test:
 *   1. Open `/tasks` → seed tasks render.
 *   2. Click "New task" → navigate to `/tasks/new`.
 *   3. Fill the form, submit → the new task appears at the top of `/tasks`.
 *   4. Click the new card → details page shows the right title.
 *
 * Lives at the top level because it crosses the boundary between the
 * router (in `src/app/`) and the `tasks` feature.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { Suspense } from 'react';

// --- Third-party Libraries ---
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =================================================================================================
// Module mocks
// =================================================================================================

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy({}, {
    get() {
      throw new Error('supabase touched in integration test — should never happen.');
    },
  }),
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

// The singleton service is created once at module-load. Reset BOTH:
//   - the store (UI cache),
//   - the underlying MockTasksService's mutable list (source of truth).
function resetEverything() {
  tasksStore.getState().reset();
  if (tasksService instanceof MockTasksService) {
    tasksService.__resetForTests();
  }
}

function renderApp(initialPath = '/tasks') {
  // Pages are lazy()-loaded — the production Suspense boundary lives in
  // RootLayout. We provide an equivalent one here so React can resolve
  // the chunks during the test.
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Suspense fallback={<div data-testid="route-fallback" />}>
        <Routes>{tasksRoutes}</Routes>
      </Suspense>
    </MemoryRouter>
  );
}

// =================================================================================================
// Tests
// =================================================================================================

// Generous timeout — lazy() chunk resolution + i18n bundle loading can
// be slow on cold-cache CI machines. Local runs typically finish in well
// under a second; we leave headroom for the e2e harness, which exercises
// this same test inside a freshly-scaffolded sandbox directory.
//
// 20s (not 10s): at 10s this intermittently timed out in CI's e2e step
// under parallel load — the lazy chunk + first render occasionally
// crossed the line. Doubling the budget removes the flake while still
// failing fast enough if the route genuinely never renders. The
// per-test timeout below is derived as SLOW_TIMEOUT * 3.
const SLOW_TIMEOUT = 20_000;

describe('Tasks feature — end-to-end flow', () => {
  beforeEach(() => {
    resetEverything();
  });

  afterEach(() => {
    resetEverything();
  });

  it(
    'lists the seed tasks on /tasks',
    async () => {
      renderApp('/tasks');
      await waitFor(
        () => {
          expect(
            screen.getByText(/read the eikon readme/i)
          ).toBeInTheDocument();
        },
        { timeout: SLOW_TIMEOUT }
      );
    },
    SLOW_TIMEOUT * 3
  );

  it(
    'creates a task and shows it in the list + details flow',
    async () => {
      const user = userEvent.setup();
      renderApp('/tasks/new');

      // Wait for the lazy chunk to load before interacting with the form.
      const titleInput = await screen.findByLabelText(/title/i, undefined, {
        timeout: SLOW_TIMEOUT,
      });

      await user.type(titleInput, 'Integration test entry');
      await user.type(
        screen.getByLabelText(/description/i),
        'Body created by integration test'
      );
      await user.click(screen.getByRole('button', { name: /create task/i }));

      // After submit we navigate back to /tasks; the new task should
      // appear at the top of the list (newest-first).
      await waitFor(
        () => {
          expect(
            screen.getByText('Integration test entry')
          ).toBeInTheDocument();
        },
        { timeout: SLOW_TIMEOUT }
      );

      // The card click navigates to /tasks/:id; the details page
      // headline contains the task title.
      await user.click(screen.getByText('Integration test entry'));
      await waitFor(
        () => {
          expect(
            screen.getByText('Body created by integration test')
          ).toBeInTheDocument();
        },
        { timeout: SLOW_TIMEOUT }
      );
    },
    SLOW_TIMEOUT * 3
  );
});
