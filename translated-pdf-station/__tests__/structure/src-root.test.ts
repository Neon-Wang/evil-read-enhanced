/**
 * @file src-root.test.ts
 * @description Structural guard for the immediate `src/` directory.
 *
 * `src/` should contain exactly three .ts/.tsx files (main.tsx,
 * App.tsx, vite-env.d.ts) and four directories (app/, features/,
 * shared/, styles/). Anything else — a `src/utils.ts`, a `src/api/`,
 * a `src/components/` — is an architectural smell that means the
 * agent skipped feature-first thinking. We fail loud here so the
 * regression is impossible to merge silently.
 *
 * We also assert that `main.tsx` side-effect-imports the styles
 * entry. Without that import the Tailwind build produces nothing,
 * which can take a confusing while to notice in dev.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import path from 'node:path';

// --- Third-party Libraries ---
import { describe, expect, it } from 'vitest';

// --- Relative Imports ---
import {
  SRC_ROOT,
  isDir,
  isFile,
  parseImportSources,
  readDir,
  readText,
} from './_helpers';

// =================================================================================================
// Constants
// =================================================================================================

const ALLOWED_SRC_FILES = new Set(['main.tsx', 'App.tsx', 'vite-env.d.ts']);
const ALLOWED_SRC_DIRS = new Set([
  'app',
  'features',
  'shared',
  'styles',
]);

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: src/ root', () => {
  it('contains exactly the allowed files + directories (no loose helpers, no surprise areas)', () => {
    for (const name of readDir(SRC_ROOT)) {
      const full = path.join(SRC_ROOT, name);
      if (isDir(full)) {
        expect(
          ALLOWED_SRC_DIRS.has(name),
          `src/${name}/ is unexpected. Allowed top-level src directories: ${[...ALLOWED_SRC_DIRS].join(', ')}`
        ).toBe(true);
      } else if (isFile(full)) {
        expect(
          ALLOWED_SRC_FILES.has(name),
          `src/${name} is a loose file at the top of src/. Allowed: ${[...ALLOWED_SRC_FILES].join(', ')}. Move helpers into src/shared/lib/ or src/features/<x>/.`
        ).toBe(true);
      }
    }
  });

  it('all required entrypoint files exist', () => {
    for (const f of ALLOWED_SRC_FILES) {
      expect(isFile(path.join(SRC_ROOT, f)), `Missing required file src/${f}`).toBe(
        true
      );
    }
  });

  it('main.tsx side-effect imports the Tailwind entry', () => {
    const main = readText(path.join(SRC_ROOT, 'main.tsx'));
    const imports = parseImportSources(main);
    expect(
      imports,
      "src/main.tsx must side-effect import the Tailwind entry: import '@/styles/index.css';"
    ).toContain('@/styles/index.css');
  });
});
