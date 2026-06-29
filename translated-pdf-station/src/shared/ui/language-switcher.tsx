/**
 * @file language-switcher.tsx
 * @description Icon-only button that rotates through the supported
 * i18n locales.
 *
 * The button shows the *currently active* short code as text next to a
 * Globe glyph; clicking advances to the next entry in `SUPPORTED_LANGS`
 * and wraps around. Persistence is handled transparently by
 * `i18next-browser-languagedetector` (configured in
 * `src/shared/i18n/index.ts` with `caches: ['localStorage']`), so this
 * component never touches storage directly.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

// --- Absolute Imports ---
import { SUPPORTED_LANGS, type SupportedLang } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';

// =================================================================================================
// Helpers
// =================================================================================================

/**
 * Short label rendered inside the button next to the icon. Stays
 * deliberately compact (2 chars) so the header pill width matches the
 * neighbouring ThemeToggle icon button visually.
 */
const SHORT_LABEL: Record<SupportedLang, string> = {
  en: 'EN',
  zh: '中',
};

function nextLanguage(current: string): SupportedLang {
  const idx = (SUPPORTED_LANGS as readonly string[]).indexOf(current);
  // Wrap around; treat an unknown current language as "before index 0"
  // so a stray value lands on the first supported entry.
  const nextIdx = (idx + 1) % SUPPORTED_LANGS.length;
  return SUPPORTED_LANGS[nextIdx]!;
}

function isSupported(lng: string): lng is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng);
}

// =================================================================================================
// Component
// =================================================================================================

function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  // Normalise (e.g. `en-US` → `en`) before lookup so detector picks
  // like `en-GB` still render the right label.
  const base = i18n.language.split('-')[0] ?? i18n.language;
  const current: SupportedLang = isSupported(base) ? base : SUPPORTED_LANGS[0];
  const upcoming = nextLanguage(current);

  const action = t('actions.switchLanguage', {
    defaultValue: 'Switch language',
  });
  const currentName = t(`language.${current}`, { defaultValue: current });
  const upcomingName = t(`language.${upcoming}`, { defaultValue: upcoming });

  const handleClick = (): void => {
    void i18n.changeLanguage(upcoming);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label={`${action} (${currentName} → ${upcomingName})`}
      title={`${action} — ${upcomingName}`}
      className="app-nav-action gap-1.5 px-2"
    >
      <Languages aria-hidden="true" className="h-4 w-4" />
      <span className="text-xs font-medium">{SHORT_LABEL[current]}</span>
    </Button>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { LanguageSwitcher };
