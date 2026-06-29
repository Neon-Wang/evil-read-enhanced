/**
 * @file AnimationShowcase.tsx
 * @description Inline showcase of the animation primitives that ship out
 * of the box — Tailwind utility animations for spin/pulse/bounce, plus a
 * motion/react spring lift on hover.
 *
 * All animations honour prefers-reduced-motion via the `motion-safe:`
 * variant; the spring lift is opt-in via Framer/motion's reduced-motion
 * hook inside the Card primitive.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { motion, useReducedMotion } from 'motion/react';

// --- Absolute Imports ---
import { cn } from '@/shared/lib/cn';

// =================================================================================================
// Component
// =================================================================================================

function AnimationShowcase() {
  const { t } = useTranslation('examples');


  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <AnimBox label={t('sections.animation.spinLabel')}>
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent motion-safe:animate-spin" />
        </AnimBox>
        <AnimBox label={t('sections.animation.pulseLabel')}>
          <div className="h-8 w-8 rounded-full bg-[var(--color-primary)]/30 motion-safe:animate-pulse" />
        </AnimBox>
        <AnimBox label={t('sections.animation.bounceLabel')}>
          <div className="h-8 w-8 rounded-md bg-[var(--color-primary)]/70 motion-safe:animate-bounce" />
        </AnimBox>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('sections.animation.hoverHint')}
        </p>
        <motion.div
          whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className={cn(
            'flex h-20 w-32 cursor-pointer items-center justify-center rounded-md',
            'border border-[var(--color-border)] bg-[var(--color-card)] text-sm shadow-sm'
          )}
        >
          Hover me
        </motion.div>
      </div>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function AnimBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-[var(--color-border)] p-3">
      <div className="flex h-12 items-center justify-center">{children}</div>
      <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { AnimationShowcase };
