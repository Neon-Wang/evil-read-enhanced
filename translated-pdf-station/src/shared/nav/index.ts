/**
 * @file index.ts
 * @description Barrel for `shared/nav` — re-exports the central nav
 * spec consumed by every layout in `src/app/layouts/*RootLayout.tsx`.
 * Required so callers can `import { navLinks } from '@/shared/nav'`
 * and so the `shared-shape.test.ts` barrel-policy fence stays green.
 */

export { navLinks, type NavLinkSpec } from './navLinks';
