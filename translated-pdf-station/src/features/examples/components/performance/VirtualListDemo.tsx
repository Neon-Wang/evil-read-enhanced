/**
 * @file VirtualListDemo.tsx
 * @description Virtualised 10,000-row list powered by `@tanstack/react-virtual`.
 *
 * The list mounts only the rows currently inside the scroll viewport
 * plus a small overscan buffer; everything else is rendered as empty
 * spacer space. The result is constant-time DOM cost regardless of the
 * dataset size — the same shape you'd want for log viewers, transaction
 * tables, search results, etc.
 *
 * The "mounted at" timestamp on each row is intentionally computed at
 * render time so a quick scroll reveals new times appearing — a visible
 * proof that rows ARE being created on demand, not pre-rendered.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { useVirtualizer } from '@tanstack/react-virtual';

// =================================================================================================
// Constants
// =================================================================================================

const TOTAL_ROWS = 10_000;
const ROW_HEIGHT = 56;
const OVERSCAN = 6;

// =================================================================================================
// Component
// =================================================================================================

function VirtualListDemo() {
  const { t } = useTranslation('examples');


  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: TOTAL_ROWS,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('pages.performance.virtualList.scrollHint')}
      </p>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {t('pages.performance.virtualList.stats', {
          visible: virtualItems.length,
          total: TOTAL_ROWS,
        })}
      </p>
      <div
        ref={scrollRef}
        className="h-72 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)]"
      >
        {/*
          Inner spacer carries the total scroll height so the scrollbar
          accurately reflects the full dataset. Real rows are absolutely
          positioned inside it at their virtual offsets.
        */}
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((vrow) => (
            <Row key={vrow.key} index={vrow.index} top={vrow.start} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  index: number;
  top: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const Row = React.memo(function Row({ index, top, t }: RowProps) {
  // Compute the mount timestamp on each render — this is what makes a
  // scroll visibly drop fresh times into the rows as they mount.
  const mountedAt = new Date().toLocaleTimeString();
  return (
    <div
      className="absolute left-0 right-0 flex items-center gap-3 border-b border-[var(--color-border)] px-4"
      style={{
        top: `${top}px`,
        height: `${ROW_HEIGHT}px`,
      }}
    >
      <span className="font-mono text-xs text-[var(--color-muted-foreground)] w-20">
        {t('pages.performance.virtualList.rowItem', { index })}
      </span>
      <span className="text-sm text-[var(--color-card-foreground)]">
        {t('pages.performance.virtualList.rowBody', { time: mountedAt })}
      </span>
    </div>
  );
});

// =================================================================================================
// Exports
// =================================================================================================

export { VirtualListDemo };
