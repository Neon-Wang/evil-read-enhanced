/**
 * @file TaskNewPage.test.tsx
 * @description Page-level test for `/tasks/new`.
 *
 * Verifies the form-controlled flow: user types into title/description,
 * submits, the service's `addTask` is invoked with the form values, and
 * the page navigates back to `/tasks` on success.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// =================================================================================================
// Module mocks
// =================================================================================================

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy({}, {
    get() {
      throw new Error('supabase touched in unit test — mock it explicitly.');
    },
  }),
}));

vi.mock('@/shared/services', () => ({
  serviceConfig: { useMock: true },
}));

vi.mock('../../services/tasksService', () => ({
  tasksService: {
    getTasks: vi.fn().mockResolvedValue([]),
    getTaskById: vi.fn(),
    addTask: vi.fn(async (input: { title: string; description?: string }) => ({
      id: 'new-1',
      title: input.title,
      description: input.description ?? '',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    })),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

// --- Core Libraries ---
import { useLocation } from 'react-router-dom';

// --- Absolute Imports (after vi.mock) ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports (after vi.mock) ---
import { TaskNewPage } from '../../pages/TaskNewPage';
import { tasksService } from '../../services/tasksService';
import { tasksStore } from '../../store/tasksStore';

// =================================================================================================
// Helpers
// =================================================================================================

/**
 * Tiny side-channel that exposes the current pathname in the DOM so
 * tests can assert navigation without spying on the router. Mounted
 * inside the rendered tree as a sibling to the page under test.
 */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="probe-path">{location.pathname}</div>;
}

// =================================================================================================
// Tests
// =================================================================================================

describe('<TaskNewPage />', () => {
  beforeEach(() => {
    tasksStore.getState().reset();
    vi.mocked(tasksService.addTask).mockClear();
  });

  it('renders the form with empty fields and a Create task button', () => {
    renderWithRouter(
      <>
        <TaskNewPage />
        <LocationProbe />
      </>,
      { routerEntries: ['/tasks/new'] }
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /create task/i })).toBeEnabled();
  });

  it('submits the typed values to the service and navigates to /tasks', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <TaskNewPage />
        <LocationProbe />
      </>,
      { routerEntries: ['/tasks/new'] }
    );

    await user.type(screen.getByLabelText(/title/i), 'New thing');
    await user.type(screen.getByLabelText(/description/i), 'Body text');
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(vi.mocked(tasksService.addTask)).toHaveBeenCalledWith({
        title: 'New thing',
        description: 'Body text',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/tasks');
    });
  });
});
