/**
 * @file TitleShowcase.tsx
 * @description Inline showcase of the Heading ("Title") primitive — the
 * size ramp plus the semantic-level / visual-size decoupling. Pure style
 * demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Heading } from '@/shared/ui/heading';

// =================================================================================================
// Component
// =================================================================================================

function TitleShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-4">
      <Heading as={2} size="2xl">
        {t('sections.title.sample2xl')}
      </Heading>
      <Heading as={2} size="xl">
        {t('sections.title.sampleXl')}
      </Heading>
      <Heading as={3} size="lg">
        {t('sections.title.sampleLg')}
      </Heading>
      <Heading as={4} size="md">
        {t('sections.title.sampleMd')}
      </Heading>
      <Heading as={5} size="sm">
        {t('sections.title.sampleSm')}
      </Heading>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TitleShowcase };
