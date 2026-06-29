/**
 * @file routes.tsx
 * @description Route declarations for the Auth feature.
 *
 * Auth is surfaced as a global modal (`<SignInModalMount />`) mounted
 * once at provider scope — there are no auth-owned pages today, so
 * this export is an empty fragment. The contract of "every feature
 * has a routes definition" still holds: `authRoutes` is mountable
 * inside the router tree, it just contributes zero routes.
 *
 * If you later add auth-owned pages (e.g. `/auth/callback`, an
 * account profile page, a verify-email page), declare them here as
 * `<Route ... />` siblings and the app router will pick them up via
 * the existing `{authRoutes}` mount point. Lazy-load each page the
 * same way `features/tasks/routes.tsx` does to keep the auth
 * implementation off the initial bundle.
 */

// =================================================================================================
// Exports
// =================================================================================================

export const authRoutes = <></>;
