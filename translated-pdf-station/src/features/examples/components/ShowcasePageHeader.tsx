/**
 * @file ShowcasePageHeader.tsx
 * @description Shared chrome at the top of every examples sub-page.
 *
 * Three concerns, all optional except the title:
 *
 *   - A breadcrumb trail above the heading (preferred for routed
 *     sub-pages, where context > "go back").
 *   - A back link (`showBack`) — the legacy chrome predating the
 *     persistent sidebar; kept for the standalone showcase pages that
 *     haven't been migrated to the breadcrumb yet.
 *   - A group chip (icon + label) rendered inline with the title to
 *     give an at-a-glance category tag.
 *
 * The "Dev only" notice is NOT rendered here — it lives once in
 * `ExamplesLayout` so the persistent shell shows it a single time
 * instead of repeating a loud banner on all ~25 sub-pages.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// --- Third-party Libraries ---
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react';

// =================================================================================================
// Types
// =================================================================================================

/** Single hop in the breadcrumb trail. The last hop is rendered as the current page. */
interface BreadcrumbItem {
  label: string;
  /** Omit on the final crumb — the current page is non-interactive. */
  to?: string;
}

interface ShowcasePageHeaderProps {
  /** Page heading (h1). */
  title: string;
  /** Optional one-line subtitle directly under the heading. */
  subtitle?: string;
  /** Show the legacy "← Back to showcase" link above the heading. */
  showBack?: boolean;
  /** Render a `nav` breadcrumb trail above the heading. Wins over `showBack`. */
  breadcrumb?: BreadcrumbItem[];
  /** Group badge rendered inline with the title (e.g. icon + "Forms & data"). */
  chip?: { label: string; icon?: LucideIcon };
}

// =================================================================================================
// Component
// =================================================================================================

function ShowcasePageHeader({
  title,
  subtitle,
  showBack = false,
  breadcrumb,
  chip,
}: ShowcasePageHeaderProps) {
  const { t } = useTranslation('examples');
  const ChipIcon = chip?.icon;

  return (
    <header className="flex flex-col gap-4">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label={t('meta.breadcrumb')}>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
            {breadcrumb.map((crumb, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
                  )}
                  {crumb.to && !isLast ? (
                    <Link
                      to={crumb.to}
                      className="rounded-sm transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={isLast ? 'text-[var(--color-foreground)]' : ''}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : showBack ? (
        <Link
          to="/examples"
          className="inline-flex w-fit items-center gap-1 text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <ArrowLeft className="h-3 w-3" />
          {t('meta.backToIndex')}
        </Link>
      ) : null}
      <div className="flex flex-col gap-2">
        {chip && (
          <span className="app-badge inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
            {ChipIcon && <ChipIcon aria-hidden="true" className="h-3 w-3" />}
            {chip.label}
          </span>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ShowcasePageHeader };
export type { BreadcrumbItem, ShowcasePageHeaderProps };
