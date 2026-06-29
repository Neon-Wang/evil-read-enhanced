/**
 * @file HomePage.test.tsx
 * @description Smoke render test for the home page. Asserts the headline
 * comes from i18n (not a hard-coded string) and the CTA links into the
 * counter route.
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
import { HomePage } from '../../pages/HomePage';

// =================================================================================================
// Tests
// =================================================================================================

describe('<HomePage />', () => {
  it('renders the translated headline and subtitle', () => {
    renderWithRouter(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /welcome to eikon app/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/an ai-agent-friendly react starter/i)
    ).toBeInTheDocument();
  });

  it('links the primary CTA to /counter', () => {
    renderWithRouter(<HomePage />);
    const cta = screen.getByRole('link', { name: /get started/i });
    expect(cta).toHaveAttribute('href', '/counter');
  });

  it('renders the three feature cards', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText(/feature-first/i)).toBeInTheDocument();
    expect(screen.getByText(/\.agent protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/modern tooling/i)).toBeInTheDocument();
  });

  it('renders the dev-only examples entry area', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText(/development preview/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse component showcase/i })
    ).toHaveAttribute('href', '/examples');
  });
});
