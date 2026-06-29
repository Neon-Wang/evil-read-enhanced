/**
 * @file LoadingShowcase.tsx
 * @description Inline showcase of the loading primitives — the Spinner at
 * three sizes, a spinner inside a Button, and a Skeleton placeholder row.
 * Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Spinner } from '@/shared/ui/spinner';

// =================================================================================================
// Component
// =================================================================================================

function LoadingShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-6">
      <Group label={t('sections.loading.spinnerLabel')}>
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
      </Group>

      <Group label={t('sections.loading.inlineLabel')}>
        <Button disabled>
          <Spinner size="sm" />
          {t('sections.loading.buttonLabel')}
        </Button>
        <span className="inline-flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Spinner size="sm" />
          {t('sections.loading.textLabel')}
        </span>
      </Group>

      <Group label={t('sections.loading.skeletonLabel')}>
        <div className="flex w-full max-w-sm items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
      </Group>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { LoadingShowcase };
