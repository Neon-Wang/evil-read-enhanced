/**
 * @file LazyLoadDemo.tsx
 * @description Demonstrates React 19's `lazy()` + `<Suspense>` against
 * a deliberately-delayed dynamic import. Clicking "Load heavy chunk"
 * fires the dynamic import; the Suspense boundary covers the fetch
 * window with a skeleton; the elapsed counter reports the wall-clock
 * cost.
 *
 * The "heavy" component lives in `./LazyLoadHeavyComponent.tsx`. We
 * artificially delay the resolution by ~1.5s so the loading state is
 * visible even on a fast localhost; in production this would be the
 * actual network + parse cost of the chunk.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { Loader2 } from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';

// =================================================================================================
// Lazy chunk
// =================================================================================================

/**
 * Wrap the import in a 1.5s delay so the Suspense fallback is visible
 * to a human eye even on localhost. We `import('./...')` first and
 * race it against the timer; in production the timer would just be the
 * network + parse cost.
 */
const HeavyComponent = React.lazy(async () => {
  const [mod] = await Promise.all([
    import('./LazyLoadHeavyComponent'),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
  return { default: mod.LazyLoadHeavyComponent };
});

// =================================================================================================
// Component
// =================================================================================================

function LazyLoadDemo() {
  const { t } = useTranslation('examples');


  const [loadedAt, setLoadedAt] = React.useState<number | null>(null);
  const [trigger, setTrigger] = React.useState(0);
  const startedAt = React.useRef<number | null>(null);

  const handleLoad = () => {
    startedAt.current = performance.now();
    setLoadedAt(null);
    setTrigger((n) => n + 1);
  };

  const handleReset = () => {
    setTrigger(0);
    setLoadedAt(null);
    startedAt.current = null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button onClick={handleLoad}>
          {t('pages.performance.lazyLoad.trigger')}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={trigger === 0}>
          {t('pages.performance.lazyLoad.reset')}
        </Button>
      </div>

      {loadedAt !== null && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('pages.performance.lazyLoad.elapsedLabel')}: {' '}
          <span className="font-mono">
            {(loadedAt - (startedAt.current ?? loadedAt)).toFixed(0)} ms
          </span>
        </p>
      )}

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        {trigger === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {/* Empty steady state — encourages the visitor to click the button. */}
            …
          </p>
        ) : (
          <React.Suspense fallback={<LazyFallback label={t('pages.performance.lazyLoad.loadingLabel')} />}>
            {/* `key={trigger}` forces the lazy component to remount each time
                the button is clicked again, so the fallback redisplays. */}
            <HeavyComponent
              key={trigger}
              onMount={() => setLoadedAt(performance.now())}
            />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}

function LazyFallback({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { LazyLoadDemo };
