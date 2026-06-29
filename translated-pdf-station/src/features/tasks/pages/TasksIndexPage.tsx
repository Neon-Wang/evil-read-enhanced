/**
 * @file TasksIndexPage.tsx
 * @description Route-level component for `/tasks`.
 *
 * Reads tasks list state via selectors, fires `initialize` once on
 * mount, and renders TaskCards inside TasksScreen. All write ops go
 * through the `useTaskActions` bundle.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useEffect } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// --- Third-party Libraries ---
import { Loader2 } from 'lucide-react';

// --- Absolute Imports ---
import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import { TaskCard } from '../components/TaskCard';
import { TasksScreen } from '../components/TasksScreen';
import {
  useTaskActions,
  useTaskError,
  useTaskInitialized,
  useTaskLoading,
  useTasks,
} from '../selectors';

// =================================================================================================
// Component
// =================================================================================================

function TasksIndexPage() {
  const { t } = useTranslation('tasks');


  const navigate = useNavigate();
  const tasks = useTasks();
  const isLoading = useTaskLoading();
  const isInitialized = useTaskInitialized();
  const error = useTaskError();
  const { initialize, deleteTask } = useTaskActions();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // The delete flow lives here (not in TaskCard) so the card stays a
  // pure presentational component: it owns the confirmation dialog UX
  // but delegates the store mutation + toast feedback up. Errors are
  // re-thrown so the card keeps the dialog open and the user can retry.
  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      toast.success(t('delete.doneToast'));
    } catch (e) {
      toast.error(t('delete.errorToast'));
      throw e;
    }
  };

  return (
    <TasksScreen
      title={t('index.title')}
      actionLabel={t('index.new')}
      onAction={() => navigate('/tasks/new')}
    >
      {!isInitialized || isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('index.loading')}
        </div>
      ) : error ? (
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('index.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                onClick={() => navigate(`/tasks/${task.id}`)}
                onDelete={() => handleDelete(task.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </TasksScreen>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TasksIndexPage };
