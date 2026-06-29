/**
 * @file HomePage.tsx
 * @description Marketing landing page for the template — surfaces the
 * project conventions (feature-first, .agent protocol, modern tooling)
 * and routes to the demos.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// --- Third-party Libraries ---
import { ArrowRight } from 'lucide-react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  cardHoverableClass,
} from '@/shared/ui/card';

// =================================================================================================
// Component
// =================================================================================================

function HomePage() {
  // Bind to the per-feature namespace; the bundle is fetched lazily
  // via routes.tsx's `loadNamespace('home')` call (in parallel with
  // the page chunk), so by the time we render it's resident.
  const { t } = useTranslation('home');


  return (
    <section className="flex flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-lg text-base text-[var(--color-muted-foreground)]">
        {t('subtitle')}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/counter">
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="https://github.com/fmw666/eikon-react" target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
        </Button>
      </div>

      <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
        <Card className={cardHoverableClass}>
          <CardHeader>
            <CardTitle>Feature-first</CardTitle>
            <CardDescription>
              Each feature owns its components, hooks, store, services and tests.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={cardHoverableClass}>
          <CardHeader>
            <CardTitle>.agent protocol</CardTitle>
            <CardDescription>
              Portable rules and skills any AI coding agent can read.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={cardHoverableClass}>
          <CardHeader>
            <CardTitle>Modern tooling</CardTitle>
            <CardDescription>
              Vite 6 + Vitest + ESLint 9 flat + Tailwind v4 CSS-first.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {import.meta.env.DEV && (
        <Card className={`${cardHoverableClass} mt-6 w-full text-left`}>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {t('examplesBadge')}
              </p>
              <CardTitle className="mt-2">{t('examplesTitle')}</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                {t('examplesDescription')}
              </CardDescription>
            </div>
            <Button asChild variant="secondary">
              <Link to="/examples">
                {t('ctaExamples')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}
    </section>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { HomePage };
