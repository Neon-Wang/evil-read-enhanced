/**
 * @file themeStore.ts
 * @description Cross-cutting theme preference store + side-effect glue.
 *
 * Owns the three-state colour-scheme preference (`light` | `dark` |
 * `system`), keeps it in sync with:
 *
 *   - `<html>` `light` / `dark` class — toggled when the resolved scheme
 *     changes, so every Tailwind v4 `dark:` utility flips in lock-step
 *     with the user's selection.
 *   - `localStorage['theme']` — written as a raw string, matching the
 *     blocking script in `index.html` that prevents flash-of-wrong-theme
 *     on cold load.
 *   - `matchMedia('(prefers-color-scheme: dark)')` — listened to so that
 *     while `theme === 'system'` the resolved scheme follows the OS in
 *     real time without a reload.
 *
 * Side effects (subscribe + matchMedia listener) self-bootstrap on first
 * import of this module. RootLayout imports `<ThemeToggle />` which
 * imports the store, so wiring is "use it and it works" — no provider
 * to mount, no explicit init call in `main.tsx`.
 *
 * Why not zustand `persist` middleware: the FOUC-prevention script in
 * `index.html` reads `localStorage['theme']` synchronously before React
 * boots and expects a bare string. `persist` wraps state in a JSON
 * envelope (`{ state: { theme }, version }`), which the boot script
 * can't tolerate. Writing the bare string manually is two lines and
 * keeps the two sources of truth in lock-step.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { create } from 'zustand';

// =================================================================================================
// Types
// =================================================================================================

/** User's theme preference. `system` defers to OS at resolve time. */
type Theme = 'light' | 'dark' | 'system';

/** The actually-applied scheme (`system` is resolved to one of these). */
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  /** Set the preference explicitly. */
  setTheme: (next: Theme) => void;
  /**
   * Cycle through `light → dark → system → light`. Convenient for a
   * single icon-button toggle that doesn't want to open a menu.
   */
  cycleTheme: () => void;
}

// =================================================================================================
// Constants
// =================================================================================================

const STORAGE_KEY = 'theme';
const CYCLE_ORDER: readonly Theme[] = ['light', 'dark', 'system'] as const;

// =================================================================================================
// Helpers
// =================================================================================================

/**
 * Read the persisted preference. Defensive against:
 *   - SSR / non-browser environments (returns 'system').
 *   - localStorage being disabled or throwing (Safari private mode).
 *   - Legacy values that were JSON-stringified by an earlier version of
 *     the store (the boot script tolerates both; so do we).
 */
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return 'system';
  }
  if (!raw) return 'system';

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Already a bare string; fall through.
  }
  if (parsed === 'light' || parsed === 'dark' || parsed === 'system') {
    return parsed;
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

function applyToDom(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

function writeStored(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Quota exceeded or storage disabled — silently drop; the
    // in-memory state is still authoritative for this session.
  }
}

// =================================================================================================
// Store
// =================================================================================================

const initialTheme = readStoredTheme();

const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: resolve(initialTheme),
  setTheme: (next) =>
    set({
      theme: next,
      resolvedTheme: resolve(next),
    }),
  cycleTheme: () => {
    const idx = CYCLE_ORDER.indexOf(get().theme);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]!;
    set({ theme: next, resolvedTheme: resolve(next) });
  },
}));

// =================================================================================================
// Side effects (run once on module import)
// =================================================================================================

if (typeof window !== 'undefined') {
  // Reconcile the DOM with our current state. The FOUC script in
  // index.html should have already done this, but doing it again is
  // cheap and guards against the (rare) case where the two reads
  // disagree — e.g. a code path that wrote to localStorage between
  // the boot script and React mount.
  applyToDom(useThemeStore.getState().resolvedTheme);

  useThemeStore.subscribe((state, prev) => {
    if (state.resolvedTheme !== prev.resolvedTheme) {
      applyToDom(state.resolvedTheme);
    }
    if (state.theme !== prev.theme) {
      writeStored(state.theme);
    }
  });

  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (): void => {
      // Only act while the user is letting the OS drive — explicit
      // light/dark choices are absolute and ignore OS preference.
      const { theme, setTheme } = useThemeStore.getState();
      if (theme !== 'system') return;
      setTheme('system');
    };
    // `addEventListener('change', …)` is the modern API; the legacy
    // `addListener` fallback covers Safari < 14 without breaking on
    // browsers where it's been removed.
    if ('addEventListener' in mql) {
      mql.addEventListener('change', onSystemChange);
    } else {
      (mql as MediaQueryList).addListener?.(onSystemChange);
    }
  }
}

// =================================================================================================
// Exports
// =================================================================================================

export { useThemeStore };
export type { Theme, ResolvedTheme, ThemeState };
