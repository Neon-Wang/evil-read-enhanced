/**
 * @file sectionMeta.ts
 * @description Visual + ordering metadata for the examples shell.
 *
 * Two concerns shared by the index, the per-section page, and the
 * sidebar:
 *
 *   1. Per-group iconography. Every category in the showcase gets a
 *      single Lucide icon so the sidebar group headers and the index
 *      cards have a consistent visual anchor. Colour stays uniform via
 *      the standard token palette — varying it per group fights three
 *      different UI variants (custom / shadcn / animate-ui) in light
 *      AND dark mode and was deemed not worth the upkeep.
 *
 *   2. The flat registry order — every reachable showcase route
 *      (inline registry entries + the standalone pages) listed once,
 *      in the same order the sidebar shows them. The per-section page
 *      uses this list to compute its prev / next pager links and the
 *      `[` / `]` keyboard shortcuts.
 *
 * Variant fences (`@eikon:variant(layout=...)`) wrap entries that only
 * exist for some scaffold variants — kept identical to the routes /
 * sidebar fences so the variant transformer drops the same items in
 * both files.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import {
  Bell,
  FormInput,
  Gauge,
  LayoutGrid,
  Layers,
  type LucideIcon,
  Sparkles,
  Type,
} from 'lucide-react';

// --- Relative Imports ---
import { exampleSections, type GroupKey } from './exampleSections';

// =================================================================================================
// Types
// =================================================================================================

/** Group keys that appear in the sidebar — registry groups + standalone groups. */
type SidebarGroupKey = GroupKey | 'modals' | 'performance';

/** Where a slug lives in the navigation: which group, which i18n title key. */
interface FlatEntry {
  /** URL slug — `/examples/<slug>`. */
  slug: string;
  /** Group bucket (used by the breadcrumb + group chip on the section page). */
  group: SidebarGroupKey;
  /** Full i18n key for the route's display title (e.g. `pages.toaster.title`). */
  titleKey: string;
}

// =================================================================================================
// Group iconography
// =================================================================================================

const GROUP_ICONS: Record<SidebarGroupKey, LucideIcon> = {
  basics: LayoutGrid,
  forms: FormInput,
  feedbackGroup: Bell,
  content: Type,
  patterns: Sparkles,
  modals: Layers,
  performance: Gauge,
};

function getGroupIcon(group: SidebarGroupKey): LucideIcon {
  return GROUP_ICONS[group];
}

// =================================================================================================
// Flat registry order
// =================================================================================================

/**
 * Every showcase, in sidebar order. Built once at module load: the inline
 * registry entries (already in display order), then the standalone pages
 * grouped under "Modals & overlays" and "Performance".
 *
 * Keep the variant fences here in sync with `routes.tsx` and
 * `ExamplesSidebar.tsx` so the variant transformer drops the same routes
 * everywhere.
 */
const FLAT_ORDER: FlatEntry[] = [
  ...exampleSections.map<FlatEntry>((s) => ({
    slug: s.slug,
    group: s.group,
    titleKey: `sections.${s.slug}.title`,
  })),
  // --- Standalone showcases under "Modals & overlays" ---
  { slug: 'toaster', group: 'modals', titleKey: 'pages.toaster.title' },
  { slug: 'dialog', group: 'modals', titleKey: 'pages.dialog.title' },
{ slug: 'command', group: 'modals', titleKey: 'pages.command.title' },
  { slug: 'sign-in-modal', group: 'modals', titleKey: 'pages.signInModal.title' },
  // --- Standalone showcases under "Performance" ---
  { slug: 'motion', group: 'performance', titleKey: 'pages.motion.title' },
  { slug: 'performance', group: 'performance', titleKey: 'pages.performance.title' },
];

function findFlatEntry(slug: string | undefined): FlatEntry | undefined {
  if (!slug) return undefined;
  return FLAT_ORDER.find((e) => e.slug === slug);
}

/**
 * Returns `{ prev, next }` for the given slug — undefined for endpoints.
 * Used by the per-section pager and the global `[` / `]` shortcut.
 */
function getNeighbours(slug: string | undefined): {
  prev: FlatEntry | undefined;
  next: FlatEntry | undefined;
} {
  if (!slug) return { prev: undefined, next: undefined };
  const i = FLAT_ORDER.findIndex((e) => e.slug === slug);
  if (i < 0) return { prev: undefined, next: undefined };
  return {
    prev: i > 0 ? FLAT_ORDER[i - 1] : undefined,
    next: i < FLAT_ORDER.length - 1 ? FLAT_ORDER[i + 1] : undefined,
  };
}

// =================================================================================================
// Exports
// =================================================================================================

/**
 * Aggregate namespace export — also satisfies the eslint
 * `filename-matches-export` rule (filename: `sectionMeta`).
 */
const sectionMeta = {
  FLAT_ORDER,
  findFlatEntry,
  getGroupIcon,
  getNeighbours,
};

export { FLAT_ORDER, findFlatEntry, getGroupIcon, getNeighbours, sectionMeta };
export type { FlatEntry, SidebarGroupKey };
