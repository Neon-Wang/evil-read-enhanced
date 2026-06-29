/**
 * @file TaskCard.tsx
 * @description Compact card for a single task in the index list.
 *
 * Surfaces title, description and a translated status badge. Activates
 * via mouse click or keyboard (Enter / Space) when `onClick` is given.
 *
 * When `onDelete` is supplied, the card additionally renders a Trash icon
 * button in the header row that opens a destructive confirmation dialog;
 * confirming awaits the parent-supplied callback (the parent typically
 * pairs it with `useTaskActions().deleteTask` + a success toast). The
 * trash button stops propagation so it never triggers the card's own
 * `onClick` navigation.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { ChevronRight, Loader2, Trash2 } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Card, cardHoverableClass } from '@/shared/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

// --- Relative Imports ---
import type { Task, TaskStatus } from '../types';

// =================================================================================================
// Types
// =================================================================================================

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  /**
   * Intent callback fired AFTER the user confirms deletion in the
   * built-in confirmation dialog. The card owns the dialog UI and the
   * pending state; the parent owns the actual store mutation + any
   * post-delete side effects (toast, navigation, …).
   *
   * If the callback throws / rejects, the dialog stays open so the user
   * can retry or cancel; the card simply clears its own busy flag.
   */
  onDelete?: () => void | Promise<void>;
  className?: string;
}

// =================================================================================================
// Constants
// =================================================================================================

// Status palette is fully token-driven so every design preset (vercel,
// linear, anthropic, …) and dark mode adapt automatically — `--color-info`
// already lifts its lightness in dark, no manual `dark:` pairs needed.
const STATUS_CLASS: Record<TaskStatus, string> = {
  pending:
    'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] ring-[var(--color-border)]',
  in_progress:
    'bg-[var(--color-info)]/12 text-[var(--color-info)] ring-[var(--color-info)]/30',
  completed:
    'bg-[var(--color-success)]/12 text-[var(--color-success)] ring-[var(--color-success)]/30',
};

// =================================================================================================
// Component
// =================================================================================================

function TaskCard({ task, onClick, onDelete, className }: TaskCardProps) {
  const { t } = useTranslation('tasks');


  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch {
      // Swallow here so the dialog stays open; the parent already owns
      // any user-facing error reporting (toast, inline message, …).
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (!onClick) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          // The hover surface is shadow-lift + a subtle border tint, NOT
          // an `--color-accent` flip. Flipping the card surface fights
          // the static status-badge palette (suddenly the badge sits on
          // a tinted bg) and reads as "selected" rather than "hovered".
          'group relative transition-[border-color,box-shadow] duration-200',
          onClick &&
            cn(
              cardHoverableClass,
              'cursor-pointer hover:border-[var(--color-foreground)]/15 focus-visible:border-[var(--color-foreground)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
            ),
          !onClick && 'cursor-default',
          className
        )}
      >
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold leading-snug tracking-tight">
                {task.title}
              </h3>
              <span
                className={cn(
                  'app-badge inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-medium leading-4 ring-1 ring-inset',
                  STATUS_CLASS[task.status]
                )}
              >
                <span
                  aria-hidden="true"
                  className="app-badge-dot h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
                />
                {t(`status.${task.status}`)}
              </span>
            </div>
            {task.description && (
              <p className="line-clamp-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 self-start">
            {onDelete && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t('delete.button')}
                className="h-7 w-7 opacity-60 transition-[opacity,colors] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onClick && (
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 -translate-x-1 text-[var(--color-muted-foreground)] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
              />
            )}
          </div>
        </div>
      </Card>

      {onDelete && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('delete.confirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('delete.confirmBody', { title: task.title })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isDeleting}>
                  {t('delete.cancel')}
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('delete.confirm')}
                  </>
                ) : (
                  t('delete.confirm')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TaskCard };
export type { TaskCardProps };
