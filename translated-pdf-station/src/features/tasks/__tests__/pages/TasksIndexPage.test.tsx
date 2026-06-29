/**
 * @file TasksIndexPage.test.tsx
 * @description Page-level render test for `/tasks` (list view).
 *
 * Mocks the public service facade so the page resolves instantly with
 * deterministic fixtures (no simulated latency, no Supabase). The store
 * is reset in beforeEach so each test sees the same initial state.
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

// vi.hoisted runs BEFORE the vi.mock factory below — letting us declare
// fixtures once and reuse them in both the factory and the assertions.
const { fixtures } = vi.hoisted(() => ({
  fixtures: [
    {
      id: 'fx-1',
      title: 'Fixture one',
      description: 'first',
      status: 'pending' as const,
      createdAt: new Date('2026-05-19T00:00:00Z').toISOString(),
    },
    {
      id: 'fx-2',
      title: 'Fixture two',
      description: 'second',
      status: 'completed' as const,
      createdAt: new Date('2026-05-19T01:00:00Z').toISOString(),
    },
  ],
}));

vi.mock('../../services/tasksService', () => ({
  tasksService: {
    getTasks: vi.fn().mockResolvedValue(fixtures),
    getTaskById: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

// --- Absolute Imports (after vi.mock) ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports (after vi.mock) ---
import { TasksIndexPage } from '../../pages/TasksIndexPage';
import { tasksStore } from '../../store/tasksStore';

// =================================================================================================
// Tests
// =================================================================================================

describe('<TasksIndexPage />', () => {
  beforeEach(() => {
    tasksStore.getState().reset();
  });

  it('shows a loading state before initialize resolves', () => {
    renderWithRouter(<TasksIndexPage />);
    expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
  });

  it('lists every task returned by the service after initialize resolves', async () => {
    renderWithRouter(<TasksIndexPage />);
    await waitFor(() => {
      expect(screen.getByText('Fixture one')).toBeInTheDocument();
      expect(screen.getByText('Fixture two')).toBeInTheDocument();
    });
  });

  it('renders the empty state when the service returns no tasks', async () => {
    const { tasksService } = await import('../../services/tasksService');
    vi.mocked(tasksService.getTasks).mockResolvedValueOnce([]);
    renderWithRouter(<TasksIndexPage />);
    await waitFor(() => {
      expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    });
  });
});
