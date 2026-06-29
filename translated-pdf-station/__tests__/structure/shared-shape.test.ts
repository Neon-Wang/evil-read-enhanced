/**
 * @file shared-shape.test.ts
 * @description Structural guard for `src/shared/` — the cross-cutting
 * grab-bag that is the most common dumping ground when an agent does
 * not know where to put something. Here we hard-code the allowed
 * shape so the next "I'll just put it in shared/utils/" instinct
 * fails fast at test time.
 *
 * Allowed top-level subdirectories (whitelist):
 *
 *   - ui/         shadcn-style presentational primitives (kebab-case .tsx).
 *                 Flat directory — no nesting allowed.
 *   - lib/        pure utility functions (camelCase .ts)
 *   - hooks/      cross-cutting React hooks (camelCase .ts, must start with `use`)
 *   - stores/     genuinely cross-feature Zustand stores (camelCase .ts)
 *   - theme/      theme store + side-effects (camelCase .ts, requires index.ts barrel)
 *   - i18n/       i18n bootstrap + locales (requires index.ts barrel + locales/<lng>/<ns>.json)
 *   - services/   service config (requires index.ts barrel + config/serviceConfig.ts)
 *   - supabase/   Supabase client (CLI-strippable; requires @eikon:feature(supabase) file markers)
 *
 * Barrel policy: areas that present as "a coherent module" (theme,
 * i18n, services, supabase) require an `index.ts` barrel and external
 * callers must go through it. Flat collections (ui, lib, hooks,
 * stores) are imported file-by-file — the kebab/camelCase filename
 * already names the symbol the consumer wants.
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
  SHARED_ROOT,
  featureEnabled,
  isDir,
  isFile,
  parseExportNames,
  readDir,
  readText,
} from './_helpers';

// =================================================================================================
// Whitelists
// =================================================================================================

const ALLOWED_SHARED_DIRS = new Set([
  'ui',
  'lib',
  'hooks',
  'nav',
  'stores',
  'theme',
  'i18n',
  'services',
  'supabase',
]);

const BARREL_REQUIRED_DIRS = new Set([
  'theme',
  'i18n',
  'services',
  'supabase',
  'nav',
]);

/**
 * Subdirectories allowed inside `shared/ui/`. `shared/ui/` is otherwise
 * flat (shadcn lineage — one component per file). Anything else here
 * should stay at the `ui/` top level.
 */
const ALLOWED_UI_SUBDIRS = new Set<string>([]);

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: src/shared/', () => {
  it('exists', () => {
    expect(isDir(SHARED_ROOT)).toBe(true);
  });

  it('only contains whitelisted top-level subdirectories', () => {
    for (const name of readDir(SHARED_ROOT)) {
      const full = path.join(SHARED_ROOT, name);
      if (isDir(full)) {
        expect(
          ALLOWED_SHARED_DIRS.has(name),
          `shared/${name}/ is not in the allowed list (${[...ALLOWED_SHARED_DIRS].join(', ')}). If you really need a new shared area, update the whitelist in __tests__/structure/shared-shape.test.ts and explain why in the PR.`
        ).toBe(true);
      } else {
        // No loose files at the top of shared/.
        throw new Error(
          `shared/${name} is a loose file at the top of shared/; place it inside one of the whitelisted subdirectories.`
        );
      }
    }
  });

  it('areas that require a barrel have an index.ts', () => {
    for (const area of BARREL_REQUIRED_DIRS) {
      const areaDir = path.join(SHARED_ROOT, area);
      if (!isDir(areaDir)) continue;
      expect(
        isFile(path.join(areaDir, 'index.ts')),
        `shared/${area}/index.ts barrel is required (callers go through @/shared/${area})`
      ).toBe(true);
    }
  });

  // -----------------------------------------------------------------------------------------------
  // shared/ui — shadcn lineage
  // -----------------------------------------------------------------------------------------------

  describe.skipIf(!isDir(path.join(SHARED_ROOT, 'ui')))('shared/ui/', () => {
    const dir = path.join(SHARED_ROOT, 'ui');

    it('only contains kebab-case .tsx files (plus whitelisted subdirs)', () => {
      for (const name of readDir(dir)) {
        const full = path.join(dir, name);
        if (isDir(full)) {
          expect(
            ALLOWED_UI_SUBDIRS.has(name),
            `shared/ui/${name}/ is not in the allowed subdirectory list (${[...ALLOWED_UI_SUBDIRS].join(', ')}). shared/ui/ is otherwise flat (shadcn lineage); if you really need a nested area, update the whitelist in __tests__/structure/shared-shape.test.ts and explain why in the PR.`
          ).toBe(true);
          continue;
        }
        expect(
          name.endsWith('.tsx'),
          `shared/ui/${name} must be a .tsx file`
        ).toBe(true);
        const base = name.replace(/\.tsx$/, '');
        expect(
          KEBAB_CASE.test(base),
          `shared/ui/${name} must be kebab-case (shadcn convention)`
        ).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------------------------------
  // shared/lib — utility functions
  // -----------------------------------------------------------------------------------------------

  describe.skipIf(!isDir(path.join(SHARED_ROOT, 'lib')))('shared/lib/', () => {
    const dir = path.join(SHARED_ROOT, 'lib');

    it('only contains camelCase .ts files', () => {
      for (const name of readDir(dir)) {
        const full = path.join(dir, name);
        expect(
          isFile(full),
          `shared/lib/${name} should be a flat file, not a subdirectory`
        ).toBe(true);
        expect(name.endsWith('.ts'), `shared/lib/${name} must be a .ts file`).toBe(true);
        const base = name.replace(/\.ts$/, '');
        expect(
          CAMEL_CASE.test(base),
          `shared/lib/${name} must be camelCase`
        ).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------------------------------
  // shared/hooks — cross-cutting hooks
  // -----------------------------------------------------------------------------------------------

  describe.skipIf(!isDir(path.join(SHARED_ROOT, 'hooks')))('shared/hooks/', () => {
    const dir = path.join(SHARED_ROOT, 'hooks');

    it('only contains camelCase .ts files starting with `use`', () => {
      for (const name of readDir(dir)) {
        const full = path.join(dir, name);
        expect(isFile(full), `shared/hooks/${name} should be a flat file`).toBe(true);
        expect(name.endsWith('.ts'), `shared/hooks/${name} must be a .ts file`).toBe(true);
        const base = name.replace(/\.ts$/, '');
        expect(
          /^use[A-Z][A-Za-z0-9]*$/.test(base),
          `shared/hooks/${name} must be camelCase starting with 'use'`
        ).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------------------------------
  // shared/theme — barrel + themeStore
  // -----------------------------------------------------------------------------------------------

  describe.skipIf(!isDir(path.join(SHARED_ROOT, 'theme')))('shared/theme/', () => {
    const dir = path.join(SHARED_ROOT, 'theme');

    it('has index.ts barrel and themeStore.ts', () => {
      expect(isFile(path.join(dir, 'index.ts'))).toBe(true);
      expect(isFile(path.join(dir, 'themeStore.ts'))).toBe(true);
    });

    it('barrel re-exports themeStore symbols', () => {
      const barrel = readText(path.join(dir, 'index.ts'));
      const names = parseExportNames(barrel);
      expect(
        names,
        'shared/theme/index.ts must re-export useThemeStore'
      ).toContain('useThemeStore');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // shared/i18n — bootstrap + locales
  // -----------------------------------------------------------------------------------------------

  describe('shared/i18n/', () => {
    const dir = path.join(SHARED_ROOT, 'i18n');

    it('has index.ts and locales/ tree', () => {
      expect(isFile(path.join(dir, 'index.ts'))).toBe(true);
      expect(isDir(path.join(dir, 'locales'))).toBe(true);
    });

    it('every locale ships the same set of namespaces', () => {
      const localesDir = path.join(dir, 'locales');
      const locales = readDir(localesDir).filter((l) => isDir(path.join(localesDir, l)));
      expect(locales.length, 'shared/i18n/locales must contain at least one language').toBeGreaterThan(0);

      const nsSets = locales.map(
        (lng) =>
          new Set(
            readDir(path.join(localesDir, lng))
              .filter((n) => n.endsWith('.json'))
              .map((n) => n.replace(/\.json$/, ''))
          )
      );
      const reference = nsSets[0]!;
      for (let i = 1; i < nsSets.length; i++) {
        const current = nsSets[i]!;
        const missing = [...reference].filter((n) => !current.has(n));
        const extra = [...current].filter((n) => !reference.has(n));
        expect(
          missing.length + extra.length,
          `shared/i18n/locales/${locales[i]} differs from ${locales[0]}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`
        ).toBe(0);
      }
    });

    it('barrel exports loadNamespace', () => {
      const barrel = readText(path.join(dir, 'index.ts'));
      const names = parseExportNames(barrel);
      expect(
        names,
        'shared/i18n/index.ts must export loadNamespace (used by feature routes.tsx)'
      ).toContain('loadNamespace');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // shared/services — service config
  // -----------------------------------------------------------------------------------------------

  describe.skipIf(!isDir(path.join(SHARED_ROOT, 'services')))('shared/services/', () => {
    const dir = path.join(SHARED_ROOT, 'services');

    it('has index.ts barrel and config/serviceConfig.ts', () => {
      expect(isFile(path.join(dir, 'index.ts'))).toBe(true);
      expect(isFile(path.join(dir, 'config', 'serviceConfig.ts'))).toBe(true);
    });

    it('barrel exports serviceConfig', () => {
      const barrel = readText(path.join(dir, 'index.ts'));
      const names = parseExportNames(barrel);
      expect(
        names,
        'shared/services/index.ts must export serviceConfig (used by every feature service factory)'
      ).toContain('serviceConfig');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // shared/supabase — CLI-strippable Supabase client
  // -----------------------------------------------------------------------------------------------

  describe.skipIf(!featureEnabled('supabase'))('shared/supabase/', () => {
    const dir = path.join(SHARED_ROOT, 'supabase');

    it('has index.ts and client.ts', () => {
      expect(isFile(path.join(dir, 'index.ts'))).toBe(true);
      expect(isFile(path.join(dir, 'client.ts'))).toBe(true);
    });

    it('both files have @eikon:feature(supabase) file marker on the very first line', () => {
      for (const fname of ['index.ts', 'client.ts']) {
        const text = readText(path.join(dir, fname));
        const firstLine = text.split('\n')[0]!.trim();
        expect(
          firstLine,
          `shared/supabase/${fname} must start with '// @eikon:feature(supabase) file' marker so CLI --no-supabase strips it cleanly`
        ).toBe('// @eikon:feature(supabase) file');
      }
    });

    it('barrel re-exports supabase client', () => {
      const barrel = readText(path.join(dir, 'index.ts'));
      const names = parseExportNames(barrel);
      expect(names, 'shared/supabase/index.ts must export supabase').toContain(
        'supabase'
      );
    });
  });
});
