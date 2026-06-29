/**
 * @file routes.tsx
 * @description Route declarations for the Tasks feature.
 *
 * Lazy-loaded so each page lands in its own chunk; the shared
 * <Suspense> boundary in RootLayout provides the fallback.
 *
 * Every page chunk fetches the shared `tasks` i18n namespace in
 * parallel — the bundle download is concurrent with the JS chunk
 * download, so cold navigation into `/tasks` only pays for the
 * slower of the two round trips. The namespace is shared across all
 * Tasks pages, so the second visit (`/tasks/:id`) reuses the already
 * cached bundle.
 *
 * Order matters: keep `/tasks/new` ABOVE `/tasks/:id` so the literal
 * path wins the match (react-router v7 still walks definition order
 * for non-tied scores).
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { lazy } from 'react';

// --- Core-related Libraries ---
import { Route } from 'react-router-dom';

// --- Absolute Imports ---
import { loadNamespace } from '@/shared/i18n';

// =================================================================================================
// Lazy pages
// =================================================================================================

const TasksIndexPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/TasksIndexPage'),
    loadNamespace('tasks'),
  ]);
  return { default: mod.TasksIndexPage };
});
const TaskNewPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/TaskNewPage'),
    loadNamespace('tasks'),
  ]);
  return { default: mod.TaskNewPage };
});
const TaskDetailsPage = lazy(async () => {
  const [mod] = await Promise.all([
    import('./pages/TaskDetailsPage'),
    loadNamespace('tasks'),
  ]);
  return { default: mod.TaskDetailsPage };
});

// =================================================================================================
// Exports
// =================================================================================================

export const tasksRoutes = (
  <>
    <Route path="/tasks" element={<TasksIndexPage />} />
    <Route path="/tasks/new" element={<TaskNewPage />} />
    <Route path="/tasks/:id" element={<TaskDetailsPage />} />
  </>
);
