/**
 * @file heading.tsx
 * @description Token-driven page/section title primitive (the "Title"
 * component). Decouples the *semantic* level (`as` — which `<h1>`–`<h6>`
 * tag for the document outline / a11y) from the *visual* size (`size`),
 * so an agent can render an `<h2>` that looks like a hero title without
 * fighting the heading hierarchy.
 *
 * Type ramp + weight + tracking come from Tailwind utilities; colour is
 * `--color-foreground`. No new design tokens — it composes the same
 * scale the rest of the showcase uses.
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

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Semantic heading level → renders the matching `<h1>`–`<h6>` tag. */
  as?: HeadingLevel;
  /** Visual size, independent of the semantic level. */
  size?: HeadingSize;
}

// =================================================================================================
// Component
// =================================================================================================

const SIZE_CLASS: Record<HeadingSize, string> = {
  sm: 'text-base sm:text-lg',
  md: 'text-lg sm:text-xl',
  lg: 'text-xl sm:text-2xl',
  xl: 'text-2xl sm:text-3xl',
  '2xl': 'text-3xl sm:text-4xl',
};

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ as = 2, size = 'lg', className, ...props }, ref) => {
    const Tag = `h${as}` as const;
    return (
      <Tag
        ref={ref}
        className={cn(
          'font-semibold tracking-tight text-balance text-[var(--color-foreground)]',
          SIZE_CLASS[size],
          className
        )}
        {...props}
      />
    );
  }
);

Heading.displayName = 'Heading';

// =================================================================================================
// Exports
// =================================================================================================

export { Heading };
export type { HeadingProps };
