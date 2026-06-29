/**
 * @file DataDisplayShowcase.tsx
 * @description Inline showcase of the read-only "data display" primitives —
 * Badge (status chips), Avatar (image + initials fallback) and Skeleton
 * (loading placeholders). Pure style demo, no app state.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';

// =================================================================================================
// Component
// =================================================================================================

function DataDisplayShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-6">
      <Group label={t('sections.data.badgesLabel')}>
        <Badge>{t('sections.data.badgeDefault')}</Badge>
        <Badge variant="secondary">{t('sections.data.badgeSecondary')}</Badge>
        <Badge variant="outline">{t('sections.data.badgeOutline')}</Badge>
        <Badge variant="success">{t('sections.data.badgeSuccess')}</Badge>
        <Badge variant="warning">{t('sections.data.badgeWarning')}</Badge>
        <Badge variant="info">{t('sections.data.badgeInfo')}</Badge>
        <Badge variant="destructive">
          {t('sections.data.badgeDestructive')}
        </Badge>
      </Group>

      <Group label={t('sections.data.avatarsLabel')}>
        <Avatar>
          <AvatarImage
            src="https://github.com/fmw666.png"
            alt={t('sections.data.avatarAlt')}
          />
          <AvatarFallback>EK</AvatarFallback>
        </Avatar>
        <Avatar>
          {/* No image src → the initials fallback is what renders. */}
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <Avatar className="h-12 w-12">
          <AvatarFallback>动森</AvatarFallback>
        </Avatar>
      </Group>

      <Group label={t('sections.data.skeletonLabel')}>
        <div className="flex w-full max-w-sm items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
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

export { DataDisplayShowcase };
