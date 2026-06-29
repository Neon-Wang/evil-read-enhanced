/**
 * @file TypewriterShowcase.tsx
 * @description Inline showcase of the Typewriter primitive — a heading
 * with a cycling typed phrase. Pure style demo (falls back to static text
 * under prefers-reduced-motion).
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Typewriter } from '@/shared/ui/typewriter';

// =================================================================================================
// Component
// =================================================================================================

function TypewriterShowcase() {
  const { t } = useTranslation('examples');

  const words = [
    t('sections.typewriter.word1'),
    t('sections.typewriter.word2'),
    t('sections.typewriter.word3'),
  ];

  return (
    <p className="text-lg font-medium text-[var(--color-foreground)] sm:text-xl">
      {t('sections.typewriter.lead')}{' '}
      <Typewriter words={words} className="text-[var(--color-primary)]" />
    </p>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TypewriterShowcase };
