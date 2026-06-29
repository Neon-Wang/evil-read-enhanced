/**
 * @file CursorShowcase.tsx
 * @description Inline showcase of cursor affordances. Hovering each tile
 * swaps the pointer to the labelled CSS `cursor` value — the same
 * vocabulary you reach for to signal interactivity. Pure style demo.
 *
 * (Design presets may additionally theme the cursor — e.g. the
 * animal-crossing preset swaps in a custom hand pointer globally.)
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// =================================================================================================
// Component
// =================================================================================================

const CURSORS = [
  'cursor-pointer',
  'cursor-text',
  'cursor-move',
  'cursor-grab',
  'cursor-help',
  'cursor-wait',
  'cursor-not-allowed',
  'cursor-zoom-in',
] as const;

function CursorShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('sections.cursor.hint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {CURSORS.map((c) => (
          <div
            key={c}
            className={`${c} flex h-16 w-28 items-center justify-center rounded-md border-[length:var(--surface-border-width)] border-[var(--color-border)] bg-[var(--color-card)] text-xs font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]`}
          >
            {c.replace('cursor-', '')}
          </div>
        ))}
      </div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CursorShowcase };
