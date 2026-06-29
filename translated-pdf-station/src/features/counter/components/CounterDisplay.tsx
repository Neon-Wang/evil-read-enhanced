/**
 * @file CounterDisplay.tsx
 * @description Animated numeric display used by the counter demo.
 *
 * Slides the digit up on increment and down on decrement via
 * AnimatePresence; falls back to a plain `<span>` under
 * prefers-reduced-motion.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Types
// =================================================================================================

interface CounterDisplayProps {
  value: number;
  className?: string;
}

// =================================================================================================
// Component
// =================================================================================================

function CounterDisplay({ value, className }: CounterDisplayProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-[length:var(--surface-border-width)] border-[var(--color-border)] bg-[var(--color-muted)]',
        className
      )}
      aria-live="polite"
    >
      {reduceMotion ? (
        // Reduced-motion path: no enter/exit transitions, no
        // AnimatePresence layout work — a plain span is enough.
        <span key={value} className="text-3xl font-semibold tabular-nums">
          {value}
        </span>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="text-3xl font-semibold tabular-nums"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { CounterDisplay };
export type { CounterDisplayProps };
