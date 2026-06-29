/**
 * @file boundary-imports.test.ts
 * @description Re-asserts the import-boundary rules from `00-architecture.md`
 * at the test layer, independent of ESLint. Agents have been known to
 * silence ESLint rules; deleting a test is a more obvious red flag,
 * so this duplication is intentional.
 *
 * Rules enforced (each rule = one assertion sweep):
 *
 *   1. `src/features/A/**` MUST NOT import from `@/features/B/<deep>`
 *      or via a relative path that crosses feature folders.
 *   2. `src/shared/**` MUST NOT import anything from `@/features/**`.
 *   3. `src/app/**` MUST only import features via `@/features/<x>` or
 *      `@/features/<x>/routes` (the public surface).
 *   4. Feature internals MUST NOT import from `@/shared/<barrel-required>/<deep>` —
 *      they must go through the area's barrel.
 *   5. `src/styles/**` MUST NOT be imported by anything other than
 *      `src/main.tsx` (and even then only as a side-effect import).
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
  listSrcFiles,
  parseImportSources,
  readText,
  rel,
} from './_helpers';

// =================================================================================================
// Helpers
// =================================================================================================

const ALIAS_PREFIX = '@/';
const BARREL_REQUIRED_SHARED_AREAS = new Set(['theme', 'i18n', 'services', 'supabase']);

function classifyAbsolute(p: string): { kind: string; feature?: string; area?: string } | null {
  // p relative to src/ (forward slashes)
  if (p.startsWith('features/')) {
    const segs = p.split('/');
    return { kind: 'feature', feature: segs[1] };
  }
  if (p.startsWith('shared/')) {
    const segs = p.split('/');
    return { kind: 'shared', area: segs[1] };
  }
  if (p.startsWith('app/')) return { kind: 'app' };
  if (p.startsWith('styles/')) return { kind: 'styles' };
  return null;
}

/**
 * Resolve an import source string to a path relative to `src/`. Returns
 * `null` for external packages we don't care about.
 */
function resolveImport(sourceFile: string, importSource: string): string | null {
  if (importSource.startsWith(ALIAS_PREFIX)) {
    return importSource.slice(ALIAS_PREFIX.length);
  }
  if (importSource.startsWith('.')) {
    const dir = path.dirname(sourceFile);
    const abs = path.resolve(dir, importSource);
    const r = path.relative(SRC_ROOT, abs).split(path.sep).join('/');
    if (r.startsWith('..')) return null;
    return r;
  }
  return null; // external package
}

function classifyFile(p: string): { kind: string; feature?: string; area?: string } | null {
  return classifyAbsolute(path.relative(SRC_ROOT, p).split(path.sep).join('/'));
}

// =================================================================================================
// Tests
// =================================================================================================

describe('structure: import boundaries', () => {
  const files = listSrcFiles('.ts', '.tsx');

  it('Rule 1 — features must not import another feature via a deep path', () => {
    const failures: string[] = [];
    for (const f of files) {
      const fromInfo = classifyFile(f);
      if (fromInfo?.kind !== 'feature') continue;
      for (const src of parseImportSources(readText(f))) {
        const resolved = resolveImport(f, src);
        if (!resolved) continue;
        const toInfo = classifyAbsolute(resolved);
        if (toInfo?.kind !== 'feature') continue;
        if (toInfo.feature === fromInfo.feature) continue;
        // Cross-feature. Must be either `@/features/B` (barrel) or `@/features/B/routes`.
        const tail = resolved.slice(`features/${toInfo.feature}/`.length);
        const allowed = tail === '' || tail === 'index' || tail === 'routes';
        if (!allowed) {
          failures.push(
            `${rel(f)} imports '${src}' → resolved to '${resolved}'. Cross-feature imports must target '@/features/${toInfo.feature}' or '@/features/${toInfo.feature}/routes'.`
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('Rule 2 — shared/ must not import from features/', () => {
    const failures: string[] = [];
    for (const f of files) {
      const fromInfo = classifyFile(f);
      if (fromInfo?.kind !== 'shared') continue;
      for (const src of parseImportSources(readText(f))) {
        const resolved = resolveImport(f, src);
        if (!resolved) continue;
        const toInfo = classifyAbsolute(resolved);
        if (toInfo?.kind === 'feature') {
          failures.push(
            `${rel(f)} imports '${src}' → '${resolved}'. shared/ is leaf-level and must not depend on features/.`
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('Rule 3 — app/ may only consume features via barrel or routes', () => {
    const failures: string[] = [];
    for (const f of files) {
      const fromInfo = classifyFile(f);
      if (fromInfo?.kind !== 'app') continue;
      for (const src of parseImportSources(readText(f))) {
        const resolved = resolveImport(f, src);
        if (!resolved) continue;
        const toInfo = classifyAbsolute(resolved);
        if (toInfo?.kind !== 'feature') continue;
        const tail = resolved.slice(`features/${toInfo.feature}/`.length);
        const allowed = tail === '' || tail === 'index' || tail === 'routes';
        if (!allowed) {
          failures.push(
            `${rel(f)} imports '${src}' → '${resolved}'. app/ may only consume features via '@/features/<x>' or '@/features/<x>/routes'.`
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('Rule 4 — feature internals must use the shared/<area> barrel where required', () => {
    const failures: string[] = [];
    for (const f of files) {
      const fromInfo = classifyFile(f);
      if (fromInfo?.kind !== 'feature' && fromInfo?.kind !== 'app') continue;
      for (const src of parseImportSources(readText(f))) {
        const resolved = resolveImport(f, src);
        if (!resolved) continue;
        const toInfo = classifyAbsolute(resolved);
        if (toInfo?.kind !== 'shared') continue;
        if (!toInfo.area || !BARREL_REQUIRED_SHARED_AREAS.has(toInfo.area)) continue;
        const tail = resolved.slice(`shared/${toInfo.area}/`.length);
        // Allow either `@/shared/<area>` (resolves to `shared/<area>`, tail === '')
        // or `@/shared/<area>/index` (tail === 'index'). Everything else is a
        // private-path leak through the barrel.
        if (tail !== '' && tail !== 'index') {
          failures.push(
            `${rel(f)} imports '${src}' → '${resolved}'. shared/${toInfo.area} requires going through its barrel '@/shared/${toInfo.area}'.`
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('Rule 5 — only main.tsx may import from styles/', () => {
    const failures: string[] = [];
    for (const f of files) {
      const rel0 = path.relative(SRC_ROOT, f).split(path.sep).join('/');
      const isMainTsx = rel0 === 'main.tsx';
      for (const src of parseImportSources(readText(f))) {
        const resolved = resolveImport(f, src);
        if (!resolved) continue;
        if (!resolved.startsWith('styles/')) continue;
        if (isMainTsx) continue;
        failures.push(
          `${rel(f)} imports '${src}' → '${resolved}'. Only src/main.tsx may import from src/styles/ (side-effect import).`
        );
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  // Sentinel so test summaries report a positive expectation even when
  // all sweeps are empty. We deliberately do NOT pin REPO_ROOT to the
  // string `'template-react'` — that's the directory name in our monorepo
  // but a scaffolded user project renames it to whatever they typed.
  // SRC_ROOT must end with `src` regardless; REPO_ROOT just has to be
  // its parent.
  it('REPO_ROOT and SRC_ROOT resolved correctly', () => {
    expect(SRC_ROOT.replace(/\\/g, '/')).toMatch(/\/src$/);
    expect(SRC_ROOT.startsWith(REPO_ROOT)).toBe(true);
  });
});
