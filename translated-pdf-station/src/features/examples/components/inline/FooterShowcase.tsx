/**
 * @file FooterShowcase.tsx
 * @description Inline showcase of the Footer primitive — link row on the
 * left, copyright pinned to the end. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Footer } from '@/shared/ui/footer';

// =================================================================================================
// Component
// =================================================================================================

function FooterShowcase() {
  const { t } = useTranslation('examples');

  const links = [
    t('sections.footer.about'),
    t('sections.footer.docs'),
    t('sections.footer.privacy'),
    t('sections.footer.contact'),
  ];

  return (
    <Footer
      className="py-0"
      copyright={t('sections.footer.copyright', {
        year: new Date().getFullYear(),
      })}
    >
      {links.map((label) => (
        <span
          key={label}
          className="cursor-pointer transition-colors hover:text-[var(--color-foreground)]"
        >
          {label}
        </span>
      ))}
    </Footer>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { FooterShowcase };
