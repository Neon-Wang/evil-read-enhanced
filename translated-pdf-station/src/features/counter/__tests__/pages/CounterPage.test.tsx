/**
 * @file CounterPage.test.tsx
 * @description Page-level render + interaction test for `/counter`.
 *
 * Covers the read-write loop: the page subscribes to `useCounterStore`,
 * renders the current value, and the three action buttons mutate it.
 * The store is reset in `beforeEach` so tests stay independent.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

// --- Absolute Imports ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports ---
import { CounterPage } from '../../pages/CounterPage';
import { useCounterStore } from '../../stores/counterStore';

// =================================================================================================
// Tests
// =================================================================================================

describe('<CounterPage />', () => {
  beforeEach(() => {
    useCounterStore.getState().reset();
  });

  it('renders the title and the initial current-value line', () => {
    renderWithRouter(<CounterPage />);
    expect(
      screen.getByRole('heading', { level: 3, name: /counter demo/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/current value: 0/i)).toBeInTheDocument();
  });

  it('increments when the Increment button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CounterPage />);
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText(/current value: 1/i)).toBeInTheDocument();
  });

  it('disables Decrement at zero and re-enables after an increment', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CounterPage />);
    const decrement = screen.getByRole('button', { name: /decrement/i });
    expect(decrement).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(decrement).toBeEnabled();
  });

  it('resets back to zero', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CounterPage />);
    await user.click(screen.getByRole('button', { name: /increment/i }));
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText(/current value: 2/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText(/current value: 0/i)).toBeInTheDocument();
  });
});
