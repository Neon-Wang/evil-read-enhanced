/**
 * @file ProgressShowcase.tsx
 * @description Inline showcase of the Progress bar — labelled values and
 * the three track sizes. Pure style demo, no app state.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Progress } from '@/shared/ui/progress';

// =================================================================================================
// Component
// =================================================================================================

function ProgressShowcase() {
  const { t } = useTranslation('examples');

  const rows: { label: string; value: number }[] = [
    { label: t('sections.progress.uploading'), value: 25 },
    { label: t('sections.progress.processing'), value: 60 },
    { label: t('sections.progress.almost'), value: 92 },
    { label: t('sections.progress.done'), value: 100 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-md flex-col gap-4">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{r.label}</span>
              <span className="text-[var(--color-muted-foreground)]">
                {r.value}%
              </span>
            </div>
            <Progress value={r.value} />
          </div>
        ))}
      </div>

      <div className="flex max-w-md flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('sections.progress.sizesLabel')}
        </p>
        <Progress value={50} size="sm" />
        <Progress value={50} size="md" />
        <Progress value={50} size="lg" />
      </div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ProgressShowcase };
