/**
 * @file MotionShowcasePage.tsx
 * @description Route-level component for `/examples/motion`.
 *
 * Four motion/react patterns demonstrated as small interactive boxes:
 *   - Fade-in on mount (`initial → animate`).
 *   - Staggered children entrance using `variants` + `staggerChildren`.
 *   - Shared `layoutId` swap that animates two cards exchanging order.
 *   - Tap target with `whileTap` + `whileHover` springs.
 *
 * Every animation honours prefers-reduced-motion via Framer/motion's
 * `useReducedMotion` hook — when reduced, transitions collapse to zero
 * duration so the layout still renders but doesn't move.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Core Libraries ---
import * as React from 'react';

// --- Core-related Libraries ---
import { useTranslation } from 'react-i18next';

// --- Third-party Libraries ---
import { motion, useReducedMotion } from 'motion/react';

// --- Absolute Imports ---
import { Button } from '@/shared/ui/button';

// --- Relative Imports ---
import { ShowcasePageHeader } from '../components/ShowcasePageHeader';

// =================================================================================================
// Component
// =================================================================================================

function MotionShowcasePage() {
  const { t } = useTranslation('examples');


  const reduceMotion = useReducedMotion();
  const [swapped, setSwapped] = React.useState(false);
  // Bump this counter to force the FadeIn + StaggeredList to remount, so
  // visitors can rewatch the entrance animations without a hard reload.
  const [replay, setReplay] = React.useState(0);

  return (
    <div className="flex flex-col gap-8">
      <ShowcasePageHeader
        showBack
        title={t('pages.motion.title')}
        subtitle={t('pages.motion.description')}
      />

      <section className="flex flex-col gap-8">
          <div className="flex justify-start">
            <Button variant="outline" size="sm" onClick={() => setReplay((n) => n + 1)}>
              Replay
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Fade-in on mount */}
            <Panel label={t('pages.motion.fadeInLabel')}>
              <FadeInBox key={`fade-${replay}`} reduceMotion={!!reduceMotion} />
            </Panel>

            {/* Stagger children */}
            <Panel label={t('pages.motion.stackLabel')}>
              <StaggeredList key={`stack-${replay}`} reduceMotion={!!reduceMotion} />
            </Panel>

            {/* Layout swap */}
            <Panel label={t('pages.motion.layoutLabel')}>
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  <LayoutCard
                    layoutId="examples-motion-a"
                    color="primary"
                    order={swapped ? 2 : 1}
                  />
                  <LayoutCard
                    layoutId="examples-motion-b"
                    color="secondary"
                    order={swapped ? 1 : 2}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => setSwapped((v) => !v)}>
                  {t('pages.motion.layoutSwap')}
                </Button>
              </div>
            </Panel>

            {/* Tap target */}
            <Panel label={t('pages.motion.tapLabel')}>
              <motion.button
                type="button"
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                whileHover={reduceMotion ? undefined : { y: -2, scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="rounded-md bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-[var(--color-primary-foreground)] shadow-sm"
              >
                Tap me
              </motion.button>
            </Panel>
          </div>
      </section>
    </div>
  );
}

// =================================================================================================
// Helpers
// =================================================================================================

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-[var(--color-border)] p-6">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <div className="flex min-h-[120px] w-full items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function FadeInBox({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
      className="h-16 w-32 rounded-md bg-[var(--color-primary)]/80"
    />
  );
}

function StaggeredList({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.ul
      // The parent variant drives the children via staggerChildren — under
      // reduced-motion we set everything to 0 so the children appear
      // instantly without per-item transitions.
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: reduceMotion ? 0 : 0.08,
            delayChildren: reduceMotion ? 0 : 0.04,
          },
        },
      }}
      className="flex w-full flex-col gap-1.5"
    >
      {[0, 1, 2, 3].map((i) => (
        <motion.li
          key={i}
          variants={{
            hidden: { opacity: 0, x: -8 },
            visible: { opacity: 1, x: 0 },
          }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
          className="h-3 w-full rounded bg-[var(--color-muted)]"
        />
      ))}
    </motion.ul>
  );
}

interface LayoutCardProps {
  layoutId: string;
  color: 'primary' | 'secondary';
  order: number;
}

function LayoutCard({ layoutId, color, order }: LayoutCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      layoutId={reduceMotion ? undefined : layoutId}
      style={{ order }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="flex h-16 w-16 items-center justify-center rounded-md text-xs font-mono shadow-sm"
      // CSS custom property + opacity gradient keeps both cards visible
      // when stacked on the same row but distinguishes them by hue.
      data-color={color}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-md"
        style={{
          backgroundColor:
            color === 'primary'
              ? 'var(--color-primary)'
              : 'var(--color-secondary)',
          color:
            color === 'primary'
              ? 'var(--color-primary-foreground)'
              : 'var(--color-secondary-foreground)',
        }}
      >
        {color === 'primary' ? 'A' : 'B'}
      </span>
    </motion.div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { MotionShowcasePage };
