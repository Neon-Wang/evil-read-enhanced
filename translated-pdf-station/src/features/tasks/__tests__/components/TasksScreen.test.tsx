/**
 * @file TasksScreen.test.tsx
 * @description Component test for the shared Tasks page shell.
 *
 * Confirms the title/action button render, the Mock/Supabase banner
 * picks the right label from `serviceConfig`, and children are placed
 * inside the content slot.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// =================================================================================================
// Module mocks
// =================================================================================================

vi.mock('@/shared/services', () => ({
  serviceConfig: { useMock: true },
}));

// --- Relative Imports (after vi.mock) ---
import { TasksScreen } from '../../components/TasksScreen';

// =================================================================================================
// Tests
// =================================================================================================

describe('<TasksScreen />', () => {
  it('renders title, action button, mock-mode badge and children', () => {
    render(
      <TasksScreen title="Tasks" actionLabel="New task" onAction={() => {}}>
        <p>child slot</p>
      </TasksScreen>
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tasks' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByText(/service mode:/i)).toBeInTheDocument();
    expect(screen.getByText('Mock')).toBeInTheDocument();
    expect(screen.getByText('child slot')).toBeInTheDocument();
  });

  it('invokes the action callback when the pill button is clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <TasksScreen title="Tasks" actionLabel="Go" onAction={onAction}>
        <p />
      </TasksScreen>
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
