/**
 * @file kbd.tsx
 * @description Keyboard-key hint chip. Renders a semantic `<kbd>` styled
 * as a small key cap, for documenting shortcuts (e.g. ⌘ K) inline or in
 * command-palette hints.
 *
 * Token-driven: `--color-muted` cap, `--color-border` edge,
 * `--color-muted-foreground` glyph. `min-w-5` keeps single-glyph caps
 * square; multi-character labels grow naturally.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import type * as React from 'react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Component
// =================================================================================================

function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded px-1.5',
        'border-[length:var(--surface-border-width)] border-[var(--color-border)] bg-[var(--color-muted)]',
        'font-sans text-[0.7rem] font-medium text-[var(--color-muted-foreground)]',
        className
      )}
      {...props}
    />
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { Kbd };
