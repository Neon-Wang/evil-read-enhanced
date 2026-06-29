/**
 * @file footer.tsx
 * @description Token-driven page footer primitive. A semantic `<footer>`
 * with a top border and muted typography, laid out as a responsive row
 * (stacks on narrow, splits left/right on wide). Pass arbitrary children
 * for link columns / social rows; the optional `copyright` slot pins to
 * the end. Purely presentational chrome — no app coupling.
 *
 * Surface tokens: `--color-border` (top rule), `--color-muted-foreground`
 * (text). No new tokens introduced.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Types
// =================================================================================================

interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  /** Trailing slot — typically a copyright line. */
  copyright?: React.ReactNode;
}

// =================================================================================================
// Component
// =================================================================================================

const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, copyright, children, ...props }, ref) => (
    <footer
      ref={ref}
      className={cn(
        'flex flex-col gap-4 border-t border-[var(--color-border)] py-6 text-sm text-[var(--color-muted-foreground)]',
        'sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {children}
      </div>
      {copyright != null && <p className="text-xs">{copyright}</p>}
    </footer>
  )
);

Footer.displayName = 'Footer';

// =================================================================================================
// Exports
// =================================================================================================

export { Footer };
export type { FooterProps };
