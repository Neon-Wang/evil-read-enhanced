/**
 * @file setup.ts
 * @description Vitest setup file (registered via vitest.config).
 *
 * Adds jest-dom matchers, eagerly initialises i18next with every
 * shipped locale namespace pre-registered (so component tests that
 * render `useTranslation('tasks')` etc. don't have to wait on
 * dynamic imports nor suspend mid-test), and runs `cleanup()` after
 * every test so Testing Library doesn't leak DOM nodes between
 * cases.
 *
 * Production wires lazy namespaces through i18next-resources-to-backend;
 * we deliberately skip that here — `useSuspense: false` plus
 * synchronously-registered bundles keeps tests synchronous and
 * exempt from `act(...)` boilerplate around Suspense.
 *
 * Tests that need a different i18n state can call
 * `i18n.changeLanguage()` inside their own `beforeEach`. Tests that
 * don't care about i18n are unaffected — the init is a one-time,
 * no-network setup.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, vi } from 'vitest';

// =================================================================================================
// JSDOM polyfills
// =================================================================================================

/**
 * jsdom ships without `matchMedia`. Anything that probes the user's
 * preferred colour scheme — notably the shared theme store — would
 * crash on import otherwise. Always-`false` is the safest default: it
 * pins the resolved theme to `light` unless a test explicitly overrides
 * `window.matchMedia` to a different stub.
 */
if (
  typeof window !== 'undefined' &&
  typeof window.matchMedia !== 'function'
) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// =================================================================================================
// Bundle discovery
// =================================================================================================

/**
 * Eager glob — every locale JSON in the project is bundled into this
 * test setup at compile time, so no async resolver is needed. Each
 * key looks like:
 *
 *   /src/shared/i18n/locales/<lng>/common.json
 *   /src/features/<feature>/i18n/<lng>.json
 *
 * We normalise both shapes into `(lng, ns, bundle)` triples and feed
 * them straight to i18next via `resources`.
 */
type EagerBundleMap = Record<string, { default: Record<string, unknown> }>;

const sharedBundles = import.meta.glob(
  '/src/shared/i18n/locales/*/*.json',
  { eager: true }
) as EagerBundleMap;

const featureBundles = import.meta.glob(
  '/src/features/*/i18n/*.json',
  { eager: true }
) as EagerBundleMap;

function buildResources(): Record<string, Record<string, Record<string, unknown>>> {
  const resources: Record<
    string,
    Record<string, Record<string, unknown>>
  > = {};

  for (const [filePath, mod] of Object.entries(sharedBundles)) {
    const match = filePath.match(
      /\/src\/shared\/i18n\/locales\/([^/]+)\/([^/]+)\.json$/
    );
    if (!match) continue;
    const [, lng, ns] = match;
    resources[lng!] ??= {};
    resources[lng!]![ns!] = mod.default;
  }

  for (const [filePath, mod] of Object.entries(featureBundles)) {
    const match = filePath.match(
      /\/src\/features\/([^/]+)\/i18n\/([^/]+)\.json$/
    );
    if (!match) continue;
    const [, feature, lng] = match;
    resources[lng!] ??= {};
    // The namespace name IS the feature directory name.
    resources[lng!]![feature!] = mod.default;
  }

  return resources;
}

// =================================================================================================
// i18n bootstrap (sync)
// =================================================================================================

beforeAll(async () => {
  if (i18n.isInitialized) return;
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    defaultNS: 'common',
    fallbackNS: 'common',
    interpolation: { escapeValue: false },
    resources: buildResources(),
    // Tests stay synchronous: missing keys fall back to the key
    // string instead of suspending the render.
    react: { useSuspense: false },
  });
});

// =================================================================================================
// Hooks
// =================================================================================================

afterEach(() => {
  cleanup();
});
