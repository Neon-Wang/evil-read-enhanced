/**
 * @file authService.ts
 * @description Public facade for the Auth data layer.
 *
 * Business code (store, hooks, components) imports `authService` from
 * here — never the implementations or the factory directly. Same
 * convention as `tasksService`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Relative Imports ---
import { authServiceFactory } from './factory/authServiceFactory';

// =================================================================================================
// Service Instance
// =================================================================================================

export const authService = authServiceFactory.getAuthService();
