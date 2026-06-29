/**
 * @file PerformanceShowcasePage.tsx
 * @description Route-level component for `/examples/performance`.
 *
 * Three diagnostic panels stacked vertically (rather than the v1
 * single-tab approach) so a visitor can absorb all three at a glance
 * without losing context — Web Vitals updates while they scroll past
 * the virtual list and trigger the lazy chunk.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Relative Imports ---
import { LazyLoadDemo } from '../components/performance/LazyLoadDemo';
import { VirtualListDemo } from '../components/performance/VirtualListDemo';
import { WebVitalsPanel } from '../components/performance/WebVitalsPanel';
import { ShowcasePageHeader } from '../components/ShowcasePageHeader';
import { ShowcaseSection } from '../components/ShowcaseSection';

// =================================================================================================
// Component
// =================================================================================================

function PerformanceShowcasePage() {
  const { t } = useTranslation('examples');


  return (
    <div className="flex flex-col gap-8">
      <ShowcasePageHeader
        showBack
        title={t('pages.performance.title')}
        subtitle={t('pages.performance.description')}
      />

      <ShowcaseSection
        anchor="web-vitals"
        title={t('pages.performance.webVitals.title')}
        description={t('pages.performance.webVitals.description')}
      >
        <WebVitalsPanel />
      </ShowcaseSection>

      <ShowcaseSection
        anchor="virtual-list"
        title={t('pages.performance.virtualList.title')}
        description={t('pages.performance.virtualList.description')}
      >
        <VirtualListDemo />
      </ShowcaseSection>

      <ShowcaseSection
        anchor="lazy-load"
        title={t('pages.performance.lazyLoad.title')}
        description={t('pages.performance.lazyLoad.description')}
      >
        <LazyLoadDemo />
      </ShowcaseSection>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { PerformanceShowcasePage };
