/**
 * @file _helpers.ts
 * @description Shared utilities for the structure-guard test suite.
 *
 * Centralises filesystem walking, feature discovery, import/export
 * extraction and feature-flag detection so each individual structure
 * test stays a thin set of assertions. These helpers deliberately
 * avoid importing module code (no `tsx` loader, no transitive React
 * import) — they read the source tree as text only, which keeps the
 * structure suite fast and immune to runtime failures in the modules
 * under test.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =================================================================================================
// Paths
// =================================================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url));
// __tests__/structure → __tests__ → <template-react root>
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const SRC_ROOT = path.join(REPO_ROOT, 'src');
export const FEATURES_ROOT = path.join(SRC_ROOT, 'features');
export const SHARED_ROOT = path.join(SRC_ROOT, 'shared');
export const APP_ROOT = path.join(SRC_ROOT, 'app');
export const STYLES_ROOT = path.join(SRC_ROOT, 'styles');
export const TESTS_ROOT = path.join(REPO_ROOT, '__tests__');
export const AGENT_ROOT = path.join(REPO_ROOT, '.agent');

// =================================================================================================
// Types
// =================================================================================================

export type FeatureShape = 'pure-client' | 'data-layer';

export interface FeatureInfo {
  name: string;
  dir: string;
  shape: FeatureShape;
}

// =================================================================================================
// Filesystem primitives
// =================================================================================================

export function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function readDir(p: string): string[] {
  if (!isDir(p)) return [];
  return fs.readdirSync(p).sort();
}

export function readText(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

export function readJSON<T = unknown>(p: string): T {
  return JSON.parse(readText(p)) as T;
}

export interface WalkOptions {
  onlyFiles?: boolean;
  skipDirs?: string[];
}

export function walk(dir: string, opts: WalkOptions = {}): string[] {
  const out: string[] = [];
  if (!isDir(dir)) return out;
  for (const name of readDir(dir)) {
    if (opts.skipDirs?.includes(name)) continue;
    const p = path.join(dir, name);
    if (isDir(p)) {
      if (!opts.onlyFiles) out.push(p);
      out.push(...walk(p, opts));
    } else {
      out.push(p);
    }
  }
  return out;
}

export function rel(p: string): string {
  return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

// =================================================================================================
// Feature discovery
// =================================================================================================

export function listFeatures(): FeatureInfo[] {
  if (!isDir(FEATURES_ROOT)) return [];
  return readDir(FEATURES_ROOT)
    .filter((name) => isDir(path.join(FEATURES_ROOT, name)))
    .map((name) => {
      const dir = path.join(FEATURES_ROOT, name);
      return { name, dir, shape: detectFeatureShape(dir) };
    });
}

export function detectFeatureShape(dir: string): FeatureShape {
  return isDir(path.join(dir, 'services')) ? 'data-layer' : 'pure-client';
}

// =================================================================================================
// Feature-strip detection (CLI flags)
// =================================================================================================

/**
 * Detects whether an optional template feature is present in the
 * current tree. Structure tests must wrap optional-feature assertions
 * (e.g. supabase shape) in `if (featureEnabled('supabase')) { … }` so a
 * CLI-stripped project still passes the suite.
 *
 * Note: TanStack Query and i18n were previously listed here as
 * strippable features. They're now baseline infrastructure (always
 * present in every scaffold), so they're intentionally absent from
 * this union — any test may import from `@tanstack/react-query` /
 * `react-i18next` without a feature gate.
 */
export function featureEnabled(name: 'supabase'): boolean {
  switch (name) {
    case 'supabase':
      return isDir(path.join(SHARED_ROOT, 'supabase'));
  }
}

// =================================================================================================
// JSON / i18n key flattening
// =================================================================================================

export function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return [prefix];
  }
  const out: string[] = [];
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    const child = (obj as Record<string, unknown>)[k];
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      out.push(...flattenKeys(child, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

// =================================================================================================
// Source text parsing (regex-only, no AST dependency)
// =================================================================================================

function stripComments(src: string): string {
  // Sufficient for our needs: drop block /* */ and line // comments.
  // Inside strings these patterns can false-fire; rare enough in our
  // source to ignore (a false positive would only relax extracted
  // export/import lists, which makes the asserts less strict, not
  // unsoundly stricter).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

export function parseExportNames(source: string): string[] {
  const names = new Set<string>();
  const noC = stripComments(source);

  for (const m of noC.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_]\w*)/g)) {
    if (m[1]) names.add(m[1]);
  }
  for (const m of noC.matchAll(
    /\bexport\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_]\w*)/g
  )) {
    if (m[1]) names.add(m[1]);
  }
  for (const m of noC.matchAll(/\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_]\w*)/g)) {
    if (m[1]) names.add(m[1]);
  }
  for (const m of noC.matchAll(/\bexport\s+interface\s+([A-Za-z_]\w*)/g)) {
    if (m[1]) names.add(m[1]);
  }
  for (const m of noC.matchAll(/\bexport\s+type\s+([A-Za-z_]\w*)/g)) {
    if (m[1]) names.add(m[1]);
  }
  for (const m of noC.matchAll(/\bexport\s+(?:const\s+)?enum\s+([A-Za-z_]\w*)/g)) {
    if (m[1]) names.add(m[1]);
  }
  for (const m of noC.matchAll(/\bexport\s*(?:type\s*)?\{([^}]+)\}/g)) {
    if (!m[1]) continue;
    for (const part of m[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '');
      const asIdx = cleaned.indexOf(' as ');
      const name = asIdx >= 0 ? cleaned.slice(asIdx + 4).trim() : cleaned;
      if (/^[A-Za-z_]\w*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

export function parseImportSources(source: string): string[] {
  const noC = stripComments(source);
  const out = new Set<string>();
  for (const m of noC.matchAll(/\bimport\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) {
    if (m[1]) out.add(m[1]);
  }
  for (const m of noC.matchAll(/\bexport\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}

// =================================================================================================
// Convenience: enumerate src files for boundary checks
// =================================================================================================

export function listSrcFiles(...exts: string[]): string[] {
  return walk(SRC_ROOT, { onlyFiles: true }).filter((p) =>
    exts.some((e) => p.endsWith(e))
  );
}
