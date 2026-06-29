/**
 * @file eslint-rules.d.ts
 * @description Ambient module declarations for the local ESLint plugin.
 *
 * The plugin ships as ESM JavaScript (no .d.ts) so it stays
 * dependency-free at runtime. TypeScript needs surface types to
 * typecheck the test files that import from it; declaring them here
 * keeps the runtime files unchanged.
 */

declare module '*/eslint-rules/index.js' {
  import type { Linter } from 'eslint';
  const plugin: Linter.Plugin;
  export default plugin;
}

declare module '*/eslint-rules/lib/case.js' {
  export function isPascalCase(s: string): boolean;
  export function isCamelCase(s: string): boolean;
  export function isKebabCase(s: string): boolean;
  export function isScreamingSnakeCase(s: string): boolean;
  export function detectCase(s: string, expected?: string): string | null;
  export function pascalCase(s: string): string;
  export function camelCase(s: string): string;
  export function kebabCase(s: string): string;
}

declare module '*/eslint-rules/lib/glob-match.js' {
  export function globToRegex(glob: string): RegExp;
  export function globMatch(glob: string, p: string): boolean;
}
