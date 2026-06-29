/**
 * @file TaskCard.test.tsx
 * @description Component tests for <TaskCard />.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// --- Relative Imports ---
import { TaskCard } from '../../components/TaskCard';

import type { Task } from '../../types';

// =================================================================================================
// Fixtures
// =================================================================================================

const TASK: Task = {
  id: 'demo',
  title: 'Sample task',
  description: 'Sample description',
  status: 'in_progress',
  createdAt: new Date().toISOString(),
};

// =================================================================================================
// Tests
// =================================================================================================

describe('<TaskCard />', () => {
  it('renders title, description and a translated status badge', () => {
    render(<TaskCard task={TASK} />);
    expect(screen.getByText('Sample task')).toBeInTheDocument();
    expect(screen.getByText('Sample description')).toBeInTheDocument();
    // The test setup eagerly initialises i18next with the shipped `en`
    // bundle, so the translated string is the actual assertion target.
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('invokes onClick when activated', async () => {
    const onClick = vi.fn();
    render(<TaskCard task={TASK} onClick={onClick} />);
    await userEvent.click(screen.getByText('Sample task'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render the delete button when onDelete is omitted', () => {
    render(<TaskCard task={TASK} />);
    expect(
      screen.queryByRole('button', { name: /delete task/i })
    ).not.toBeInTheDocument();
  });

  it('renders the delete button when onDelete is supplied', () => {
    render(<TaskCard task={TASK} onDelete={() => {}} />);
    expect(
      screen.getByRole('button', { name: /delete task/i })
    ).toBeInTheDocument();
  });

  it('does not trigger onClick when the delete button is pressed', async () => {
    const onClick = vi.fn();
    const onDelete = vi.fn();
    render(<TaskCard task={TASK} onClick={onClick} onDelete={onDelete} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete task/i })
    );
    expect(onClick).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete only after the user confirms in the dialog', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<TaskCard task={TASK} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /delete task/i }));

    // Confirmation dialog should now be open with the task title woven
    // into the destructive prompt — the parent's mutation hasn't fired
    // yet.
    expect(
      screen.getByRole('dialog', { name: /delete this task\?/i })
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    // The dialog's destructive primary action is the only "Delete"
    // button inside the dialog (the trash icon button in the card
    // surface uses the localized aria-label "Delete task", not "Delete").
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: /^delete$/i })
    );

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete when the user cancels the confirmation', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<TaskCard task={TASK} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /delete task/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
