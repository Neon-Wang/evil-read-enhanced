/**
 * @file CardShowcase.tsx
 * @description Inline showcase of the three Card flavours that ship with
 * the template: plain, hoverable and structured (header + content + footer).
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardHoverableClass,
} from '@/shared/ui/card';

// =================================================================================================
// Component
// =================================================================================================

function CardShowcase() {
  const { t } = useTranslation('examples');


  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="p-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('sections.card.plainLabel')}
        </p>
        <p className="text-sm text-[var(--color-card-foreground)]">
          {t('sections.card.plainBody')}
        </p>
      </Card>

      <Card className={cn(cardHoverableClass, 'p-6')}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('sections.card.hoverableLabel')}
        </p>
        <p className="text-sm text-[var(--color-card-foreground)]">
          {t('sections.card.hoverableBody')}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('sections.card.structuredLabel')}
          </p>
          <CardTitle>{t('sections.card.structuredTitle')}</CardTitle>
          <CardDescription>{t('sections.card.structuredBody')}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-[var(--color-muted-foreground)]">
          shared/ui/card.tsx
        </CardContent>
        <CardFooter>
          <Button size="sm" variant="outline">
            {t('sections.card.structuredAction')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CardShowcase };
