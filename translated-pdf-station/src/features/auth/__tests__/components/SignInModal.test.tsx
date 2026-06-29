/**
 * @file SignInModal.test.tsx
 * @description Component tests for <SignInModal />.
 *
 * SignInModal is fully controlled — these tests render it with local
 * React state (no store binding) so they isolate the UI behaviour
 * from authStore / authService internals.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Third-party Libraries ---
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// --- Relative Imports ---
import { SignInModal } from '../../components/SignInModal';
import { AuthMode } from '../../types';

import type { SignInSubmit } from '../../components/SignInModal';

// =================================================================================================
// Test harness
// =================================================================================================

/**
 * Light wrapper that owns open / mode state and forwards them as
 * props, so each test can interact with the modal without hand-
 * threading every prop in the render call.
 */
function Harness(props: {
  defaultOpen?: boolean;
  defaultMode?: typeof AuthMode.SIGN_IN | typeof AuthMode.SIGN_UP;
  onSubmit?: (out: SignInSubmit) => void | Promise<void>;
  onOAuth?: (provider: 'google' | 'github') => void | Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = React.useState(props.defaultOpen ?? true);
  const [mode, setMode] = React.useState(
    props.defaultMode ?? AuthMode.SIGN_IN
  );
  return (
    <SignInModal
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      onModeChange={setMode}
      isSubmitting={props.isSubmitting}
      error={props.error}
      onSubmit={props.onSubmit ?? (() => {})}
      onOAuth={props.onOAuth}
    />
  );
}

// =================================================================================================
// Tests
// =================================================================================================

describe('<SignInModal />', () => {
  it('renders the sign-in tab content by default', () => {
    render(<Harness />);
    expect(
      screen.getByRole('dialog', { name: /welcome back/i })
    ).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: /^sign in$/i })
    ).toBeInTheDocument();
  });

  it('switches to the sign-up tab and exposes a full-name field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('tab', { name: /sign up/i }));

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^sign up$/i })
    ).toBeInTheDocument();
  });

  it('validates that email + password are present before calling onSubmit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^sign in$/i,
      })
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/email/i);
  });

  it('calls onSubmit with sign-in payload when the form is filled', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^email$/i), 'me@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^sign in$/i,
      })
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      mode: AuthMode.SIGN_IN,
      payload: { email: 'me@example.com', password: 'hunter2' },
    });
  });

  it('calls onOAuth(google) when the Google button is pressed', async () => {
    const onOAuth = vi.fn();
    const user = userEvent.setup();
    render(<Harness onOAuth={onOAuth} />);
    await user.click(
      screen.getByRole('button', { name: /continue with google/i })
    );
    expect(onOAuth).toHaveBeenCalledWith('google');
  });

  it('renders an inline error message when error prop is set', () => {
    render(<Harness error="Invalid credentials" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i);
  });

  it('disables the submit button while submitting', () => {
    render(<Harness isSubmitting />);
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: /signing in/i })
    ).toBeDisabled();
  });
});
