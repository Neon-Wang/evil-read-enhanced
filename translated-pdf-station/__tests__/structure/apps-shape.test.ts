/**
 * @file apps-shape.test.ts
 * @description Structure guard for the platform-shell directories
 * (`apps/desktop` for Tauri 2, `apps/mobile` for Capacitor 6). The strip
 * pass in `create-eikon-react`'s CLI deletes the entire `apps/<shell>`
 * folder when it doesn't match the selected `--platform`, so this test
 * runs on the canonical `template-react` source tree (where both folders
 * exist) and on `--platform desktop` / `--platform mobile` scaffolded
 * projects (where exactly one of them exists).
 *
 * Every required file below is load-bearing for the shell's build:
 *   - `apps/desktop` files map onto `tauri build`'s expected layout.
 *   - `apps/mobile` files map onto `cap sync`'s expected layout.
 *
 * If a shell is missing one of these files the corresponding `pnpm
 * tauri:dev` / `pnpm cap:sync` script in the root `package.json` will
 * blow up at the user's shell prompt; we catch that drift here instead.
 *
 * The test is skipped (not failed) when neither shell directory exists,
 * which is the correct shape for `--platform web` projects.
 */

// =================================================================================================
// Imports
// =================================================================================================

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { exists, isDir, isFile, readDir, readJSON, REPO_ROOT } from './_helpers.js';

// =================================================================================================
// Configuration
// =================================================================================================

const APPS_ROOT = path.join(REPO_ROOT, 'apps');
const DESKTOP_ROOT = path.join(APPS_ROOT, 'desktop');
const MOBILE_ROOT = path.join(APPS_ROOT, 'mobile');

interface ShellSpec {
  /** Human-readable shell name (used in test titles). */
  name: 'desktop' | 'mobile';
  /** Absolute root of the shell. */
  root: string;
  /**
   * Files that MUST exist for this shell to build. Paths are relative
   * to the shell root; both POSIX-style and OS-native paths work
   * because we run them through `path.join` before checking.
   */
  files: string[];
  /** Directories the shell expects to exist (typically tooling outputs
   *  shadowed by .gitignore but with a checked-in placeholder file). */
  dirs?: string[];
}

const SHELLS: readonly ShellSpec[] = [
  {
    name: 'desktop',
    root: DESKTOP_ROOT,
    files: [
      'package.json',
      'README.md',
      'src-tauri/Cargo.toml',
      'src-tauri/tauri.conf.json',
      'src-tauri/build.rs',
      'src-tauri/src/main.rs',
      'src-tauri/src/lib.rs',
      'src-tauri/icons/README.md',
    ],
    dirs: ['src-tauri/icons'],
  },
  {
    name: 'mobile',
    root: MOBILE_ROOT,
    files: ['package.json', 'README.md', 'capacitor.config.ts'],
  },
];

// =================================================================================================
// Tests
// =================================================================================================

describe('apps/* shell structure', () => {
  it('apps/ either does not exist (web) or contains exactly the shells we know about', () => {
    if (!isDir(APPS_ROOT)) {
      // Web project (`--platform web`): apps/ is fully stripped. Nothing to assert.
      return;
    }
    // Anything other than `desktop` / `mobile` here means the strip pass
    // skipped a directory it should have removed, OR a new shell has
    // been added without updating this guard.
    const known = new Set<string>(SHELLS.map((s) => s.name));
    const entries = readDir(APPS_ROOT);
    for (const entry of entries) {
      expect(
        known.has(entry as ShellSpec['name']),
        `apps/${entry} is not a known shell — add it to apps-shape.test.ts ` +
          `or extend the strip pass in create-eikon-react/src/strip-features.ts`
      ).toBe(true);
    }
  });

  for (const shell of SHELLS) {
    describe(`apps/${shell.name}`, () => {
      const present = isDir(shell.root);

      it(
        present
          ? `is a directory (platform=${shell.name})`
          : `is absent (platform!=${shell.name})`,
        () => {
          // The shell is platform-conditional; both states are valid.
          // We just record which one we observed so the rest of the
          // assertions know whether to enforce the file list.
          expect(typeof present).toBe('boolean');
        }
      );

      if (!present) return;

      it.each(shell.files)('contains required file %s', (relPath) => {
        const abs = path.join(shell.root, ...relPath.split('/'));
        expect(
          isFile(abs),
          `expected file ${relPath} to exist under apps/${shell.name}`
        ).toBe(true);
      });

      if (shell.dirs) {
        it.each(shell.dirs)('contains required directory %s', (relPath) => {
          const abs = path.join(shell.root, ...relPath.split('/'));
          expect(
            isDir(abs),
            `expected directory ${relPath} to exist under apps/${shell.name}`
          ).toBe(true);
        });
      }

      it('package.json declares an "eikon.shell" marker so AI tooling can see it', () => {
        const pkg = readJSON<{ eikon?: { shell?: string } }>(
          path.join(shell.root, 'package.json')
        );
        expect(
          pkg.eikon?.shell,
          `apps/${shell.name}/package.json must include "eikon": { "shell": "${shell.name}" }`
        ).toBe(shell.name);
      });
    });
  }

  it('root pnpm-workspace.yaml resolves apps/* (or apps/ does not exist)', () => {
    const wsPath = path.join(REPO_ROOT, 'pnpm-workspace.yaml');
    if (isDir(APPS_ROOT)) {
      expect(exists(wsPath), 'apps/ exists but pnpm-workspace.yaml is missing').toBe(
        true
      );
      const ws = fs.readFileSync(wsPath, 'utf8');
      expect(ws).toMatch(/apps\/\*/);
    }
  });
});
