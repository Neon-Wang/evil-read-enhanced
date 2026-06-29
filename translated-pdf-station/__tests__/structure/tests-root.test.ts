/**
 * @file tests-root.test.ts
 * @description Structural guard for the workspace-level `__tests__/`
 * folder. The folder is the convention's signal for "tests that don't
 * belong to any one feature live here, in one of these sub-folders":
 *
 *   - structure/   ← this suite
 *   - app/         ← shell wiring tests (RootLayout, providers)
 *   - integration/ ← cross-feature flows (router + services + store)
 *   - eslint-rules/← unit tests for the local ESLint plugin
 *   - browser/     ← OPT-IN Playwright/browser-mode specs
 *
 * Loose `*.test.ts` files at the top of `__tests__/` defeat the
 * organisational signal; this test fails them.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import path from 'node:path';

// --- Third-party Libraries ---
import { describe, expect, it } from 'vitest';

// --- Relative Imports ---
import { TESTS_ROOT, isDir, isFile, readDir } from './_helpers';

// =================================================================================================
// Constants
// =================================================================================================

const REQUIRED_FILES = ['setup.ts', 'test-utils.tsx'];
const REQUIRED_DIRS = ['structure', 'app', 'integration', 'eslint-rules'];
const ALLOWED_LOOSE_FILES = new Set(REQUIRED_FILES);

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: __tests__/ root', () => {
  it('exists', () => {
    expect(isDir(TESTS_ROOT)).toBe(true);
  });

  it('has setup.ts and test-utils.tsx', () => {
    for (const f of REQUIRED_FILES) {
      expect(
        isFile(path.join(TESTS_ROOT, f)),
        `Missing required file __tests__/${f}`
      ).toBe(true);
    }
  });

  it('has every canonical sub-directory (structure/, app/, integration/, eslint-rules/)', () => {
    for (const d of REQUIRED_DIRS) {
      expect(
        isDir(path.join(TESTS_ROOT, d)),
        `Missing required directory __tests__/${d}/`
      ).toBe(true);
    }
  });

  it('does not contain loose .test.ts(x) files at the top level', () => {
    for (const name of readDir(TESTS_ROOT)) {
      const full = path.join(TESTS_ROOT, name);
      if (!isFile(full)) continue;
      if (ALLOWED_LOOSE_FILES.has(name)) continue;
      expect(
        /\.(test|spec)\.tsx?$/.test(name),
        `__tests__/${name} is a loose test file at the top level. Move it into one of __tests__/{${REQUIRED_DIRS.join(',')}}/.`
      ).toBe(false);
    }
  });
});
