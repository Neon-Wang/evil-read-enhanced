/**
 * @file ToasterShowcasePage.test.tsx
 * @description Smoke render test for the toaster showcase route.
 *
 * Verifies that the position tabs and fire buttons are present.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// --- Absolute Imports ---
import { renderWithRouter } from '@test/test-utils';

// --- Relative Imports ---
import { ToasterShowcasePage } from '../../pages/ToasterShowcasePage';

// =================================================================================================
// Tests
// =================================================================================================

describe('<ToasterShowcasePage />', () => {
  it('renders the page heading and the fire buttons', () => {
    renderWithRouter(<ToasterShowcasePage />);
    expect(
      screen.getByRole('heading', { level: 2, name: /toast/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fire success/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fire error/i })).toBeInTheDocument();
  });

  it('exposes all four position tabs', () => {
    renderWithRouter(<ToasterShowcasePage />);
    for (const id of [
      'top-right',
      'top-center',
      'bottom-center',
      'bottom-right',
    ]) {
      expect(
        screen.getByRole('tab', { name: id }),
        `missing position tab '${id}'`
      ).toBeInTheDocument();
    }
  });
});
