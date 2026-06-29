/**
 * @file router.tsx
 * @description Top-level <Routes> tree.
 *
 * Production app routes mount under `<RootLayout />`. The dev-only
 * component showcase mounts beside it so preview surfaces do not
 * inherit the main application navigation shell.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { Route, Routes } from 'react-router-dom';

// --- Absolute Imports ---
import { RootLayout } from '@/app/layouts/RootLayout';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { authRoutes } from '@/features/auth';
import { counterRoutes } from '@/features/counter';
import { examplesRoutes } from '@/features/examples';
import { homeRoutes } from '@/features/home';
import { tasksRoutes } from '@/features/tasks';

// =================================================================================================
// Component
// =================================================================================================

function AppRouter() {
  return (
    <Routes>
      {import.meta.env.DEV && examplesRoutes}
      <Route element={<RootLayout />}>
        {homeRoutes}
        {counterRoutes}
        {tasksRoutes}
        {authRoutes}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { AppRouter };
