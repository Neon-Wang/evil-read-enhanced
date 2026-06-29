/**
 * @file feature-i18n-parity.test.ts
 * @description Structural guard for i18n key consistency.
 *
 * For every locale shipped under `src/shared/i18n/locales/<lng>/` and
 * every feature namespace under `src/features/<feature>/i18n/<lng>.json`,
 * the set of dotted leaf keys must be identical across locales. A
 * missing key surfaces as the literal key string in the UI, which is a
 * user-visible defect — `60-i18n.md` calls this out as a hard rule.
 *
 * i18n is baseline infrastructure (every scaffold ships it), so this
 * suite always runs.
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
  SHARED_ROOT,
  flattenKeys,
  isDir,
  isFile,
  listFeatures,
  readDir,
  readJSON,
  readText,
  walk,
} from './_helpers';

// =================================================================================================
// Helpers
// =================================================================================================

interface KeyBundle {
  locale: string;
  ns: string;
  source: string;
  keys: string[];
}

function diffKeys(a: KeyBundle, b: KeyBundle): { missingInB: string[]; missingInA: string[] } {
  const setA = new Set(a.keys);
  const setB = new Set(b.keys);
  return {
    missingInB: a.keys.filter((k) => !setB.has(k)),
    missingInA: b.keys.filter((k) => !setA.has(k)),
  };
}

// camelCase OR snake_case — both are AI-greppable. snake_case is permitted
// because enum values mirroring the data model (e.g. TaskStatus = 'in_progress')
// commonly feed `t(\`status.${task.status}\`)` style lookups.
const VALID_KEY_SEGMENT = /^[a-z][a-zA-Z0-9_]*$/;

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: i18n parity', () => {
  // --- shared common namespace ---
  describe('shared/i18n/locales/<lng>/common.json', () => {
    const localesDir = path.join(SHARED_ROOT, 'i18n', 'locales');
    const locales = readDir(localesDir).filter((l) => isDir(path.join(localesDir, l)));

    it('has at least one locale', () => {
      expect(locales.length).toBeGreaterThan(0);
    });

    it('every locale has a common.json file', () => {
      for (const lng of locales) {
        expect(
          isFile(path.join(localesDir, lng, 'common.json')),
          `Locale '${lng}' is missing common.json`
        ).toBe(true);
      }
    });

    it('every common.json shares the exact same key set', () => {
      const bundles: KeyBundle[] = locales.map((lng) => {
        const filePath = path.join(localesDir, lng, 'common.json');
        const json = readJSON<Record<string, unknown>>(filePath);
        return { locale: lng, ns: 'common', source: filePath, keys: flattenKeys(json) };
      });
      for (let i = 1; i < bundles.length; i++) {
        const { missingInA, missingInB } = diffKeys(bundles[0]!, bundles[i]!);
        expect(
          missingInA.length + missingInB.length,
          `common.json drift between '${bundles[0]!.locale}' and '${bundles[i]!.locale}':\n` +
            (missingInA.length ? `  missing in ${bundles[0]!.locale}: ${missingInA.join(', ')}\n` : '') +
            (missingInB.length ? `  missing in ${bundles[i]!.locale}: ${missingInB.join(', ')}` : '')
        ).toBe(0);
      }
    });
  });

  // --- app/shared callsite reachability ---
  //
  // The previous block proves every locale's `common.json` shares the same
  // key set; this block proves that every `t('nav.x')` (or other namespace-
  // less) callsite in `src/app/**` and `src/shared/**` actually resolves
  // against the shipping `common.json`. Without this assertion, adding a
  // new layout that calls `t('nav.menu')` without adding the key to
  // `common.json` produces a silent regression — the literal "nav.menu"
  // string leaks into screen readers / aria-labels.
  describe('app + shared callsites resolve against common.json', () => {
    const localesDir = path.join(SHARED_ROOT, 'i18n', 'locales');
    const enCommonPath = path.join(localesDir, 'en', 'common.json');
    if (!isFile(enCommonPath)) {
      it.skip('en/common.json missing — locale layout test cannot run', () => {});
      return;
    }
    const enKeys = new Set(
      flattenKeys(readJSON<Record<string, unknown>>(enCommonPath))
    );

    /**
     * Match `t('key')`, `t("key")`, `t(\`key\`)` callsites where `key`
     * does NOT contain a namespace separator (`:`). Multiline because
     * call sites often break the args across lines after the first
     * argument. We deliberately ignore the second argument: the
     * defaultValue option there is a fallback string, not an i18n key.
     */
    const T_CALL_RE = /\bt\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]/g;

    function collectCallsites(roots: string[]): Map<string, string[]> {
      const out = new Map<string, string[]>();
      for (const root of roots) {
        if (!isDir(root)) continue;
        const files = walk(root, { onlyFiles: true }).filter(
          (p) => p.endsWith('.ts') || p.endsWith('.tsx')
        );
        for (const file of files) {
          const text = readText(file);
          for (const m of text.matchAll(T_CALL_RE)) {
            const key = m[1]!;
            // Namespace-prefixed (e.g. `tasks:list.title`) keys belong to
            // a feature namespace; skip them — feature parity covers it.
            if (key.includes(':')) continue;
            const where = out.get(key) ?? [];
            where.push(file);
            out.set(key, where);
          }
        }
      }
      return out;
    }

    it('every nav.* / shared callsite key is present in en/common.json', () => {
      const callsites = collectCallsites([APP_ROOT, SHARED_ROOT]);
      const missing: string[] = [];
      for (const [key, files] of callsites) {
        if (enKeys.has(key)) continue;
        missing.push(`${key}  (used in: ${files.map((f) => path.relative(SHARED_ROOT, f).split(path.sep).join('/')).join(', ')})`);
      }
      expect(
        missing,
        `i18n keys referenced from src/app or src/shared but missing from en/common.json:\n  ${missing.join('\n  ')}`
      ).toEqual([]);
    });
  });

  // --- per-feature namespaces ---
  for (const feature of listFeatures()) {
    const i18nDir = path.join(feature.dir, 'i18n');
    if (!isDir(i18nDir)) continue;
    describe(`features/${feature.name}/i18n/`, () => {
      const files = readDir(i18nDir).filter((n) => n.endsWith('.json'));
      const locales = files.map((n) => n.replace(/\.json$/, ''));

      it('has en.json and zh.json (template default locales)', () => {
        expect(locales, `feature '${feature.name}' is missing one of [en, zh]`).toEqual(
          expect.arrayContaining(['en', 'zh'])
        );
      });

      it('every locale file shares the exact same key set', () => {
        const bundles: KeyBundle[] = files.map((fname) => {
          const filePath = path.join(i18nDir, fname);
          const json = readJSON<Record<string, unknown>>(filePath);
          return {
            locale: fname.replace(/\.json$/, ''),
            ns: feature.name,
            source: filePath,
            keys: flattenKeys(json),
          };
        });
        for (let i = 1; i < bundles.length; i++) {
          const { missingInA, missingInB } = diffKeys(bundles[0]!, bundles[i]!);
          expect(
            missingInA.length + missingInB.length,
            `${feature.name}/i18n drift between '${bundles[0]!.locale}' and '${bundles[i]!.locale}':\n` +
              (missingInA.length ? `  missing in ${bundles[0]!.locale}: ${missingInA.join(', ')}\n` : '') +
              (missingInB.length ? `  missing in ${bundles[i]!.locale}: ${missingInB.join(', ')}` : '')
          ).toBe(0);
        }
      });

      it('every key segment is camelCase or snake_case (no spaces, hyphens, or leading uppercase)', () => {
        for (const fname of files) {
          const filePath = path.join(i18nDir, fname);
          const json = readJSON<Record<string, unknown>>(filePath);
          const keys = flattenKeys(json);
          for (const k of keys) {
            for (const segment of k.split('.')) {
              expect(
                VALID_KEY_SEGMENT.test(segment),
                `${feature.name}/i18n/${fname}: key segment '${segment}' (in '${k}') must be camelCase or snake_case`
              ).toBe(true);
            }
          }
        }
      });
    });
  }
});
