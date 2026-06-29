/**
 * @file TaskForm.test.tsx
 * @description Controlled-form interaction tests for <TaskForm />.
 *
 * Asserts the controlled props pattern: parent owns the values, the
 * form fires the change callbacks per keystroke, and submission goes
 * through `onSubmit` once with the correct `isSubmitting` interplay.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// --- Relative Imports ---
import { TaskForm } from '../../components/TaskForm';

// =================================================================================================
// Tests
// =================================================================================================

describe('<TaskForm />', () => {
  it('fires onTitleChange / onDescriptionChange per keystroke', async () => {
    const onTitleChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TaskForm
        title=""
        description=""
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
        onSubmit={() => {}}
      />
    );

    await user.type(screen.getByLabelText(/title/i), 'Hi');
    expect(onTitleChange).toHaveBeenCalledTimes(2);

    await user.type(screen.getByLabelText(/description/i), 'Yo');
    expect(onDescriptionChange).toHaveBeenCalledTimes(2);
  });

  it('calls onSubmit when the submit button is pressed', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskForm
        title="My task"
        description="…"
        onTitleChange={() => {}}
        onDescriptionChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByRole('button', { name: /create task/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('disables the controls and swaps the button label while submitting', () => {
    render(
      <TaskForm
        title="t"
        description=""
        onTitleChange={() => {}}
        onDescriptionChange={() => {}}
        onSubmit={() => {}}
        isSubmitting
      />
    );
    expect(screen.getByLabelText(/title/i)).toBeDisabled();
    expect(screen.getByLabelText(/description/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });
});
