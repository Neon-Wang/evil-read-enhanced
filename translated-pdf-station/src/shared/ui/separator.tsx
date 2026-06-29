/**
 * @file separator.tsx
 * @description Token-driven divider. Native `<div role="separator">` —
 * no Radix dependency, since a separator has no interactive behaviour to
 * delegate. Supports horizontal (default) and vertical orientation, plus
 * a `decorative` flag that drops it from the a11y tree when it's purely
 * visual (the common case between flex items).
 *
 * Colour is `--color-border`; thickness tracks `--surface-border-width`
 * so the rule matches the weight of every bordered surface in the preset.
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

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** When true (default) the separator is hidden from assistive tech. */
  decorative?: boolean;
}

// =================================================================================================
// Component
// =================================================================================================

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-[var(--color-border)]',
        orientation === 'horizontal'
          ? 'h-[var(--surface-border-width)] w-full'
          : 'h-full w-[var(--surface-border-width)]',
        className
      )}
      {...props}
    />
  )
);

Separator.displayName = 'Separator';

// =================================================================================================
// Exports
// =================================================================================================

export { Separator };
export type { SeparatorProps };
