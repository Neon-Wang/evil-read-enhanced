/**
 * @file feature-shape.test.ts
 * @description Structural guard for every directory under `src/features/`.
 *
 * Two shapes are recognised (see `.agent/rules/00-architecture.md`):
 *
 *   - pure-client (e.g. `counter`): index.ts + routes.tsx + pages/ ;
 *     optional `stores/` (plural — multiple small zustand stores allowed),
 *     `components/`, `hooks/`, `i18n/`. NO `services/`, `selectors/`, or
 *     singular `store/`.
 *   - data-layer (e.g. `tasks`, `auth` — has `services/`):
 *     index.ts + routes.tsx + pages/ +
 *     `store/<feature>Store.ts` (singular — exactly ONE zustand store
 *     per feature) +
 *     `selectors/{basic,computed,actions,index}.ts` +
 *     `services/{interfaces/I<F>Service.ts, factory/<f>ServiceFactory.ts,
 *     <f>Service.ts, implementations/<X><F>Service.ts (>=1)}` + types.ts.
 *
 * The `store/` (singular) vs `stores/` (plural) split is intentional:
 * data-layer features always have exactly one store, and the convention
 * makes that visible in the directory shape. Both shapes are
 * allowlisted below; `_helpers.ts:listFeatures()` decides which shape
 * a given feature claims based on the presence of `services/`.
 *
 * A failure here means a feature's filesystem footprint diverged from
 * the contract and downstream consumers (selectors, app shell, service
 * factory) WILL silently break.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import path from 'node:path';

// --- Third-party Libraries ---
import { describe, expect, it } from 'vitest';

// --- Relative Imports ---
import { isDir, isFile, listFeatures, readDir } from './_helpers';

// =================================================================================================
// Constants
// =================================================================================================

const ALLOWED_TOP_LEVEL_DIRS = new Set([
  'components',
  'hooks',
  'i18n',
  'pages',
  'selectors',
  'services',
  'store',
  'stores',
  '__tests__',
]);

const ALLOWED_TOP_LEVEL_FILES = new Set(['index.ts', 'routes.tsx', 'types.ts']);

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: feature shape', () => {
  const features = listFeatures();

  it('discovers at least one feature', () => {
    expect(features.length).toBeGreaterThan(0);
  });

  for (const feature of features) {
    describe(`feature: ${feature.name} (${feature.shape})`, () => {
      it('has required barrel + routes + pages/', () => {
        expect(isFile(path.join(feature.dir, 'index.ts'))).toBe(true);
        expect(isFile(path.join(feature.dir, 'routes.tsx'))).toBe(true);
        expect(isDir(path.join(feature.dir, 'pages'))).toBe(true);
      });

      it('only uses allowlisted top-level entries', () => {
        for (const name of readDir(feature.dir)) {
          const full = path.join(feature.dir, name);
          if (isDir(full)) {
            expect(
              ALLOWED_TOP_LEVEL_DIRS.has(name),
              `Feature '${feature.name}' has unrecognised top-level directory '${name}' (allowed: ${[
                ...ALLOWED_TOP_LEVEL_DIRS,
              ].join(', ')}).`
            ).toBe(true);
          } else {
            expect(
              ALLOWED_TOP_LEVEL_FILES.has(name),
              `Feature '${feature.name}' has unrecognised top-level file '${name}' (allowed: ${[
                ...ALLOWED_TOP_LEVEL_FILES,
              ].join(', ')}).`
            ).toBe(true);
          }
        }
      });

      if (feature.shape === 'data-layer') {
        it('has the canonical data-layer subtree', () => {
          const f = feature.name;
          expect(isFile(path.join(feature.dir, 'types.ts'))).toBe(true);

          // store/
          expect(isFile(path.join(feature.dir, 'store', `${f}Store.ts`))).toBe(true);

          // selectors/
          const selectorsDir = path.join(feature.dir, 'selectors');
          expect(isDir(selectorsDir)).toBe(true);
          for (const required of ['basic.ts', 'computed.ts', 'actions.ts', 'index.ts']) {
            expect(
              isFile(path.join(selectorsDir, required)),
              `data-layer feature '${f}' is missing selectors/${required}`
            ).toBe(true);
          }

          // services/
          const servicesDir = path.join(feature.dir, 'services');
          expect(isDir(servicesDir)).toBe(true);
          expect(
            isFile(path.join(servicesDir, `${f}Service.ts`)),
            `data-layer feature '${f}' is missing services/${f}Service.ts (the public facade)`
          ).toBe(true);
          expect(
            isFile(path.join(servicesDir, 'factory', `${f}ServiceFactory.ts`)),
            `data-layer feature '${f}' is missing services/factory/${f}ServiceFactory.ts`
          ).toBe(true);
          const ifaceName =
            'I' + f.charAt(0).toUpperCase() + f.slice(1) + 'Service.ts';
          expect(
            isFile(path.join(servicesDir, 'interfaces', ifaceName)),
            `data-layer feature '${f}' is missing services/interfaces/${ifaceName}`
          ).toBe(true);

          // at least one implementation
          const implDir = path.join(servicesDir, 'implementations');
          expect(isDir(implDir)).toBe(true);
          const impls = readDir(implDir).filter(
            (n) => n.endsWith('Service.ts') && /^[A-Z]/.test(n)
          );
          expect(
            impls.length,
            `data-layer feature '${f}' must have at least one services/implementations/<X>${f.charAt(0).toUpperCase() + f.slice(1)}Service.ts`
          ).toBeGreaterThan(0);
        });
      } else {
        it('pure-client feature does not have a services/ tree', () => {
          expect(isDir(path.join(feature.dir, 'services'))).toBe(false);
          expect(isDir(path.join(feature.dir, 'store'))).toBe(false);
          expect(isDir(path.join(feature.dir, 'selectors'))).toBe(false);
        });
      }
    });
  }
});
