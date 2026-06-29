/**
 * @file navLinks.ts
 * @description Single source of truth for the global nav menu shape and
 * entries. Consumed by the full-nav layouts in `src/app/layouts/`.
 *
 * The two BottomTabs layouts use their own curated `tabs[]` arrays
 * inline. If a route should appear in BottomTabs too, also add it to
 * those layouts' inline arrays.
 */

import {
  Component,
  CheckSquare,
  Home,
  Plus,
  type LucideIcon,
} from 'lucide-react';

export interface NavLinkSpec {
  /** Router path the entry navigates to. */
  to: string;
  /** i18n key for the label (under the `nav.*` namespace). */
  key: string;
  /** Fallback label when the i18n key is missing. */
  fallback: string;
  /**
   * NavLink `end` prop - true for the root path so it doesn't stay
   * highlighted on every nested route.
   */
  end?: boolean;
  /**
   * Icon, rendered by `MobileDrawerRootLayout`. The other full-nav
   * layouts ignore this field.
   */
  icon: LucideIcon;
}

/**
 * The full nav menu. Order is the rendered order. The Examples destination
 * is dev-only because its route is mounted only in local preview builds.
 */
export const navLinks: NavLinkSpec[] = [
  { to: '/', key: 'nav.home', fallback: 'Home', icon: Home, end: true },
  { to: '/counter', key: 'nav.counter', fallback: 'Counter', icon: Plus },
  { to: '/tasks', key: 'nav.tasks', fallback: 'Tasks', icon: CheckSquare },
  ...(import.meta.env.DEV
    ? [
        {
          to: '/examples',
          key: 'nav.examples',
          fallback: 'Examples',
          icon: Component,
        },
      ]
    : []),
];
