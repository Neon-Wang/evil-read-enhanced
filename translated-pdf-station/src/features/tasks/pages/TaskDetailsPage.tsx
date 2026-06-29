/**
 * @file TaskDetailsPage.tsx
 * @description Route-level component for `/tasks/:id`.
 *
 * Prefers the memoized in-store lookup (`useTaskById`) for instant
 * paint; falls back to the action `getTaskById` when the user lands
 * here via a deep link and the store hasn't been hydrated yet.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useEffect, useState } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

// --- Third-party Libraries ---
import { AlertTriangle, Loader2 } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

// --- Relative Imports ---
import { TasksScreen } from '../components/TasksScreen';
import {
  useTaskActions,
  useTaskById,
  useTaskInitialized,
} from '../selectors';

import type { Task, TaskStatus } from '../types';

// =================================================================================================
// Constants
// =================================================================================================

// Mirrors the token-driven palette in TaskCard so the list and details
// views read as the same language across every design preset and dark
// mode (`--color-info` / `--color-success` already lift their lightness
// for `.dark`, so no manual `dark:` pairs are needed). Kept inline
// rather than extracted because three rows of constants is cheaper than
// a new module + import.
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

function TaskDetailsPage() {
  const { t, i18n } = useTranslation('tasks');


  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { initialize, getTaskById } = useTaskActions();
  const cached = useTaskById(id);
  const isInitialized = useTaskInitialized();

  const [task, setTask] = useState<Task | null>(cached ?? null);
  const [isFetching, setIsFetching] = useState(!cached);

  // Hydrate the list in the background so a Back-to-list click is
  // instant after a deep-link entry.
  useEffect(() => {
    if (!isInitialized) void initialize();
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (cached) {
      setTask(cached);
      setIsFetching(false);
      return;
    }
    let cancelled = false;
    if (!id) {
      setTask(null);
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    void getTaskById(id)
      .then((next) => {
        if (cancelled) return;
        setTask(next);
      })
      .finally(() => {
        if (cancelled) return;
        setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, cached, getTaskById]);

  return (
    <TasksScreen
      title={t('details.title')}
      actionLabel={t('details.back')}
      onAction={() => navigate('/tasks')}
    >
      {isFetching ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('details.loading')}
        </div>
      ) : !task ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <AlertTriangle className="h-10 w-10 text-[var(--color-muted-foreground)]/60" />
          <h3 className="text-lg font-medium">{t('details.notFound')}</h3>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('details.notFoundDescription')}
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader className="gap-2">
            {/* `items-start` so the badge anchors to the top edge when
             * the title wraps to two lines (long titles aren't truncated
             * here — this is the focused view). The badge gets `shrink-0`
             * + `whitespace-nowrap` so it never collapses or wraps when
             * the title line eats the row's intrinsic width. */}
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="min-w-0 flex-1 text-xl leading-snug">
                {task.title}
              </CardTitle>
              <span
                className={cn(
                  'app-badge inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
              <span>
                {t('details.id')}: <span className="font-mono">{task.id}</span>
              </span>
              <span>
                {t('details.createdAt')}:{' '}
                {new Date(task.createdAt).toLocaleString(i18n.language)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap leading-relaxed text-sm text-[var(--color-foreground)]">
            {task.description || '—'}
          </CardContent>
        </Card>
      )}
    </TasksScreen>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TaskDetailsPage };
