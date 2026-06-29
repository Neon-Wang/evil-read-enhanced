/**
 * @file spinner.tsx
 * @description Token-driven loading spinner (the "Loading" primitive).
 * An SVG ring that rotates via Tailwind's `animate-spin`, gated behind
 * `motion-safe:` so it freezes for `prefers-reduced-motion` users (an
 * accessible-name still announces the busy state for screen readers).
 *
 * Colour defaults to `currentColor` so it inherits the surrounding text
 * colour — drop it inside a Button and it tints to the button's
 * foreground for free. Sizing via the `size` prop (sm/md/lg) or any
 * `h-* / w-*` class through `className`.
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

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** Accessible label announced to screen readers (visually hidden). */
  label?: string;
}

// =================================================================================================
// Component
// =================================================================================================

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
};

const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = 'md', label = 'Loading', ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn('inline-flex', className)}
      {...props}
    >
      <svg
        className={cn(
          'motion-safe:animate-spin text-current',
          SIZE_CLASS[size]
        )}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-90"
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
);

Spinner.displayName = 'Spinner';

// =================================================================================================
// Exports
// =================================================================================================

export { Spinner };
export type { SpinnerProps };
