/**
 * @file ExamplesRouteFallback.tsx
 * @description Token-driven loading placeholder for the Examples route shell.
 */

// =================================================================================================
// Component
// =================================================================================================

function ExamplesRouteFallback() {
  return (
    <div
      aria-hidden="true"
      className="min-h-[100dvh] bg-[var(--color-background)] p-6"
    >
      <div className="mx-auto h-32 max-w-5xl animate-pulse rounded-md bg-[var(--color-muted)]/40" />
    </div>
  );
}

// =================================================================================================
// Exports
// =================================================================================================

export { ExamplesRouteFallback };
