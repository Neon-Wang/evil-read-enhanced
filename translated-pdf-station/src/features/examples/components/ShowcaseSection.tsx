/**
 * @file ShowcaseSection.tsx
 * @description Generic container for one demo block on a showcase page.
 *
 * Two layout flavours via the `variant` prop:
 *
 *   - `inline`  (default): used on the long index page; renders the
 *     section as an anchorable card with a heading + description and
 *     the demo content inside.
 *   - `page`: used at the top of a standalone showcase page; the
 *     heading is bigger and the section spans the page width without
 *     the card chrome.
 *
 * Always emits an `id={anchor}` on the heading wrapper so the inline
 * variant can be deep-linked via `/examples#button`.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import type * as React from 'react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Types
// =================================================================================================

interface ShowcaseSectionProps {
  /** Anchor id (also used as the heading's DOM id for deep-linking). */
  anchor: string;
  /** Section heading. */
  title: string;
  /** One-line explanation of what this section demos. */
  description: string;
  /** The demo body. */
  children: React.ReactNode;
  /** Optional eyebrow above the title (e.g. `UI primitives`). */
  eyebrow?: string;
  /** Layout flavour — see file-level docblock. */
  variant?: 'inline' | 'page';
  /** Extra classes for the section root. */
  className?: string;
}

// =================================================================================================
// Component
// =================================================================================================

function ShowcaseSection({
  anchor,
  title,
  description,
  children,
  eyebrow,
  variant = 'inline',
  className,
}: ShowcaseSectionProps) {
  return (
    <section
      id={anchor}
      // The `scroll-mt-20` offset compensates for any sticky header so
      // anchor jumps don't tuck the heading underneath the chrome.
      className={cn('scroll-mt-20', className)}
      aria-labelledby={`${anchor}-heading`}
    >
      <header className="mb-4 flex flex-col gap-1.5">
        {eyebrow && (
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {eyebrow}
          </span>
        )}
        <h2
          id={`${anchor}-heading`}
          className={cn(
            'font-semibold tracking-tight',
            variant === 'page' ? 'text-2xl sm:text-3xl' : 'text-xl'
          )}
        >
          {title}
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      </header>
      <div
        className={cn(
          variant === 'inline' &&
            'rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm'
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

export { ShowcaseSection };
export type { ShowcaseSectionProps };
