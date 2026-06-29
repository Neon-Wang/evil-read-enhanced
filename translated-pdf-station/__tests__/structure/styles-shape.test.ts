/**
 * @file styles-shape.test.ts
 * @description Structural guard for `src/styles/` — the Tailwind v4
 * CSS-first entrypoint.
 *
 * The contract (per `20-tailwind-v4.md`):
 *   - The only `.css` file in the project lives at `src/styles/index.css`.
 *   - That file imports tailwindcss and declares its `@theme` block.
 *   - There is no `tailwind.config.{js,ts,cjs,mjs}` at the project root
 *     (a JS config would shadow the @theme CSS source of truth).
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
  REPO_ROOT,
  SRC_ROOT,
  STYLES_ROOT,
  isFile,
  readText,
  walk,
} from './_helpers';

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: src/styles/', () => {
  it('src/styles/index.css exists', () => {
    expect(isFile(path.join(STYLES_ROOT, 'index.css'))).toBe(true);
  });

  it('is the only .css file under src/', () => {
    const cssFiles = walk(SRC_ROOT, { onlyFiles: true }).filter((p) => p.endsWith('.css'));
    expect(
      cssFiles.map((p) => path.relative(SRC_ROOT, p).split(path.sep).join('/')),
      'src/ must contain exactly one .css file (the Tailwind entry); split component styles into Tailwind utility classes instead'
    ).toEqual(['styles/index.css']);
  });

  it('imports tailwindcss and declares @theme', () => {
    const css = readText(path.join(STYLES_ROOT, 'index.css'));
    expect(
      /@import\s+['"]tailwindcss['"]/.test(css),
      "src/styles/index.css must include `@import 'tailwindcss';`"
    ).toBe(true);
    expect(
      /@theme\b/.test(css),
      'src/styles/index.css must declare a `@theme` block (Tailwind v4 CSS-first config)'
    ).toBe(true);
  });

  it('does not have a tailwind.config.* file (CSS-first only)', () => {
    for (const ext of ['js', 'ts', 'cjs', 'mjs']) {
      const cfg = path.join(REPO_ROOT, `tailwind.config.${ext}`);
      expect(
        isFile(cfg),
        `tailwind.config.${ext} is forbidden — this template is Tailwind v4 CSS-first; move tokens into src/styles/index.css under @theme`
      ).toBe(false);
    }
  });
});
