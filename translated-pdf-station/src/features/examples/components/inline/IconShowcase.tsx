/**
 * @file IconShowcase.tsx
 * @description Inline showcase of the icon system. The template uses
 * `lucide-react` as its icon set — this demos a small gallery at the
 * common sizes plus the semantic colour tints. Pure style demo.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import {
  Bell,
  Bookmark,
  Calendar,
  Check,
  Cloud,
  Heart,
  Home,
  Search,
  Settings,
  Star,
  Trash2,
  User,
} from 'lucide-react';

// =================================================================================================
// Component
// =================================================================================================

const ICONS = [
  Home,
  Search,
  Settings,
  Bell,
  User,
  Calendar,
  Star,
  Heart,
  Bookmark,
  Cloud,
  Check,
  Trash2,
];

function IconShowcase() {
  const { t } = useTranslation('examples');

  return (
    <div className="flex flex-col gap-6">
      <Group label={t('sections.icon.galleryLabel')}>
        {ICONS.map((Icon, i) => (
          <Icon key={i} className="h-5 w-5 text-[var(--color-foreground)]" />
        ))}
      </Group>

      <Group label={t('sections.icon.sizesLabel')}>
        <Star className="h-4 w-4 text-[var(--color-foreground)]" />
        <Star className="h-5 w-5 text-[var(--color-foreground)]" />
        <Star className="h-6 w-6 text-[var(--color-foreground)]" />
        <Star className="h-8 w-8 text-[var(--color-foreground)]" />
      </Group>

      <Group label={t('sections.icon.colorsLabel')}>
        <Heart className="h-6 w-6 text-[var(--color-primary)]" />
        <Check className="h-6 w-6 text-[var(--color-success)]" />
        <Bell className="h-6 w-6 text-[var(--color-warning)]" />
        <Trash2 className="h-6 w-6 text-[var(--color-destructive)]" />
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
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { IconShowcase };
