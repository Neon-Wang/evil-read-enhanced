/**
 * @file ThemeShowcase.tsx
 * @description Inline showcase of the design-token surface. Displays
 * a live readout of the current theme preference + a swatch grid for
 * every `--color-*` token that the template ships.
 *
 * Each swatch paints with the matching CSS custom property so the
 * grid flips in lock-step with the theme toggle in the header.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { useThemeStore } from '@/shared/theme';

// =================================================================================================
// Constants
// =================================================================================================

interface SwatchSpec {
  token: string;
  /** Optional matching foreground token; renders the swatch label in it. */
  fg?: string;
}

const SWATCHES: SwatchSpec[] = [
  { token: 'primary', fg: 'primary-foreground' },
  { token: 'secondary', fg: 'secondary-foreground' },
  { token: 'accent', fg: 'accent-foreground' },
  { token: 'destructive', fg: 'destructive-foreground' },
  { token: 'muted', fg: 'muted-foreground' },
  { token: 'card', fg: 'card-foreground' },
  { token: 'background', fg: 'foreground' },
  { token: 'border' },
];

// =================================================================================================
// Component
// =================================================================================================

function ThemeShowcase() {
  const { t } = useTranslation('examples');


  const theme = useThemeStore((s) => s.theme);
  const resolved = useThemeStore((s) => s.resolvedTheme);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('sections.theme.preferred')}
          </dt>
          <dd className="font-mono text-sm">{theme}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('sections.theme.resolved')}
          </dt>
          <dd className="font-mono text-sm">{resolved}</dd>
        </div>
      </dl>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('sections.theme.swatchesLabel')}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SWATCHES.map((s) => (
            <Swatch key={s.token} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function Swatch({ token, fg }: SwatchSpec) {
  return (
    <div
      className="flex h-16 items-end justify-between rounded-md border border-[var(--color-border)] p-2 text-xs"
      // Inline `style` so each swatch references its OWN token — using a
      // dynamic Tailwind class doesn't work because the class name isn't
      // statically extractable at build time.
      style={{
        backgroundColor: `var(--color-${token})`,
        color: fg ? `var(--color-${fg})` : undefined,
      }}
    >
      <span className="font-mono">{token}</span>
      {fg && <span className="font-mono opacity-70">/{fg.replace('-foreground', '')}</span>}
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ThemeShowcase };
