import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Mode-aware Vite config.
 *
 *   - Default (`pnpm build`, `pnpm dev`): the bundle is served from a
 *     real HTTP origin (Vite dev server, static host, Tauri's
 *     `tauri://localhost`), so absolute asset paths (`/assets/foo.js`)
 *     resolve correctly. Vite's built-in default for `base` is `/`, so
 *     web / desktop scaffolds don't need to declare it explicitly.
 *   - `--mode capacitor` (used by `pnpm cap:sync` upstream, mobile
 *     scaffolds only): the bundle is loaded from `file://` inside an
 *     iOS WKWebView / Android System WebView. Absolute paths fail
 *     there because there's no host to resolve them against —
 *     Capacitor expects relative URLs. Using `base: ''` (the empty
 *     string) tells Rollup to emit relative references so the same
 *     bundle works regardless of mount point. The whole `base:` line
 *     and its accompanying mode parameter are gated by
 *     `@eikon:variant(platform=mobile)` so non-mobile scaffolds drop
 *     them entirely (and fall through to Vite's `/` default).
 *
 * The Tauri shell uses default mode: in dev it points at the Vite dev
 * server (`devUrl`), in build it copies `dist/` into the bundle and
 * loads via `tauri://localhost` (which behaves like a real origin).
 */
// The `mode: _mode` alias is deliberate: when the
// `@eikon:variant(platform=mobile)` block below is stripped from a
// web / desktop scaffold, the parameter is left destructured but
// unused. The `_`-prefix opts out of `noUnusedParameters` (tsconfig)
// and `@typescript-eslint/no-unused-vars` (eslint.config.js)
// simultaneously — keep the prefix even if you reach for `mode`
// directly during local edits.
export default defineConfig(({ mode: _mode }) => ({
  plugins: [react(), tailwindcss()],
resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        /*
         * Vendor splitting. Each group is selected because it's either
         * large (motion / react-query / supabase), feature-toggleable
         * (i18n / supabase — may be stripped entirely), or benefits
         * from long-lived browser cache (react itself). TanStack Query
         * is baseline infrastructure here (not strippable) but still
         * gets its own chunk so the cache hit ratio across deploys
         * stays high.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/react-router')) return 'router';
          if (id.includes('node_modules/motion')) return 'motion';
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'react-query';
          }
          if (
            id.includes('node_modules/i18next') ||
            id.includes('node_modules/react-i18next')
          ) {
            return 'i18n';
          }
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (
            id.includes('node_modules/@radix-ui') ||
            id.includes('node_modules/sonner')
          ) {
            return 'ui-vendor';
          }
          if (
            /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?react\//.test(id) ||
            /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?react-dom\//.test(id) ||
            /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?scheduler\//.test(id)
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
  envPrefix: 'VITE_',
}));
