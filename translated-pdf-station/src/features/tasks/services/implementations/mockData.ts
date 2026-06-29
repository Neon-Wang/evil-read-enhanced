/**
 * @file mockData.ts
 * @description Seed data for the in-memory Mock task service.
 *
 * Kept private to the implementations folder — production code should
 * never reach into it. Tests may import it for arrange / reset.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Relative Imports ---
import type { Task } from '../../types';

// =================================================================================================
// Seed Data
// =================================================================================================

const SAMPLE_TASKS: Task[] = [
  {
    id: 'demo-1',
    title: 'Read the Eikon README',
    description:
      'Skim packages/template-react/README and the .agent/rules folder to see what conventions this template ships with.',
    status: 'in_progress',
    createdAt: new Date('2026-05-19T08:00:00Z').toISOString(),
  },
  {
    id: 'demo-2',
    title: 'Wire up your Supabase project',
    description:
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then create a `tasks` table to swap the mock service for real data.',
    status: 'pending',
    createdAt: new Date('2026-05-19T08:15:00Z').toISOString(),
  },
  {
    id: 'demo-3',
    title: 'Add your first feature',
    description:
      'Copy the shape of src/features/tasks into src/features/<your-feature> and you have a routed, typed, tested module.',
    status: 'completed',
    createdAt: new Date('2026-05-19T08:30:00Z').toISOString(),
  },
];

// =================================================================================================
// Exports
// =================================================================================================

export { SAMPLE_TASKS };
