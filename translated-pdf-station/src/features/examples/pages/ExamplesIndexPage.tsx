/**
 * @file ExamplesIndexPage.tsx
 * @description Overview landing for the `/examples` shell (the index
 * Outlet). Three vertical bands:
 *
 *   1. Hero — title + subtitle + a metric strip that reads the registry
 *      live (X components, Y categories, the seven layouts the shell
 *      adapts to).
 *   2. Featured — three spotlight cards for the highest-traffic demos
 *      (Buttons, Sign-up form, Toaster) so a first-time visitor has an
 *      obvious starting point instead of staring at 25+ uniform tiles.
 *   3. Group sections — every category gets an icon + count headline,
 *      then a responsive grid of cards linking to each component's own
 *      sub-page.
 *
 * The persistent navigation lives in `ExamplesLayout`'s sidebar — this
 * page is the welcome surface shown before the visitor picks a
 * component, so it stays link-forward and avoids competing chrome.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// --- Third-party Libraries ---
import {
  ArrowRight,
  Bell,
  FormInput,
  type LucideIcon,
  MousePointerSquareDashed,
} from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// --- Relative Imports ---
import { ShowcasePageHeader } from '../components/ShowcasePageHeader';
import {
  GROUP_ORDER,
  exampleSections,
  sectionsByGroup,
} from '../components/exampleSections';
import { getGroupIcon } from '../components/sectionMeta';

// =================================================================================================
// Constants
// =================================================================================================

/**
 * Spotlight cards rendered in the "Featured" band. Slugs map to either
 * a registry entry or one of the standalone showcase routes — both
 * resolve cleanly under `/examples/<slug>`.
 *
 * Icon override per card (rather than reusing the group icon) so the
 * hero band reads as distinct entry points, not as a duplicate of the
 * group grid below.
 */
interface FeaturedSpec {
  slug: string;
  icon: LucideIcon;
  /** i18n key for the card eyebrow ("Forms" / "Modals" / …). */
  eyebrowKey: string;
  /** i18n key for the card title. */
  titleKey: string;
  /** i18n key for the card description. */
  descKey: string;
}

const FEATURED: FeaturedSpec[] = [
  {
    slug: 'button',
    icon: MousePointerSquareDashed,
    eyebrowKey: 'toc.basics',
    titleKey: 'sections.button.title',
    descKey: 'sections.button.description',
  },
  {
    slug: 'signup',
    icon: FormInput,
    eyebrowKey: 'toc.forms',
    titleKey: 'sections.signup.title',
    descKey: 'sections.signup.description',
  },
  {
    slug: 'toaster',
    icon: Bell,
    eyebrowKey: 'toc.modals',
    titleKey: 'pages.toaster.title',
    descKey: 'pages.toaster.description',
  },
];

/** Number of root layouts the examples shell adapts to. Hard-coded — */
/** matches the `--layout` switch on the CLI (stacked / sidebar / */
/** topbar-sidebar / centered / mobile-drawer / bottom-tabs / bottom-tabs-fab). */
const LAYOUT_COUNT = 7;

// =================================================================================================
// Component
// =================================================================================================

function ExamplesIndexPage() {
  const { t } = useTranslation('examples');

  const totalComponents = exampleSections.length;
  const totalGroups = GROUP_ORDER.length;

  return (
    <div className="flex flex-col gap-12">
      {/* --- Hero band -------------------------------------------------- */}
      <div className="flex flex-col gap-6">
        <ShowcasePageHeader title={t('meta.title')} subtitle={t('meta.subtitle')} />

        {/*
          Metric strip — three at-a-glance figures pulled from the registry.
          Mirrors the "by the numbers" pattern from Vercel / Linear / Stripe
          docs landings; gives the page a sense of scale without demanding
          the visitor read the whole grid first.
        */}
        <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
          <Metric label={t('overview.metrics.components')} value={totalComponents} />
          <Metric label={t('overview.metrics.categories')} value={totalGroups} />
          <Metric label={t('overview.metrics.layouts')} value={LAYOUT_COUNT} />
        </dl>
      </div>

      {/* --- Featured band --------------------------------------------- */}
      <section className="flex flex-col gap-3" aria-label={t('overview.featured')}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
          {t('overview.featured')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED.map((spec) => (
            <FeaturedCard
              key={spec.slug}
              spec={spec}
              eyebrow={t(spec.eyebrowKey)}
              title={t(spec.titleKey)}
              description={t(spec.descKey)}
              cta={t('overview.tryIt')}
            />
          ))}
        </div>
      </section>

      {/* --- Group bands ----------------------------------------------- */}
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('overview.pick')}
      </p>

      <div className="flex flex-col gap-10">
        {GROUP_ORDER.map((group) => {
          const items = sectionsByGroup(group);
          const GroupIcon = getGroupIcon(group);
          return (
            <section key={group} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
                <GroupIcon aria-hidden="true" className="h-3.5 w-3.5" />
                {t(`toc.${group}`)}
                <span className="rounded-full bg-[var(--color-muted)] px-1.5 text-[10px] font-medium tabular-nums text-[var(--color-muted-foreground)]">
                  {items.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <Link
                    key={s.slug}
                    to={`/examples/${s.slug}`}
                    className={cn(
                      'group relative flex flex-col gap-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm',
                      'transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-primary)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
                    )}
                  >
                    {/* Left accent strip — lights up on hover. */}
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-full w-[2px] bg-[var(--color-primary)] opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
                    />
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-primary)]"
                      />
                      <span className="text-sm font-medium text-[var(--color-card-foreground)] transition-colors group-hover:text-[var(--color-primary)]">
                        {t(`sections.${s.slug}.title`)}
                      </span>
                    </span>
                    <span className="line-clamp-2 pl-3.5 text-xs text-[var(--color-muted-foreground)]">
                      {t(`sections.${s.slug}.description`)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

interface MetricProps {
  label: string;
  value: number;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--color-foreground)]">
        {value}
      </dd>
    </div>
  );
}

interface FeaturedCardProps {
  spec: FeaturedSpec;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
}

function FeaturedCard({ spec, eyebrow, title, description, cta }: FeaturedCardProps) {
  const Icon = spec.icon;
  return (
    <Link
      to={`/examples/${spec.slug}`}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm',
        'transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
      )}
    >
      {/* Faint corner glow — purely decorative, lights on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--color-primary)]/10 opacity-0 blur-2xl transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
      />
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 text-[var(--color-foreground)] transition-colors group-hover:border-[var(--color-primary)] group-hover:text-[var(--color-primary)]"
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
          {eyebrow}
        </span>
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold text-[var(--color-card-foreground)] transition-colors group-hover:text-[var(--color-primary)]">
          {title}
        </span>
        <span className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
          {description}
        </span>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] opacity-80 transition-opacity group-hover:opacity-100">
        {cta}
        <ArrowRight aria-hidden="true" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ExamplesIndexPage };
