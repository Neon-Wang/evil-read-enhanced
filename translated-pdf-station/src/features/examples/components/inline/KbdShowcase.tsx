/**
 * @file KbdShowcase.tsx
 * @description Inline showcase of the Kbd key-cap chip — standalone caps
 * and a few common shortcut combinations. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Kbd } from '@/shared/ui/kbd';

// =================================================================================================
// Component
// =================================================================================================

function KbdShowcase() {
  const { t } = useTranslation('examples');

  const shortcuts: { label: string; keys: string[] }[] = [
    { label: t('sections.kbd.commandPalette'), keys: ['⌘', 'K'] },
    { label: t('sections.kbd.save'), keys: ['⌘', 'S'] },
    { label: t('sections.kbd.search'), keys: ['/'] },
    { label: t('sections.kbd.close'), keys: ['Esc'] },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Kbd>⌘</Kbd>
        <Kbd>⇧</Kbd>
        <Kbd>⌥</Kbd>
        <Kbd>↵</Kbd>
        <Kbd>Esc</Kbd>
        <Kbd>Tab</Kbd>
      </div>

      <ul className="flex max-w-sm flex-col gap-2 text-sm">
        {shortcuts.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="text-[var(--color-muted-foreground)]">
              {s.label}
            </span>
            <span className="flex items-center gap-1">
              {s.keys.map((k, i) => (
                <Kbd key={`${s.label}-${i}`}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { KbdShowcase };
