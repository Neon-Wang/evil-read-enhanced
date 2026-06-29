/**
 * @file DividerShowcase.tsx
 * @description Inline showcase of the Separator ("Divider") primitive in
 * both horizontal and vertical orientations. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Separator } from '@/shared/ui/separator';

// =================================================================================================
// Component
// =================================================================================================

function DividerShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{t('sections.divider.heading')}</p>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('sections.divider.body')}
        </p>
      </div>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-sm text-[var(--color-muted-foreground)]">
        <span>{t('sections.divider.blog')}</span>
        <Separator orientation="vertical" />
        <span>{t('sections.divider.docs')}</span>
        <Separator orientation="vertical" />
        <span>{t('sections.divider.source')}</span>
      </div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { DividerShowcase };
