/**
 * @file case.js
 * @description Casing detectors and converters shared across the local ESLint
 * plugin rules.
 *
 * Definitions:
 *   - PascalCase           — `Foo`, `FooBar`, `Foo2Bar`, `IFoo`
 *   - camelCase            — `foo`, `fooBar`, `useFoo`, `cn`
 *   - kebab-case           — `foo`, `foo-bar`, `theme-toggle`
 *   - SCREAMING_SNAKE_CASE — `FOO`, `FOO_BAR`
 *
 * Single lowercase letters (`a`, `b`) classify as `camelCase`, single
 * uppercase letters classify as `PascalCase`. `lowercaseword` classifies
 * as `camelCase` and as `kebab-case` simultaneously — the detector
 * resolves ambiguity by preferring `camelCase` for files inside JS/TS
 * source folders and leaving `kebab-case` for the explicit per-rule
 * check (since they are configured per-glob anyway, there is no
 * ambiguity at call sites).
 */

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SCREAMING_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

export function isPascalCase(s) {
  return PASCAL_CASE.test(s);
}

export function isCamelCase(s) {
  return CAMEL_CASE.test(s);
}

export function isKebabCase(s) {
  return KEBAB_CASE.test(s);
}

export function isScreamingSnakeCase(s) {
  return SCREAMING_SNAKE.test(s);
}

export function detectCase(s, expected) {
  // When `expected` is provided, return that case if it matches (so the
  // ambiguous "all-lowercase, no hyphens" word resolves the way the
  // caller wants). Otherwise return the first matching case.
  const tests = [
    ['PascalCase', PASCAL_CASE],
    ['camelCase', CAMEL_CASE],
    ['kebab-case', KEBAB_CASE],
    ['SCREAMING_SNAKE_CASE', SCREAMING_SNAKE],
  ];
  if (expected) {
    const found = tests.find(([name]) => name === expected);
    if (found && found[1].test(s)) return expected;
  }
  for (const [name, re] of tests) {
    if (re.test(s)) return name;
  }
  return null;
}

export function pascalCase(s) {
  return s
    .replace(/[-_]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

export function camelCase(s) {
  const p = pascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function kebabCase(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}
