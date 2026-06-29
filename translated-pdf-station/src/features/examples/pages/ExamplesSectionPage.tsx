/**
 * @file ExamplesSectionPage.tsx
 * @description Renders ONE inline component showcase as a standalone
 * sub-page, resolved from the `:section` route param against the
 * `exampleSections` registry. Reached via the sidebar links under the
 * `/examples` shell (e.g. `/examples/button`).
 *
 * Page chrome on a known slug:
 *   - Breadcrumb trail (Overview › Group › Section).
 *   - Title + group chip.
 *   - Polished `ShowcaseFrame` around the live demo (top strip with
 *     route + copy/open-new-tab actions, dotted backdrop).
 *   - Pager (prev/next) at the bottom that walks the flat registry order.
 *
 * Unknown slugs fall back to a friendly empty state with a quick
 * suggestion strip — the shell (and its nav) is still mounted around
 * this Outlet, so a hard 404 would be jarring.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

// --- Relative Imports ---
import { ShowcaseFrame } from '../components/ShowcaseFrame';
import { ShowcasePageHeader } from '../components/ShowcasePageHeader';
import { SectionPager } from '../components/SectionPager';
import { findSection } from '../components/exampleSections';
import {
  getGroupIcon,
  getNeighbours,
  findFlatEntry,
} from '../components/sectionMeta';

// =================================================================================================
// Component
// =================================================================================================

function ExamplesSectionPage() {
  const { t } = useTranslation('examples');
  const { section } = useParams<{ section: string }>();
  const entry = findSection(section);

  // Unknown slug: friendly empty state with a quick "back to overview"
  // button. The shell + sidebar are still mounted around this, so the
  // visitor can also just pick another component from the rail.
  if (!entry) {
    return (
      <div className="flex flex-col gap-6">
        <ShowcasePageHeader
          breadcrumb={[
            { label: t('toc.overview'), to: '/examples' },
            { label: t('meta.notFound') },
          ]}
          title={t('meta.notFoundTitle')}
          subtitle={t('meta.unknownSection')}
        />
        <Link
          to="/examples"
          className="inline-flex w-fit items-center rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] shadow-sm transition-colors hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {t('meta.backToIndex')}
        </Link>
      </div>
    );
  }

  const Demo = entry.Component;
  const flatEntry = findFlatEntry(entry.slug);
  const groupKey = flatEntry?.group ?? entry.group;
  const GroupIcon = getGroupIcon(groupKey);
  const { prev, next } = getNeighbours(entry.slug);
  const groupLabel = t(`toc.${groupKey}`);
  const sectionTitle = t(`sections.${entry.slug}.title`);
  const sectionSubtitle = t(`sections.${entry.slug}.description`);

  return (
    <div className="flex flex-col gap-8">
      <ShowcasePageHeader
        breadcrumb={[
          { label: t('toc.overview'), to: '/examples' },
          { label: groupLabel },
          { label: sectionTitle },
        ]}
        chip={{ label: groupLabel, icon: GroupIcon }}
        title={sectionTitle}
        subtitle={sectionSubtitle}
      />
      <ShowcaseFrame slug={entry.slug}>
        <Demo />
      </ShowcaseFrame>
      <SectionPager prev={prev} next={next} />
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ExamplesSectionPage };
