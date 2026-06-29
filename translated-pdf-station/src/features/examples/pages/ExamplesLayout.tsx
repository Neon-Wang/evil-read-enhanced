/**
 * @file ExamplesLayout.tsx
 * @description Standalone shell route for the dev-only `/examples` area.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { Suspense, useEffect } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

// --- Third-party Libraries ---
import { ArrowLeft, Sparkles } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';

// --- Relative Imports ---
import { ExamplesSidebar } from '../components/ExamplesSidebar';
import { ExamplesTopNav } from '../components/ExamplesTopNav';
import { getNeighbours } from '../components/sectionMeta';

// =================================================================================================
// Component
// =================================================================================================

function ExamplesLayout() {
  const { t } = useTranslation('examples');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    function isTypingInForm(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== '[' && e.key !== ']') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingInForm(e.target)) return;
      const slug = pathname.split('/').filter(Boolean).at(-1);
      if (!slug || slug === 'examples') return;
      const { prev, next } = getNeighbours(slug);
      const target = e.key === '[' ? prev : next;
      if (!target) return;
      e.preventDefault();
      navigate(`/examples/${target.slug}`);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pathname, navigate]);

  return (
    <div className="min-h-[100dvh] bg-[var(--color-background)] text-[var(--color-foreground)]">
      <header
        className={cn(
          'sticky top-0 z-30 border-b-[length:var(--surface-border-width)] border-[var(--color-border)]',
          'bg-[var(--color-background)]/90 backdrop-blur'
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                {t('meta.backToApp')}
              </Link>
            </Button>
            <div className="hidden min-w-0 items-center gap-2 border-l border-[var(--color-border)] pl-3 sm:flex">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[var(--color-warning)]"
              />
              <span className="truncate text-sm font-semibold">
                {t('meta.title')}
              </span>
            </div>
          </div>
          <span
            role="status"
            className="app-badge inline-flex items-center gap-1 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-warning)]"
          >
            <Sparkles aria-hidden="true" className="h-3 w-3 shrink-0" />
            {t('meta.devOnlyBadge')}
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside
          aria-label={t('toc.label')}
          className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-3"
        >
          <ExamplesSidebar />
        </aside>

        <main className="min-w-0">
          <div className="lg:hidden">
            <ExamplesTopNav />
          </div>

          <div className="mb-6 flex items-center gap-2 text-[11px] text-[var(--color-muted-foreground)]">
            <span className="font-medium uppercase tracking-[0.08em]">
              {t('meta.devOnlyNotice')}
            </span>
          </div>

          <div className="w-full max-w-5xl">
            <Suspense
              fallback={
                <div className="flex min-h-40 items-center justify-center text-[var(--color-muted-foreground)]">
                  <Spinner size="lg" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ExamplesLayout };
