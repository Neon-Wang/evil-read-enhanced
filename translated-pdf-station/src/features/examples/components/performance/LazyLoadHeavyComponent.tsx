/**
 * @file LazyLoadHeavyComponent.tsx
 * @description The "heavy" payload of the lazy-load demo. Lives in a
 * separate file so it lands in its own Vite chunk, which is the whole
 * point of the demo.
 *
 * Accepts an `onMount` callback so the parent demo can measure the
 * end-to-end fetch-and-mount window.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { CheckCircle2 } from 'lucide-react';

// =================================================================================================
// Component
// =================================================================================================

function LazyLoadHeavyComponent({ onMount }: { onMount?: () => void }) {
  const { t } = useTranslation('examples');


  React.useEffect(() => {
    onMount?.();
  }, [onMount]);

  return (
    <div className="flex items-start gap-3 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/8 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
      <div>
        <p className="text-sm font-medium text-[var(--color-card-foreground)]">
          {t('pages.performance.lazyLoad.loadedTitle')}
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {t('pages.performance.lazyLoad.loadedBody')}
        </p>
      </div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { LazyLoadHeavyComponent };
