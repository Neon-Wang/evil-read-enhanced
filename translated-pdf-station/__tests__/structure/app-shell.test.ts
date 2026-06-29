/**
 * @file app-shell.test.ts
 * @description Structural guard for `src/app/` — the application shell.
 *
 * The shell is the only directory in `src/` that's allowed to import
 * a feature's `routes.tsx` / public barrel. We assert it has:
 *
 *   - `providers.tsx` (the React provider tree mounted in main.tsx)
 *   - `router.tsx` (the react-router configuration)
 *   - `layouts/RootLayout.tsx` (the dispatcher exported as `RootLayout`)
 *   - at least one `*RootLayout.tsx` sibling (a layout variant) that
 *     the dispatcher imports. In the unstripped template all four
 *     variants coexist; after CLI strip only one survives.
 *   - `app/pages/` (when present) only holds shell-owned PascalCase
 *     pages — business pages must belong to a feature.
 *   - No feature-flavoured subdirectories (`services/`, `store/`,
 *     `selectors/`, `hooks/`, `components/`) leak into `app/`.
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
  APP_ROOT,
  isDir,
  isFile,
  parseImportSources,
  readDir,
  readText,
} from './_helpers';

// =================================================================================================
// Constants
// =================================================================================================

const FORBIDDEN_APP_SUBDIRS = new Set([
  'services',
  'store',
  'stores',
  'selectors',
  'hooks',
  'components',
  'features',
]);

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: src/app/', () => {
  it('exists', () => {
    expect(isDir(APP_ROOT)).toBe(true);
  });

  it('has providers.tsx, router.tsx, layouts/RootLayout.tsx', () => {
    expect(isFile(path.join(APP_ROOT, 'providers.tsx'))).toBe(true);
    expect(isFile(path.join(APP_ROOT, 'router.tsx'))).toBe(true);
    expect(isFile(path.join(APP_ROOT, 'layouts', 'RootLayout.tsx'))).toBe(true);
  });

  it('layouts/ has at least one *RootLayout.tsx sibling that the dispatcher imports', () => {
    const layoutsDir = path.join(APP_ROOT, 'layouts');
    const siblings = readDir(layoutsDir).filter(
      (n) => n !== 'RootLayout.tsx' && /RootLayout\.tsx$/.test(n)
    );
    expect(
      siblings.length,
      'app/layouts/ must contain at least one *RootLayout.tsx sibling (e.g. StackedRootLayout.tsx)'
    ).toBeGreaterThan(0);

    const dispatcher = readText(path.join(layoutsDir, 'RootLayout.tsx'));
    const imports = parseImportSources(dispatcher);
    const importedSiblings = siblings.filter((n) => {
      const expected = './' + n.replace(/\.tsx$/, '');
      return imports.includes(expected);
    });
    expect(
      importedSiblings.length,
      `RootLayout.tsx dispatcher must import at least one sibling (siblings found on disk: ${siblings.join(', ')}; imports: ${imports.join(', ')})`
    ).toBeGreaterThan(0);
  });

  it('app/pages/ (if present) only holds PascalCase .tsx files', () => {
    const pagesDir = path.join(APP_ROOT, 'pages');
    if (!isDir(pagesDir)) return;
    for (const name of readDir(pagesDir)) {
      const full = path.join(pagesDir, name);
      if (!isFile(full)) {
        throw new Error(`app/pages/${name} should not be a directory; shell pages are leaf files`);
      }
      expect(
        /^[A-Z][A-Za-z0-9]*\.tsx$/.test(name),
        `app/pages/${name} must be PascalCase .tsx`
      ).toBe(true);
    }
  });

  it('app/ does not contain feature-flavoured subdirectories', () => {
    for (const name of readDir(APP_ROOT)) {
      const full = path.join(APP_ROOT, name);
      if (!isDir(full)) continue;
      expect(
        FORBIDDEN_APP_SUBDIRS.has(name),
        `app/${name}/ is a feature-flavoured directory; promote it into a feature under src/features/ instead`
      ).toBe(false);
    }
  });
});
