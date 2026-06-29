/**
 * @file ExamplesTopNav.tsx
 * @description Compact in-content examples navigation for layouts that
 * already have a global sidebar. It avoids the "sidebar inside sidebar"
 * look by turning the examples TOC into a horizontal category strip plus
 * route chips.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useEffect, useMemo, useState } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

// --- Third-party Libraries ---
import { Search, X } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// --- Relative Imports ---
import { GROUP_ORDER, sectionsByGroup } from './exampleSections';
import { getGroupIcon, type SidebarGroupKey } from './sectionMeta';

// =================================================================================================
// Types
// =================================================================================================

interface NavLinkItem {
  to: string;
  label: string;
  end?: boolean;
}

interface NavGroup {
  key: SidebarGroupKey;
  label: string;
  items: NavLinkItem[];
}

// =================================================================================================
// Component
// =================================================================================================

function ExamplesTopNav() {
  const { t } = useTranslation('examples');
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');

  const groups = useExampleNavGroups();
  const activeGroupKey = findActiveGroup(groups, pathname);
  const [selectedGroupKey, setSelectedGroupKey] =
    useState<SidebarGroupKey>(activeGroupKey);

  useEffect(() => {
    setSelectedGroupKey(activeGroupKey);
  }, [activeGroupKey]);

  const q = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!q) return groups.filter((g) => g.key === selectedGroupKey);
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q, selectedGroupKey]);

  return (
    <section
      aria-label={t('toc.label')}
      className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/55 p-3 shadow-sm backdrop-blur"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
            {t('toc.label')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {groups.map((group) => {
              const Icon = getGroupIcon(group.key);
              const active = group.key === selectedGroupKey && !q;
              const containsCurrent = group.key === activeGroupKey;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelectedGroupKey(group.key);
                  }}
                  className={cn(
                    'app-nav-link inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                    active
                      ? 'app-nav-link-active bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
                    containsCurrent &&
                      !active &&
                      'text-[var(--color-foreground)]'
                  )}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>{group.label}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'rounded-full px-1.5 text-[10px]',
                      active
                        ? 'bg-[var(--color-primary-foreground)]/15 text-current'
                        : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                    )}
                  >
                    {group.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full shrink-0 lg:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('toc.filterPlaceholder')}
            aria-label={t('toc.filterPlaceholder')}
            className={cn(
              'h-9 w-full rounded-md pl-8 pr-9 text-[13px]',
              'border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]',
              'placeholder:text-[var(--color-muted-foreground)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('toc.clearFilter')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--color-border)]/70 pt-3">
        {visibleGroups.length === 0 ? (
          <p className="px-1 text-xs text-[var(--color-muted-foreground)]">
            {t('toc.noResults')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <TopNavLink to="/examples" label={t('toc.overview')} end />
            {visibleGroups.flatMap((group) =>
              group.items.map((item) => (
                <TopNavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  end={item.end}
                />
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function useExampleNavGroups(): NavGroup[] {
  const { t } = useTranslation('examples');
  return useMemo(
    () => [
      ...GROUP_ORDER.map<NavGroup>((key) => ({
        key,
        label: t(`toc.${key}`),
        items: sectionsByGroup(key).map((s) => ({
          to: `/examples/${s.slug}`,
          label: t(`sections.${s.slug}.title`),
        })),
      })),
      {
        key: 'modals',
        label: t('toc.modals'),
        items: [
          { to: '/examples/toaster', label: t('pages.toaster.title') },
          { to: '/examples/dialog', label: t('pages.dialog.title') },
{ to: '/examples/command', label: t('pages.command.title') },
          { to: '/examples/sign-in-modal', label: t('pages.signInModal.title') },
        ],
      },
      {
        key: 'performance',
        label: t('toc.performance'),
        items: [
          { to: '/examples/motion', label: t('pages.motion.title') },
          { to: '/examples/performance', label: t('pages.performance.title') },
        ],
      },
    ],
    [t]
  );
}

function findActiveGroup(groups: NavGroup[], pathname: string): SidebarGroupKey {
  const match = groups.find((g) =>
    g.items.some((item) => pathname === item.to)
  );
  return match?.key ?? groups[0]?.key ?? 'basics';
}

function TopNavLink({ to, label, end }: NavLinkItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'app-nav-link inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          isActive
            ? 'app-nav-link-active border-[var(--color-primary)] bg-[var(--color-primary)]/12 text-[var(--color-foreground)]'
            : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
        )
      }
    >
      {label}
    </NavLink>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ExamplesTopNav };
