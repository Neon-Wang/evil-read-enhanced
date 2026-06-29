/**
 * @file WebVitalsPanel.tsx
 * @description Live readout of Core Web Vitals using the official
 * `web-vitals` package + the V8-only `performance.memory` heap snapshot.
 *
 * web-vitals streams updates via its `onMetric` callbacks. Each metric
 * only fires when the underlying browser observer has data to report —
 * LCP after the largest contentful paint, INP after a real interaction,
 * etc. — so the panel starts mostly empty and fills in over the first
 * few seconds of use.
 *
 * The memory snapshot is V8-only and gated behind a feature detect so
 * Firefox / Safari don't break.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// =================================================================================================
// Types
// =================================================================================================

type MetricName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';

interface MetricEntry {
  value: number;
  rating: Metric['rating'];
}

type MetricsMap = Partial<Record<MetricName, MetricEntry>>;

interface MemorySnapshot {
  usedMB: number;
  totalMB: number;
}

// V8-only chrome-specific perf API. Typed locally so we don't have to
// crank the lib.dom target to "experimental" types just for one demo.
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}
interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

// =================================================================================================
// Helpers
// =================================================================================================

function readMemory(): MemorySnapshot | null {
  const perf = (typeof performance !== 'undefined'
    ? (performance as PerformanceWithMemory)
    : null);
  if (!perf?.memory) return null;
  return {
    usedMB: perf.memory.usedJSHeapSize / 1024 / 1024,
    totalMB: perf.memory.totalJSHeapSize / 1024 / 1024,
  };
}

function formatNumber(value: number | undefined, unit: string): string {
  if (value === undefined) return '—';
  if (unit === 'ms') return `${Math.round(value)} ms`;
  if (unit === 'mb') return `${value.toFixed(1)} MB`;
  return value.toFixed(3);
}

function ratingClass(rating: Metric['rating'] | undefined): string {
  switch (rating) {
    case 'good':
      return 'text-[var(--color-success)]';
    case 'needs-improvement':
      return 'text-[var(--color-warning)]';
    case 'poor':
      return 'text-[var(--color-destructive)]';
    default:
      return 'text-[var(--color-muted-foreground)]';
  }
}

// =================================================================================================
// Component
// =================================================================================================

function WebVitalsPanel() {
  const { t } = useTranslation('examples');


  const [metrics, setMetrics] = React.useState<MetricsMap>({});
  const [memory, setMemory] = React.useState<MemorySnapshot | null>(() =>
    readMemory()
  );

  React.useEffect(() => {
    // web-vitals' `onX` handlers each register a single observer; calls
    // are stateful (no `off`), but at this scale the cost is negligible
    // — they're only invoked when the underlying browser API fires.
    const update = (name: MetricName) => (m: Metric) => {
      setMetrics((prev) => ({
        ...prev,
        [name]: { value: m.value, rating: m.rating },
      }));
    };
    onLCP(update('LCP'));
    onCLS(update('CLS'));
    onINP(update('INP'));
    onFCP(update('FCP'));
    onTTFB(update('TTFB'));
  }, []);

  React.useEffect(() => {
    const id = window.setInterval(() => setMemory(readMemory()), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('pages.performance.webVitals.interactHint')}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric
          label={t('pages.performance.webVitals.lcp')}
          value={formatNumber(metrics.LCP?.value, 'ms')}
          rating={metrics.LCP?.rating}
        />
        <Metric
          label={t('pages.performance.webVitals.cls')}
          value={formatNumber(metrics.CLS?.value, '')}
          rating={metrics.CLS?.rating}
        />
        <Metric
          label={t('pages.performance.webVitals.inp')}
          value={formatNumber(metrics.INP?.value, 'ms')}
          rating={metrics.INP?.rating}
        />
        <Metric
          label={t('pages.performance.webVitals.fcp')}
          value={formatNumber(metrics.FCP?.value, 'ms')}
          rating={metrics.FCP?.rating}
        />
        <Metric
          label={t('pages.performance.webVitals.ttfb')}
          value={formatNumber(metrics.TTFB?.value, 'ms')}
          rating={metrics.TTFB?.rating}
        />
        <Metric
          label={t('pages.performance.webVitals.memory')}
          value={memory ? formatNumber(memory.usedMB, 'mb') : '—'}
        />
      </dl>
    </div>
  );
}

function Metric({
  label,
  value,
  rating,
}: {
  label: string;
  value: string;
  rating?: Metric['rating'];
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className={`mt-1 font-mono text-base font-medium ${ratingClass(rating)}`}>
        {value}
      </p>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { WebVitalsPanel };
