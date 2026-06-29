/**
 * @file tasksService.ts
 * @description Public facade for the Tasks data layer.
 *
 * Business code (store, hooks, components) imports `tasksService` from
 * here — never the implementations or the factory directly. That gives
 * the factory a single point of swap (Mock vs Supabase) and keeps the
 * call site free of conditionals.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Relative Imports ---
import { tasksServiceFactory } from './factory/tasksServiceFactory';

// =================================================================================================
// Service Instance
// =================================================================================================

export const tasksService = tasksServiceFactory.getTasksService();
