/**
 * @file SectionPager.tsx
 * @description Prev/next link pair rendered at the bottom of every
 * routed examples sub-page.
 *
 * Order is defined by `sectionMeta.FLAT_ORDER` — every reachable
 * showcase laid out in the same sequence the sidebar shows them, so
 * the pager and `[` / `]` keyboard shortcuts step through the catalog
 * predictably.
 *
 * Each tile shows the directional arrow + a small kbd hint (`[` / `]`)
 * paired with the destination page's title, mirroring the prev/next
 * pattern from Stripe / Tailwind / shadcn docs sites.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// --- Third-party Libraries ---
import { ArrowLeft, ArrowRight } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// --- Relative Imports ---
import type { FlatEntry } from './sectionMeta';

// =================================================================================================
// Types
// =================================================================================================

interface SectionPagerProps {
  prev?: FlatEntry;
  next?: FlatEntry;
}

// =================================================================================================
// Component
// =================================================================================================

function SectionPager({ prev, next }: SectionPagerProps) {
  const { t } = useTranslation('examples');

  if (!prev && !next) return null;

  return (
    <nav
      aria-label={t('pager.label')}
      className="mt-12 grid gap-3 border-t border-[var(--color-border)] pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <PagerTile
          to={`/examples/${prev.slug}`}
          dir="prev"
          eyebrow={t('pager.prev')}
          title={t(prev.titleKey)}
          kbd="["
        />
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <PagerTile
          to={`/examples/${next.slug}`}
          dir="next"
          eyebrow={t('pager.next')}
          title={t(next.titleKey)}
          kbd="]"
        />
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

interface PagerTileProps {
  to: string;
  dir: 'prev' | 'next';
  eyebrow: string;
  title: string;
  kbd: string;
}

function PagerTile({ to, dir, eyebrow, title, kbd }: PagerTileProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm',
        'transition-colors duration-[var(--duration-fast)]',
        'hover:border-[var(--color-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        dir === 'next' && 'sm:items-end sm:text-right'
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        {dir === 'prev' && <ArrowLeft aria-hidden="true" className="h-3 w-3" />}
        {eyebrow}
        {dir === 'next' && <ArrowRight aria-hidden="true" className="h-3 w-3" />}
        <kbd className="ml-1 hidden rounded border border-[var(--color-border)] bg-[var(--color-muted)] px-1 text-[10px] font-mono not-italic tracking-normal text-[var(--color-muted-foreground)] sm:inline">
          {kbd}
        </kbd>
      </span>
      <span className="text-sm font-medium text-[var(--color-card-foreground)] transition-colors group-hover:text-[var(--color-primary)]">
        {title}
      </span>
    </Link>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { SectionPager };
export type { SectionPagerProps };
