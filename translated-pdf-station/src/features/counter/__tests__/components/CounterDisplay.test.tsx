/**
 * @file CounterDisplay.test.tsx
 * @description Component tests for <CounterDisplay />.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// --- Relative Imports ---
import { CounterDisplay } from '../../components/CounterDisplay';

// =================================================================================================
// Tests
// =================================================================================================

describe('<CounterDisplay />', () => {
  it('renders the current value', () => {
    render(<CounterDisplay value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('updates when value changes', () => {
    const { rerender } = render(<CounterDisplay value={1} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    rerender(<CounterDisplay value={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
