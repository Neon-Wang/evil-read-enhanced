/**
 * @file TasksScreen.tsx
 * @description Shared layout shell for every Tasks page.
 *
 * Renders the title row with a pill-shaped action button on the right
 * plus the amber Mock/Supabase notice that explains which backend the
 * page is talking to. v1's `TaskLayout` rolled this into the page; we
 * expose it as a component so callers can wrap a <Suspense> or
 * <Outlet/> without paying for an extra route element.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import type { ReactNode } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Absolute Imports ---
import { serviceConfig } from '@/shared/services';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';

// =================================================================================================
// Types
// =================================================================================================

interface TasksScreenProps {
  title: string;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
  className?: string;
}

// =================================================================================================
// Component
// =================================================================================================

function TasksScreen({
  title,
  actionLabel,
  onAction,
  children,
  className,
}: TasksScreenProps) {
  const { t } = useTranslation('tasks');


  const isOnline = !serviceConfig.useMock;
  const modeLabel = isOnline
    ? t('layout.modeSupabase')
    : t('layout.modeMock');

  return (
    <section className={cn('mx-auto w-full max-w-2xl', className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Button onClick={onAction} className="rounded-full">
          {actionLabel}
        </Button>
      </div>

      {/* Backend-mode notice. Token-driven so every design preset re-tints
       * the warning band in lock-step with its palette (anthropic warm,
       * vercel monochrome, neo-brutalism saturated). The translucent
       * `/8` fill stays legible on both light and dark surfaces because
       * `--color-warning` already lifts its lightness for `.dark`. */}
      <div className="mb-6 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 px-3 py-2 text-[var(--color-foreground)]">
        <p className="text-sm font-medium">{t('layout.notice')}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <span>{t('layout.mode')}</span>
          <span
            className={cn(
              'app-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
              isOnline
                ? 'bg-[var(--color-success)]/12 text-[var(--color-success)] ring-[var(--color-success)]/30'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] ring-[var(--color-border)]'
            )}
          >
            {modeLabel}
          </span>
        </div>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TasksScreen };
export type { TasksScreenProps };
