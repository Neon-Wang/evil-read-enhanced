/**
 * @file TaskNewPage.tsx
 * @description Route-level component for `/tasks/new`.
 *
 * Owns transient form state locally (useState — per the i18n /
 * state-management rules, transient form state stays out of the
 * store). Persistence flows through the `addTask` action; success
 * toasts via the shared `toast` helper.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { useState } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// --- Absolute Imports ---
import { toast } from '@/shared/ui/toaster';

// --- Relative Imports ---
import { TaskForm } from '../components/TaskForm';
import { TasksScreen } from '../components/TasksScreen';
import { useTaskActions } from '../selectors';

// =================================================================================================
// Component
// =================================================================================================

function TaskNewPage() {
  const { t } = useTranslation('tasks');


  const navigate = useNavigate();
  const { addTask } = useTaskActions();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    setIsSubmitting(true);
    try {
      await addTask({ title, description });
      toast.success(t('new.created'));
      navigate('/tasks');
    } catch (e) {
      toast.error(t('new.error'), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <TasksScreen
      title={t('new.title')}
      actionLabel={t('new.back')}
      onAction={() => navigate('/tasks')}
    >
      <TaskForm
        title={title}
        description={description}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </TasksScreen>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TaskNewPage };
