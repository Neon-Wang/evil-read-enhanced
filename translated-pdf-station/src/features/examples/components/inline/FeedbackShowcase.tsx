/**
 * @file FeedbackShowcase.tsx
 * @description Inline showcase of the feedback / lightweight-overlay
 * primitives — Alert (the five semantic banners), Tooltip and Popover.
 * Tooltip wraps its own TooltipProvider so the demo is self-contained
 * regardless of whether the app shell already mounts one. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';

// --- Absolute Imports ---
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip';

// =================================================================================================
// Component
// =================================================================================================

function FeedbackShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-6">
      <Group label={t('sections.feedback.alertsLabel')}>
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>{t('sections.feedback.successTitle')}</AlertTitle>
          <AlertDescription>
            {t('sections.feedback.successBody')}
          </AlertDescription>
        </Alert>
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{t('sections.feedback.warningTitle')}</AlertTitle>
          <AlertDescription>
            {t('sections.feedback.warningBody')}
          </AlertDescription>
        </Alert>
        <Alert variant="info">
          <Info />
          <AlertTitle>{t('sections.feedback.infoTitle')}</AlertTitle>
          <AlertDescription>
            {t('sections.feedback.infoBody')}
          </AlertDescription>
        </Alert>
      </Group>

      <Group label={t('sections.feedback.overlaysLabel')}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">
                {t('sections.feedback.tooltipTrigger')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sections.feedback.tooltipBody')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              {t('sections.feedback.popoverTrigger')}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm font-medium">
              {t('sections.feedback.popoverTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {t('sections.feedback.popoverBody')}
            </p>
          </PopoverContent>
        </Popover>
      </Group>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { FeedbackShowcase };
