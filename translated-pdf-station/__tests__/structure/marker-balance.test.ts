/**
 * @file marker-balance.test.ts
 * @description Walks every variant-bearing source file (`*.{ts,tsx,css,html}`
 * under `src/` plus the repo-root `index.html`) and asserts that
 * `@eikon:variant(<axis>=<value>) begin` and `@eikon:variant(<axis>=<value>) end`
 * markers come in matched pairs **per `(axis=value)` tuple per file**.
 *
 * The strip pipeline relies on this invariant: an unmatched `begin` would
 * delete everything to end-of-file (or worse, swallow the next variant's
 * block); an unmatched `end` would leave dead text hanging after the strip.
 * Either failure mode produces silently-broken scaffolds, which is exactly
 * the kind of regression a structural test is for.
 *
 * "File" markers (`// @eikon:variant(...) file`) are NOT pair markers —
 * they tag the entire file as conditional. They're recognised separately
 * and must NOT count toward begin/end balance.
 */

// =================================================================================================
// Imports
// =================================================================================================

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT, SRC_ROOT } from './_helpers.js';

// =================================================================================================
// Constants
// =================================================================================================

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html']);

const ROOT_HTMLS = ['index.html'];

// `@eikon:variant(axis=value) begin` / `end` — capture the tuple and the
// kind. We tolerate `axis` being a single word and `value` containing
// hyphens/digits (matches the production marker grammar). The trailing
// keyword is `begin`, `end`, or `file`; `file` is recognised so we can
// skip it without mis-classifying it as `begin`.
const MARKER_RE = /@eikon:variant\(([A-Za-z][\w]*)=([A-Za-z0-9][\w-]*)\)\s+(begin|end|file)\b/g;

// =================================================================================================
// Helpers
// =================================================================================================

function walk(root: string, acc: string[]): void {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walk(abs, acc);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (TARGET_EXTENSIONS.has(ext)) acc.push(abs);
    }
  }
}

interface Counts {
  begin: number;
  end: number;
}

function tallyMarkers(source: string): Map<string, Counts> {
  const out = new Map<string, Counts>();
  for (const m of source.matchAll(MARKER_RE)) {
    const [, axis, value, kind] = m;
    if (kind === 'file') continue;
    const key = `${axis}=${value}`;
    const counts = out.get(key) ?? { begin: 0, end: 0 };
    if (kind === 'begin') counts.begin += 1;
    else counts.end += 1;
    out.set(key, counts);
  }
  return out;
}

// =================================================================================================
// Tests
// =================================================================================================

describe('variant marker balance', () => {
  const files: string[] = [];
  walk(SRC_ROOT, files);
  for (const html of ROOT_HTMLS) {
    const abs = path.join(REPO_ROOT, html);
    if (fs.existsSync(abs)) files.push(abs);
  }

  // Sanity: the suite would silently pass if `walk` returned empty.
  it('finds at least one variant-bearing source file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s — every (axis=value) tuple has matched begin/end', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    const tallies = tallyMarkers(source);
    for (const [key, counts] of tallies) {
      expect(
        counts.begin,
        `${path.relative(REPO_ROOT, file)}: marker (${key}) — ` +
          `${counts.begin} \`begin\` vs ${counts.end} \`end\``
      ).toBe(counts.end);
    }
  });
});
