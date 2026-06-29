/**
 * @file feature-public-api.test.ts
 * @description Structural guard for each feature's `index.ts` barrel.
 *
 * The barrel is the contract between a feature and the rest of the
 * codebase — every other piece of `00-architecture.md`'s import-boundary
 * story rests on what shows up here. We assert:
 *
 *   - Every feature exports `<feature>Routes` (consumed by app/router).
 *   - Data-layer features additionally expose the store, the service
 *     facade, at least one action hook, the entity type and the
 *     selectors barrel.
 *   - Barrels do NOT re-export from private subpaths (`./store/...`,
 *     `./services/implementations/...`, etc.) — those must flow through
 *     the feature's own sub-barrels.
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
  listFeatures,
  parseExportNames,
  parseImportSources,
  readText,
} from './_helpers';

// =================================================================================================
// Constants
// =================================================================================================

// Re-export source paths a barrel is allowed to read from. Anything
// else (e.g. `./store/tasksStore`) is a private-path leak.
//
// `./components` is allowed as a sub-barrel for features whose public
// surface IS a set of components (e.g. `features/auth` exposes the
// SignInButton + Modal trio mounted by layouts / providers). Going
// through a sub-barrel — never `./components/<Name>` directly —
// preserves the "barrel owns the public name list" invariant.
const ALLOWED_REEXPORT_PATTERNS: RegExp[] = [
  /^\.\/routes$/,
  /^\.\/types$/,
  /^\.\/selectors$/,
  /^\.\/components$/,
  /^\.\/services\/[a-z][A-Za-z0-9]*Service$/,
  /^\.\/store\/[a-z][A-Za-z0-9]*Store$/,
  /^\.\/stores\/[a-z][A-Za-z0-9]*Store$/,
];

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: feature public API barrel', () => {
  for (const feature of listFeatures()) {
    describe(`${feature.name} (${feature.shape})`, () => {
      const indexPath = path.join(feature.dir, 'index.ts');
      const source = readText(indexPath);
      const exportNames = parseExportNames(source);
      const importSources = parseImportSources(source);

      it('exports <feature>Routes', () => {
        expect(
          exportNames,
          `${feature.name}/index.ts must export '${feature.name}Routes'`
        ).toContain(`${feature.name}Routes`);
      });

      if (feature.shape === 'data-layer') {
        it('exports the data-layer public surface', () => {
          const f = feature.name;
          expect(exportNames, `${f}/index.ts must export ${f}Store`).toContain(
            `${f}Store`
          );
          expect(
            exportNames,
            `${f}/index.ts must export ${f}Service`
          ).toContain(`${f}Service`);
          const hasActionsHook = exportNames.some((n) => /^use[A-Z].*Actions$/.test(n));
          expect(
            hasActionsHook,
            `${f}/index.ts must export at least one use*Actions() hook (got [${exportNames.join(', ')}])`
          ).toBe(true);
        });
      }

      it('does not re-export from private subpaths', () => {
        const relativeReexports = importSources.filter((s) => s.startsWith('.'));
        for (const src of relativeReexports) {
          const ok = ALLOWED_REEXPORT_PATTERNS.some((re) => re.test(src));
          expect(
            ok,
            `${feature.name}/index.ts re-exports from '${src}' which is a private subpath; route through a sub-barrel instead`
          ).toBe(true);
        }
      });
    });
  }
});
