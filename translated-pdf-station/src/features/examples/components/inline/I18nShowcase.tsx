/**
 * @file I18nShowcase.tsx
 * @description Inline showcase of the per-feature i18n contract. Lists
 * the active language + a sample copy block that re-renders the moment
 * the user toggles the LanguageSwitcher in the header.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// =================================================================================================
// Component
// =================================================================================================

function I18nShowcase() {
  const { t, i18n } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('sections.i18n.currentLanguage')}
        </span>
        <code className="rounded bg-[var(--color-muted)] px-2 py-0.5 font-mono text-xs">
          {i18n.language}
        </code>
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {t('sections.i18n.tryItHint')}
      </p>
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
        <h3 className="mb-1 text-sm font-medium">
          {t('sections.i18n.sampleHeading')}
        </h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('sections.i18n.sampleBody')}
        </p>
      </div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { I18nShowcase };
