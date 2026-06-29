/**
 * @file rules.test.ts
 * @description Smoke tests for the three local ESLint rules. Drives each
 * rule through the ESLint Linter with synthetic code and asserts the
 * expected `messageId` is produced (or absent) for known good/bad
 * fixtures. Heavy coverage of the rule logic itself lives implicitly
 * in `pnpm lint` over the real source tree.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import path from 'node:path';

// --- Third-party Libraries ---
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// --- Relative Imports ---
import plugin from '../../eslint-rules/index.js';

// =================================================================================================
// Helpers
// =================================================================================================

const linter = new Linter({ configType: 'flat' });

function isInsideCwd(filename: string): boolean {
  const relative = path.relative(process.cwd(), filename);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

/**
 * Resolve a fixture filename to a path under cwd so flat-config `files`
 * globs (which match cwd-relative) catch it. Tests pass plain basenames
 * or "src/..." style paths; we anchor them inside cwd.
 */
function makeFilename(name: string): string {
  if (path.isAbsolute(name)) {
    if (isInsideCwd(name)) {
      return name;
    }
    return path.join(process.cwd(), 'src', name.replace(/^[/\\]tmp[/\\]/, ''));
  }
  return path.join(process.cwd(), 'src', name);
}

function lint(
  code: string,
  filename: string,
  ruleName: string,
  ruleOptions: unknown = 'error'
) {
  return linter.verify(
    code,
    [
      {
        files: ['**/*.{ts,tsx,js,jsx}'],
        plugins: { eikon: plugin },
        languageOptions: {
          parser: tseslint.parser as unknown as Linter.Parser,
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
        },
        rules: { [`eikon/${ruleName}`]: ruleOptions as Linter.RuleEntry },
      },
    ],
    makeFilename(filename)
  );
}

// =================================================================================================
// Tests ? file-header-banner
// =================================================================================================

describe('eikon/file-header-banner', () => {
  it('passes with a complete banner', () => {
    const code = `/**
 * @file foo.ts
 * @description Long enough description text.
 */
export const x = 1;
`;
    expect(lint(code, '/tmp/foo.ts', 'file-header-banner')).toHaveLength(0);
  });

  it('fails when banner is missing', () => {
    const code = `export const x = 1;\n`;
    const msgs = lint(code, '/tmp/foo.ts', 'file-header-banner');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.messageId).toBe('missing');
  });

  it('fails when @file tag is missing', () => {
    const code = `/**
 * @description Long enough description text.
 */
export const x = 1;
`;
    const msgs = lint(code, '/tmp/foo.ts', 'file-header-banner');
    expect(msgs.some((m) => m.messageId === 'missingFileTag')).toBe(true);
  });

  it('fails when @description tag is missing', () => {
    const code = `/**
 * @file foo.ts
 */
export const x = 1;
`;
    const msgs = lint(code, '/tmp/foo.ts', 'file-header-banner');
    expect(msgs.some((m) => m.messageId === 'missingDescTag')).toBe(true);
  });

  it('tolerates leading line comments above the banner (eikon feature markers)', () => {
    const code = `// @eikon:feature(supabase) file
/**
 * @file client.ts
 * @description Long enough description text.
 */
export const x = 1;
`;
    expect(lint(code, '/tmp/client.ts', 'file-header-banner')).toHaveLength(0);
  });
});

// =================================================================================================
// Tests ? filename-matches-export
// =================================================================================================

describe('eikon/filename-matches-export', () => {
  it('passes when basename matches a verbatim export', () => {
    const code = `export const tasksStore = {};`;
    expect(lint(code, '/tmp/tasksStore.ts', 'filename-matches-export')).toHaveLength(0);
  });

  it('passes when basename matches via use-prefix (hook flavour)', () => {
    const code = `export const useThemeStore = () => {};`;
    expect(lint(code, '/tmp/themeStore.ts', 'filename-matches-export')).toHaveLength(0);
  });

  it('passes when basename matches via PascalCase (class flavour)', () => {
    const code = `export class MockTasksService {}`;
    expect(lint(code, '/tmp/MockTasksService.ts', 'filename-matches-export')).toHaveLength(0);
  });

  it('passes when basename matches via I-prefix (interface flavour)', () => {
    const code = `export interface ITasksService {}`;
    expect(lint(code, '/tmp/ITasksService.ts', 'filename-matches-export')).toHaveLength(0);
  });

  it('passes when basename (kebab-case) matches via PascalCase export', () => {
    const code = `export function ThemeToggle() { return null; }`;
    expect(
      lint(code, '/tmp/theme-toggle.tsx', 'filename-matches-export')
    ).toHaveLength(0);
  });

  it('fails when no export matches the basename family', () => {
    const code = `export const SOMETHING_ELSE = 1;`;
    const msgs = lint(code, '/tmp/tasksStore.ts', 'filename-matches-export');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.messageId).toBe('mismatch');
  });

  it('skips barrel filenames', () => {
    const code = `export { Anything } from './a';`;
    expect(lint(code, '/tmp/index.ts', 'filename-matches-export')).toHaveLength(0);
    expect(lint(code, '/tmp/routes.tsx', 'filename-matches-export')).toHaveLength(0);
    expect(lint(code, '/tmp/types.ts', 'filename-matches-export')).toHaveLength(0);
  });

  it('skips test / spec / config / d.ts files', () => {
    const code = `export const SOMETHING_ELSE = 1;`;
    expect(lint(code, '/tmp/foo.test.ts', 'filename-matches-export')).toHaveLength(0);
    expect(lint(code, '/tmp/foo.spec.ts', 'filename-matches-export')).toHaveLength(0);
    expect(lint(code, '/tmp/vite.config.ts', 'filename-matches-export')).toHaveLength(0);
    expect(lint(code, '/tmp/foo.d.ts', 'filename-matches-export')).toHaveLength(0);
  });

  it('skips files with no exports', () => {
    expect(lint(`const x = 1;`, '/tmp/foo.ts', 'filename-matches-export')).toHaveLength(0);
  });
});

// =================================================================================================
// Tests ? filename-case-by-path
// =================================================================================================

describe('eikon/filename-case-by-path', () => {
  const rules = {
    rules: [
      { glob: 'src/features/*/components/**/*.tsx', case: 'PascalCase' },
      { glob: 'src/features/*/{store,stores,selectors}/**/*.ts', case: 'camelCase' },
      { glob: 'src/shared/ui/**/*.tsx', case: 'kebab-case' },
    ],
  };

  it('passes PascalCase under components/', () => {
    const msgs = lint(
      'export const TaskCard = () => null;',
      `${process.cwd()}/src/features/tasks/components/TaskCard.tsx`,
      'filename-case-by-path',
      ['error', rules]
    );
    expect(msgs).toHaveLength(0);
  });

  it('fails when components/ file is not PascalCase', () => {
    const msgs = lint(
      'export const TaskCard = () => null;',
      `${process.cwd()}/src/features/tasks/components/taskCard.tsx`,
      'filename-case-by-path',
      ['error', rules]
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.messageId).toBe('wrongCase');
  });

  it('passes camelCase under store/', () => {
    const msgs = lint(
      'export const tasksStore = {};',
      `${process.cwd()}/src/features/tasks/store/tasksStore.ts`,
      'filename-case-by-path',
      ['error', rules]
    );
    expect(msgs).toHaveLength(0);
  });

  it('passes kebab-case under shared/ui/', () => {
    const msgs = lint(
      'export const Button = () => null;',
      `${process.cwd()}/src/shared/ui/theme-toggle.tsx`,
      'filename-case-by-path',
      ['error', rules]
    );
    expect(msgs).toHaveLength(0);
  });

  it('fails kebab-case violation in shared/ui/', () => {
    const msgs = lint(
      'export const Button = () => null;',
      `${process.cwd()}/src/shared/ui/ThemeToggle.tsx`,
      'filename-case-by-path',
      ['error', rules]
    );
    expect(msgs).toHaveLength(1);
  });

  it('no-ops when no glob matches', () => {
    const msgs = lint(
      'export const foo = 1;',
      `${process.cwd()}/src/some/other/path/Foo.ts`,
      'filename-case-by-path',
      ['error', rules]
    );
    expect(msgs).toHaveLength(0);
  });
});
