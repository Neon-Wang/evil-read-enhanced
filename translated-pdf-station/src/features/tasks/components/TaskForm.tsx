/**
 * @file TaskForm.tsx
 * @description Controlled title + description form used by TaskNewPage.
 *
 * Stateless: the parent owns the values and submission state. That
 * keeps the form trivially testable and reusable for edit flows later.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { type FormEvent } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { Loader2 } from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';

// =================================================================================================
// Types
// =================================================================================================

interface TaskFormProps {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

// =================================================================================================
// Constants
// =================================================================================================

const INPUT_CLASS =
  'w-full rounded-md border-[length:var(--surface-border-width)] border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm shadow-[var(--surface-inset-shadow)] ' +
  'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] ' +
  'transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

// =================================================================================================
// Component
// =================================================================================================

function TaskForm({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSubmit,
  isSubmitting = false,
}: TaskFormProps) {
  const { t } = useTranslation('tasks');


  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="task-title"
          className="block text-sm font-medium text-[var(--color-foreground)]"
        >
          {t('new.form.title')}
        </label>
        <input
          id="task-title"
          name="title"
          required
          value={title}
          disabled={isSubmitting}
          onChange={(e) => onTitleChange(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="task-description"
          className="block text-sm font-medium text-[var(--color-foreground)]"
        >
          {t('new.form.description')}
        </label>
        <textarea
          id="task-description"
          name="description"
          rows={4}
          value={description}
          disabled={isSubmitting}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="rounded-full">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting
          ? t('new.form.submitting')
          : t('new.form.submit')}
      </Button>
    </form>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { TaskForm };
export type { TaskFormProps };
