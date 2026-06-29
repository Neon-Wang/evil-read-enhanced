// @eikon:variant(layout=sidebar) file
/**
 * @file SidebarRootLayout.tsx
 * @description Fixed left sidebar layout: a 240-px-wide vertical rail owns
 * the brand, the primary navigation, and the user/theme/locale actions; the
 * main column fills the remaining width. Best for admin consoles, SaaS
 * dashboards, and any "tool" app where navigation is the spine of the
 * experience (Linear, Notion, Supabase Studio, …).
 *
 * One of the seven layout variants selected via `--layout` at scaffold time;
 * the dispatcher at `./RootLayout.tsx` re-exports whichever variant won.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { Suspense } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';

// --- Absolute Imports ---
import { SignInButton } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { navLinks } from '@/shared/nav';
import { LanguageSwitcher } from '@/shared/ui/language-switcher';
import { ThemeToggle } from '@/shared/ui/theme-toggle';

// =================================================================================================
// Component
// =================================================================================================

function SidebarRootLayout() {
  const { t } = useTranslation();


  return (
    <div className="flex min-h-[100dvh]">
      {/*
        The sidebar is a real flex column rather than a positioned overlay —
        sticky positioning keeps it visible while the main column scrolls,
        and `shrink-0` prevents it from collapsing on narrow content. Adjust
        `w-60` if your nav grows or you need a denser rail.
      */}
      <aside
        className={cn(
          'app-nav-shell app-nav-side sticky top-0 flex h-[100dvh] w-60 shrink-0 flex-col',
          'border-r-[length:var(--surface-border-width)] border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)]/70 text-[var(--color-sidebar-foreground)] backdrop-blur'
        )}
      >
        <div className="flex h-14 items-center border-b-[length:var(--surface-border-width)] border-[var(--color-sidebar-border)] px-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Eikon App
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'app-nav-link rounded-md px-3 py-2 text-sm transition-colors',
                  'text-[var(--color-muted-foreground)] hover:bg-[var(--color-sidebar-primary)]/8 hover:text-[var(--color-sidebar-foreground)]',
                  isActive &&
                    'app-nav-link-active bg-[var(--color-sidebar-primary)]/12 text-[var(--color-sidebar-primary)]'
                )
              }
            >
              {t(link.key, { defaultValue: link.fallback })}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-1 border-t-[length:var(--surface-border-width)] border-[var(--color-sidebar-border)] p-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <SignInButton />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-8">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function RouteFallback() {
  return (
    <div
      aria-hidden="true"
      className="h-32 w-full animate-pulse rounded-md bg-[var(--color-muted)]/40"
    />
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { SidebarRootLayout };
