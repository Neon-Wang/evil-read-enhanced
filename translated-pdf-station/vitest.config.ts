import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `@tests` (note: plural is reserved for vitest itself) targets the
      // workspace-level __tests__ folder so feature tests can import shared
      // helpers from one short path instead of climbing six levels of `..`.
      '@test': fileURLToPath(new URL('./__tests__', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Auto-retry flaky specs in CI only (transient integration waitFor
    // timeouts, platform-sensitive lint-rule probes). Locally retry
    // stays 0 so genuine failures surface immediately instead of being
    // masked. Applies here AND in the scaffolded project, since the CLI
    // template is synced from this config.
    retry: process.env.CI ? 2 : 0,
    environment: 'happy-dom',
    setupFiles: ['./__tests__/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      '__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    // Browser-mode specs live under __tests__/browser/ and run via
    // `pnpm test:browser` (vitest.browser.config.ts). They require a
    // real Chromium and explicit setup; default `pnpm test` skips them.
    exclude: ['__tests__/browser/**', 'node_modules', 'dist', '.preview-cache'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/**/types.ts',
      ],
    },
  },
});
