/**
 * @file progress.tsx
 * @description Determinate progress bar. A zero-dependency `role=
 * "progressbar"` with the proper `aria-valuemin/max/now` wiring, so
 * assistive tech announces completion without any extra markup.
 *
 * Token-driven: the track uses `--color-muted`, the indicator
 * `--color-primary`, and the fill width animates with
 * `--duration-normal`. Three heights via `size` keep it usable for
 * inline meters (`sm`) up to prominent upload bars (`lg`).
 *
 * Value is clamped to 0–100 and rounded for the a11y announcement, so
 * callers can pass raw ratios (e.g. `loaded / total * 100`) without
 * pre-sanitising.
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

type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Completion percentage, 0–100. */
  value: number;
  /** Track + indicator height. Defaults to `md`. */
  size?: ProgressSize;
}

const TRACK_HEIGHT: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

// =================================================================================================
// Component
// =================================================================================================

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, size = 'md', ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[var(--color-muted)]',
          TRACK_HEIGHT[size],
          className
        )}
        {...props}
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-[var(--duration-normal)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

// =================================================================================================
// Exports
// =================================================================================================

export { Progress };
export type { ProgressProps };
