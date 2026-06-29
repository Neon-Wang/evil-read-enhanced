/**
 * @file helpers.test.ts
 * @description Unit tests for the local ESLint plugin helpers
 * (`glob-match`, `case`). These tests guard the building blocks the
 * three rules rely on — if `globMatch` mis-classifies a path the
 * casing rule can silently no-op, which would defeat the gate.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { describe, expect, it } from 'vitest';

// --- Relative Imports ---
import {
  camelCase,
  detectCase,
  isCamelCase,
  isKebabCase,
  isPascalCase,
  kebabCase,
  pascalCase,
} from '../../eslint-rules/lib/case.js';
import { globMatch, globToRegex } from '../../eslint-rules/lib/glob-match.js';

// =================================================================================================
// Tests — glob-match
// =================================================================================================

describe('globMatch', () => {
  it('matches literal segments', () => {
    expect(globMatch('src/main.tsx', 'src/main.tsx')).toBe(true);
    expect(globMatch('src/main.tsx', 'src/main.ts')).toBe(false);
  });

  it('single-star matches within one segment only', () => {
    expect(globMatch('src/features/*/index.ts', 'src/features/tasks/index.ts')).toBe(true);
    expect(
      globMatch('src/features/*/index.ts', 'src/features/tasks/sub/index.ts')
    ).toBe(false);
  });

  it('double-star matches zero or more path segments', () => {
    expect(globMatch('src/**/*.tsx', 'src/TaskCard.tsx')).toBe(true);
    expect(
      globMatch('src/**/*.tsx', 'src/features/tasks/components/TaskCard.tsx')
    ).toBe(true);
    expect(globMatch('src/**/*.tsx', 'src/features/tasks/store/tasksStore.ts')).toBe(false);
  });

  it('double-star matches zero segments between literals', () => {
    expect(globMatch('a/**/b.ts', 'a/b.ts')).toBe(true);
    expect(globMatch('a/**/b.ts', 'a/x/b.ts')).toBe(true);
    expect(globMatch('a/**/b.ts', 'a/x/y/b.ts')).toBe(true);
  });

  it('alternation via {a,b,c}', () => {
    expect(globMatch('src/{features,shared}/**/*.ts', 'src/features/x/y.ts')).toBe(true);
    expect(globMatch('src/{features,shared}/**/*.ts', 'src/shared/x/y.ts')).toBe(true);
    expect(globMatch('src/{features,shared}/**/*.ts', 'src/app/x/y.ts')).toBe(false);
  });

  it('escapes regex specials in literal segments', () => {
    expect(globMatch('src/a.b.ts', 'src/a.b.ts')).toBe(true);
    expect(globMatch('src/a.b.ts', 'src/axbxts')).toBe(false);
  });

  it('returns RegExp from globToRegex', () => {
    expect(globToRegex('a/*.ts')).toBeInstanceOf(RegExp);
  });
});

// =================================================================================================
// Tests — case detection
// =================================================================================================

describe('case detection', () => {
  it('classifies PascalCase', () => {
    expect(isPascalCase('Foo')).toBe(true);
    expect(isPascalCase('FooBar')).toBe(true);
    expect(isPascalCase('IFoo')).toBe(true);
    expect(isPascalCase('foo')).toBe(false);
    expect(isPascalCase('foo-bar')).toBe(false);
  });

  it('classifies camelCase', () => {
    expect(isCamelCase('foo')).toBe(true);
    expect(isCamelCase('fooBar')).toBe(true);
    expect(isCamelCase('useFoo')).toBe(true);
    expect(isCamelCase('Foo')).toBe(false);
    expect(isCamelCase('foo-bar')).toBe(false);
  });

  it('classifies kebab-case', () => {
    expect(isKebabCase('foo')).toBe(true);
    expect(isKebabCase('foo-bar')).toBe(true);
    expect(isKebabCase('theme-toggle')).toBe(true);
    expect(isKebabCase('Foo')).toBe(false);
    expect(isKebabCase('fooBar')).toBe(false);
  });

  it('detectCase honours the `expected` hint for ambiguous lowercase words', () => {
    expect(detectCase('button', 'kebab-case')).toBe('kebab-case');
    expect(detectCase('button', 'camelCase')).toBe('camelCase');
    expect(detectCase('Button', 'camelCase')).toBe('PascalCase');
  });
});

// =================================================================================================
// Tests — case conversion
// =================================================================================================

describe('case conversion', () => {
  it('pascalCase', () => {
    expect(pascalCase('foo')).toBe('Foo');
    expect(pascalCase('foo-bar')).toBe('FooBar');
    expect(pascalCase('foo_bar')).toBe('FooBar');
    expect(pascalCase('FooBar')).toBe('FooBar');
  });

  it('camelCase', () => {
    expect(camelCase('foo-bar')).toBe('fooBar');
    expect(camelCase('FooBar')).toBe('fooBar');
    expect(camelCase('foo')).toBe('foo');
  });

  it('kebabCase', () => {
    expect(kebabCase('FooBar')).toBe('foo-bar');
    expect(kebabCase('fooBar')).toBe('foo-bar');
    expect(kebabCase('foo bar')).toBe('foo-bar');
    expect(kebabCase('foo')).toBe('foo');
  });
});
