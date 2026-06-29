/**
 * @file ButtonShowcase.tsx
 * @description Inline showcase of every Button variant, size and state.
 *
 * Renders three sub-grids — variants, sizes, states — plus an asChild
 * link demo to underline that the primitive can render as any element
 * while keeping the styling.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { ArrowRight, Loader2, Sparkles, Trash2 } from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';

// =================================================================================================
// Component
// =================================================================================================

function ButtonShowcase() {
  const { t } = useTranslation('examples');


  return (
    <div className="flex flex-col gap-6">
      <Group label={t('sections.button.variantsLabel')}>
        <Button>
          <Sparkles className="h-4 w-4" />
          Default
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" />
          Destructive
        </Button>
        <Button variant="link">Link</Button>
      </Group>

      <Group label={t('sections.button.sizesLabel')}>
        <Button size="sm">Small</Button>
        <Button size="default">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="icon-only">
          <Sparkles className="h-4 w-4" />
        </Button>
      </Group>

      <Group label={t('sections.button.statesLabel')}>
        <Button disabled>{t('sections.button.disabledLabel')}</Button>
        <Button disabled>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('sections.button.loadingLabel')}
        </Button>
      </Group>

      <Group label={t('sections.button.asChildLabel')}>
        {/*
          asChild forwards the styling onto whatever element you wrap.
          Here we render a real <a> with target="_blank" so it announces
          itself as a link to assistive tech while keeping all the
          motion + variant chrome.
        */}
        <Button asChild>
          <a href="https://github.com/fmw666/eikon-react" target="_blank" rel="noreferrer noopener">
            {t('sections.button.asChildLink')}
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
        <span className="self-center text-xs text-[var(--color-muted-foreground)]">
          {t('sections.button.asChildHint')}
        </span>
      </Group>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ButtonShowcase };
