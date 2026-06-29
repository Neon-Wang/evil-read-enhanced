/**
 * @file ShowcaseFrame.tsx
 * @description Polished preview surface used by every routed examples
 * sub-page.
 *
 * Replaces the bare `rounded-lg border bg-card p-6` div with a labelled
 * frame that has:
 *
 *   - A top utility strip carrying the "Preview" eyebrow + the page's
 *     slug as a copyable code chip + an "open in new tab" link, so a
 *     visitor can lift the route URL without scraping the address bar.
 *   - A faintly dotted backdrop in the demo area that visually
 *     separates the live component from the page chrome (Linear /
 *     shadcn / Vercel docs use the same trick).
 *   - `overflow-x-auto` on the demo area so a wide table or button
 *     matrix never blows out the column on narrow shells (notably the
 *     ~448px Centered card layout).
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import { type ReactNode, useCallback, useState } from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { Check, Copy, ExternalLink } from 'lucide-react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Types
// =================================================================================================

interface ShowcaseFrameProps {
  /** Slug shown as a code chip in the top strip. */
  slug: string;
  /** Demo content. */
  children: ReactNode;
  /** Override the surface tone — `plain` removes the dotted backdrop. */
  tone?: 'dotted' | 'plain';
  /** Extra classes for the demo content cell. */
  contentClassName?: string;
}

// =================================================================================================
// Component
// =================================================================================================

function ShowcaseFrame({
  slug,
  children,
  tone = 'dotted',
  contentClassName,
}: ShowcaseFrameProps) {
  const { t } = useTranslation('examples');
  const [copied, setCopied] = useState(false);

  // Copy the absolute URL — robust to nested routes, custom basenames
  // and previewing the doc site behind a CDN (won't bake in localhost).
  const route = `/examples/${slug}`;

  const handleCopy = useCallback(() => {
    const href =
      typeof window === 'undefined' ? route : `${window.location.origin}${route}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(href).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    }
  }, [route]);

  return (
    <section
      aria-label={t('frame.previewLabel')}
      className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm"
    >
      {/* Top utility strip — eyebrow + slug + actions. */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)] sm:block" aria-hidden="true" />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
            {t('frame.previewLabel')}
          </span>
          <code className="truncate rounded border border-[var(--color-border)] bg-[var(--color-background)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--color-muted-foreground)]">
            {route}
          </code>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? t('frame.copied') : t('frame.copyRoute')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            ) : (
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={route}
            target="_blank"
            rel="noreferrer"
            aria-label={t('meta.openInNewTab')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Demo cell. */}
      <div
        className={cn(
          'relative overflow-x-auto p-6',
          // Faint dotted backdrop. Uses radial-gradient instead of a
          // SVG asset so it stays cheap and respects the foreground
          // colour token automatically.
          tone === 'dotted' &&
            '[background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:18px_18px]',
          contentClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ShowcaseFrame };
export type { ShowcaseFrameProps };
