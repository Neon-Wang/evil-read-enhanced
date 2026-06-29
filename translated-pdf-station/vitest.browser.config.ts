/**
 * @file vitest.browser.config.ts
 * @description Separate vitest config for browser-mode (e2e-ish) tests.
 *
 * Why a second file:
 *  - The default `vitest.config.ts` runs every test in happy-dom under
 *    Node, where it's fast (~10s for the whole suite) and has no
 *    external dependencies. Mixing browser-mode tests into the same
 *    config would force every `pnpm test` invocation to spawn a real
 *    Chromium and download it on first run.
 *  - This config opts in: it ONLY picks up files under
 *    `__tests__/browser/**` and runs them against a real Chromium via
 *    Playwright. Run with `pnpm test:browser`.
 *
 * Bootstrap:
 *  1. `pnpm test:browser:setup` — downloads the Chromium binary once.
 *  2. `pnpm test:browser`        — runs the smoke specs.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { fileURLToPath, URL } from 'node:url';

// --- Third-party Libraries ---
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// =================================================================================================
// Config
// =================================================================================================

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./__tests__', import.meta.url)),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/browser/**/*.{test,spec}.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    css: true,
  },
});
