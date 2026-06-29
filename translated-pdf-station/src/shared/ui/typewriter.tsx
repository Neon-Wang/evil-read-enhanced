/**
 * @file typewriter.tsx
 * @description Animated typing effect (the "Typewriter" primitive). Cycles
 * through one or more phrases, typing then deleting each, with a blinking
 * caret. Fully accessible: the live text is mirrored in a visually-hidden
 * region with the full phrase so screen readers aren't spammed with
 * per-character updates, and `prefers-reduced-motion` short-circuits the
 * animation to render the first phrase statically.
 *
 * No new design tokens — the caret uses `--color-primary` and the type
 * cadence is plain JS timers (so it works regardless of the preset's
 * motion tokens).
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

interface TypewriterProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Phrases to cycle through. */
  words: string[];
  /** Per-character typing delay (ms). */
  typingSpeed?: number;
  /** Per-character deleting delay (ms). */
  deletingSpeed?: number;
  /** Pause once a phrase is fully typed (ms). */
  pauseMs?: number;
}

// =================================================================================================
// Hooks
// =================================================================================================

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// =================================================================================================
// Component
// =================================================================================================

const Typewriter = React.forwardRef<HTMLSpanElement, TypewriterProps>(
  (
    {
      className,
      words,
      typingSpeed = 90,
      deletingSpeed = 45,
      pauseMs = 1200,
      ...props
    },
    ref
  ) => {
    const reduced = usePrefersReducedMotion();
    const [text, setText] = React.useState('');
    const [wordIndex, setWordIndex] = React.useState(0);
    const [deleting, setDeleting] = React.useState(false);

    const current = words[wordIndex % words.length] ?? '';

    React.useEffect(() => {
      if (reduced || words.length === 0) return;

      if (!deleting && text === current) {
        const id = window.setTimeout(() => setDeleting(true), pauseMs);
        return () => window.clearTimeout(id);
      }
      if (deleting && text === '') {
        setDeleting(false);
        setWordIndex((i) => (i + 1) % words.length);
        return;
      }

      const id = window.setTimeout(
        () => {
          setText((prev) =>
            deleting
              ? current.slice(0, prev.length - 1)
              : current.slice(0, prev.length + 1)
          );
        },
        deleting ? deletingSpeed : typingSpeed
      );
      return () => window.clearTimeout(id);
    }, [
      text,
      deleting,
      current,
      reduced,
      words.length,
      typingSpeed,
      deletingSpeed,
      pauseMs,
    ]);

    if (reduced) {
      return (
        <span ref={ref} className={className} {...props}>
          {words[0] ?? ''}
        </span>
      );
    }

    return (
      <span ref={ref} className={cn('inline-flex items-baseline', className)} {...props}>
        <span aria-hidden="true">{text}</span>
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block w-[2px] self-stretch bg-[var(--color-primary)] motion-safe:animate-pulse"
          style={{
            animationDuration: 'var(--duration-slow)',
            animationTimingFunction: 'var(--ease-in-out)',
          }}
        />
        <span className="sr-only">{current}</span>
      </span>
    );
  }
);

Typewriter.displayName = 'Typewriter';

// =================================================================================================
// Exports
// =================================================================================================

export { Typewriter };
export type { TypewriterProps };
