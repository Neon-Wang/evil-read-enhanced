/**
 * @file SignUpFormShowcase.test.tsx
 * @description Behavioural test for the react-hook-form + zod sign-up
 * demo: an empty submit surfaces the zod validation messages, and a fully
 * valid submission clears every error.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

// --- Absolute Imports ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports ---
import { SignUpFormShowcase } from '../../components/inline/SignUpFormShowcase';

// =================================================================================================
// Tests
// =================================================================================================

describe('<SignUpFormShowcase />', () => {
  it('surfaces zod validation messages on an empty submit', async () => {
    const user = userEvent.setup();
    renderWithRouter(<SignUpFormShowcase />);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/valid email address/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(
      screen.getByText(/must accept the terms to continue/i)
    ).toBeInTheDocument();
  });

  it('clears all errors once every field is valid', async () => {
    const user = userEvent.setup();
    renderWithRouter(<SignUpFormShowcase />);

    await user.type(screen.getByLabelText('Username'), 'jane_doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.click(screen.getByLabelText(/i accept the terms/i));

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(/passwords do not match/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/valid email address/i)
      ).not.toBeInTheDocument();
    });
  });
});
