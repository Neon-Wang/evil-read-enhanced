/**
 * @file TaskDetailsPage.test.tsx
 * @description Page-level test for `/tasks/:id`.
 *
 * Two entry shapes are exercised: a cached entry (store already
 * populated → instant paint) and a cold deep link (store empty → page
 * falls back to `getTaskById`). The third case verifies the not-found
 * UI when the service resolves with `null`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { screen, waitFor } from '@testing-library/react';
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

const fixtureTask = {
  id: 'fx-1',
  title: 'Inspect the fixture',
  description: 'A detailed body for the details page test.',
  status: 'pending' as const,
  createdAt: new Date('2026-05-19T00:00:00Z').toISOString(),
};

vi.mock('../../services/tasksService', () => ({
  tasksService: {
    getTasks: vi.fn().mockResolvedValue([]),
    getTaskById: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

// --- Core-related Libraries (after vi.mock) ---
import { Route, Routes } from 'react-router-dom';

// --- Absolute Imports (after vi.mock) ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports (after vi.mock) ---
import { TaskDetailsPage } from '../../pages/TaskDetailsPage';
import { tasksService } from '../../services/tasksService';
import { tasksStore } from '../../store/tasksStore';

// =================================================================================================
// Helpers
// =================================================================================================

function renderAtId(id: string) {
  return renderWithRouter(
    <Routes>
      <Route path="/tasks/:id" element={<TaskDetailsPage />} />
    </Routes>,
    { routerEntries: [`/tasks/${id}`] }
  );
}

// =================================================================================================
// Tests
// =================================================================================================

describe('<TaskDetailsPage />', () => {
  beforeEach(() => {
    tasksStore.getState().reset();
    vi.mocked(tasksService.getTaskById).mockReset();
  });

  it('paints instantly when the task is already cached in the store', async () => {
    tasksStore.setState({ tasks: [fixtureTask], isInitialized: true });
    renderAtId('fx-1');
    expect(screen.getByText('Inspect the fixture')).toBeInTheDocument();
    expect(
      screen.getByText('A detailed body for the details page test.')
    ).toBeInTheDocument();
    expect(vi.mocked(tasksService.getTaskById)).not.toHaveBeenCalled();
  });

  it('falls back to getTaskById when the store is cold', async () => {
    vi.mocked(tasksService.getTaskById).mockResolvedValueOnce(fixtureTask);
    renderAtId('fx-1');
    expect(screen.getByText(/loading task/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Inspect the fixture')).toBeInTheDocument();
    });
    expect(vi.mocked(tasksService.getTaskById)).toHaveBeenCalledWith('fx-1');
  });

  it('renders the not-found state when the service resolves with null', async () => {
    vi.mocked(tasksService.getTaskById).mockResolvedValueOnce(null);
    renderAtId('missing-id');
    await waitFor(() => {
      expect(screen.getByText(/task not found/i)).toBeInTheDocument();
    });
  });
});
