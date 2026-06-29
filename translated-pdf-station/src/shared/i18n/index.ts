/**
 * @file index.ts
 * @description Lazy, namespace-based i18next bootstrap.
 *
 * Two layers of code-splitting:
 *
 *   1. Languages.  Each supported language only ships when actually
 *      activated. `initI18n()` waits for the *active* language's
 *      `common` bundle so first paint never shows raw fallback keys.
 *
 *   2. Namespaces.  Feature copy lives under
 *      `src/features/<name>/i18n/<lng>.json` — one namespace per
 *      feature. Vite splits each into its own chunk, so a user who
 *      never opens `/tasks` never downloads task copy.
 *
 *      Namespaces are loaded on demand. Two equally valid triggers:
 *        - Explicit:  `await loadNamespace('tasks')` from the
 *                     feature's `routes.tsx`, so the JS chunk and
 *                     locale chunk download in parallel.
 *        - Implicit:  `useTranslation('tasks')` — if the ns is not
 *                     yet loaded, react-i18next suspends the render
 *                     (caught by RootLayout's shared <Suspense>).
 *
 * Adding a new language is a 3-step change documented inline at
 * `loadBundle`; adding a new feature namespace requires no changes
 * here — the import.meta.glob discovers it.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

// =================================================================================================
// Constants
// =================================================================================================

const SUPPORTED_LANGS = ['en', 'zh'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const FALLBACK_LANG: SupportedLang = 'en';

/**
 * Default namespace for `useTranslation()` (no argument). Contains
 * app-shell copy (nav, errors, 404) that the router needs before any
 * feature route mounts.
 */
const DEFAULT_NS = 'common';

// =================================================================================================
// Bundle resolvers
// =================================================================================================

/**
 * Map of `(<lng>, <ns>) → () => Promise<bundle>`.
 *
 * `import.meta.glob` registers every JSON file at build time but only
 * fetches it when its loader is called, so each entry becomes its own
 * lazy chunk.
 *
 * Two globs are merged: app-shell `common` lives under
 * `src/shared/i18n/locales/`; feature namespaces live next to each
 * feature under `src/features/<name>/i18n/`.
 */
type BundleLoader = () => Promise<{ default: Record<string, unknown> }>;

const sharedModules = import.meta.glob('./locales/*/*.json') as Record<
  string,
  BundleLoader
>;

const featureModules = import.meta.glob('/src/features/*/i18n/*.json') as Record<
  string,
  BundleLoader
>;

/**
 * Resolve `(lng, ns)` to a loader.
 *
 *   common      → ./locales/<lng>/common.json
 *   <feature>   → /src/features/<feature>/i18n/<lng>.json
 *
 * Returns `null` when the lookup misses; the caller logs and
 * resolves with `{}` so a missing translation never throws and never
 * blocks the render.
 */
function resolveBundle(lng: string, ns: string): BundleLoader | null {
  if (ns === DEFAULT_NS) {
    return sharedModules[`./locales/${lng}/common.json`] ?? null;
  }
  return featureModules[`/src/features/${ns}/i18n/${lng}.json`] ?? null;
}

async function loadBundle(
  lng: string,
  ns: string
): Promise<Record<string, unknown>> {
  const loader = resolveBundle(lng, ns);
  if (!loader) {
    console.warn(`[i18n] no bundle found for lng=${lng} ns=${ns}`);
    return {};
  }
  const mod = await loader();
  return mod.default;
}

function isSupported(lng: string): lng is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng);
}

// =================================================================================================
// Bootstrap
// =================================================================================================

/**
 * Initialise i18next once.
 *
 * - Wires the resources-to-backend resolver so any subsequent
 *   `loadNamespaces` / `useTranslation(ns)` call lazily fetches the
 *   right `(lng, ns)` chunk.
 * - Pre-loads the active language's `common` namespace before
 *   resolving, so the first paint of the app shell renders real
 *   copy (not fallback keys).
 *
 * Returns the configured i18next instance; safe to call multiple
 * times — the second call returns the same promise.
 */
let initPromise: Promise<typeof i18n> | null = null;

function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await i18n
      .use(
        resourcesToBackend((lng: string, ns: string) => loadBundle(lng, ns))
      )
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        fallbackLng: FALLBACK_LANG,
        supportedLngs: SUPPORTED_LANGS as unknown as string[],
        // Default + fallback namespace. A missing key in any feature
        // ns first falls back to `common` before degrading to the key
        // string — useful for app-wide error text.
        defaultNS: DEFAULT_NS,
        fallbackNS: DEFAULT_NS,
        // Only pre-load the app-shell namespace. Feature namespaces
        // are pulled on demand (see `loadNamespace`).
        ns: [DEFAULT_NS],
        // Render with the bundles we already have; missing ns trigger
        // a load + a re-render. Combined with `useSuspense: true` on
        // the react binding below, the re-render is replaced by a
        // suspend that the route-level <Suspense> catches.
        partialBundledLanguages: true,
        interpolation: { escapeValue: false },
        detection: {
          order: ['localStorage', 'navigator'],
          caches: ['localStorage'],
        },
        // `useTranslation(ns)` suspends until ns is loaded. The
        // shared <Suspense> in RootLayout provides the fallback;
        // tests opt out by passing useSuspense: false in setup.ts.
        react: {
          useSuspense: true,
        },
      });

    // Hard guarantee: the active language's `common` bundle is
    // resident before `initI18n` resolves. i18next pre-loads it as
    // part of `init` because we listed it in `ns`, but await an
    // explicit `loadNamespaces` here so a slow network can't slip
    // past the first paint.
    const active = isSupported(i18n.language) ? i18n.language : FALLBACK_LANG;
    await i18n.loadNamespaces(DEFAULT_NS);
    if (i18n.language !== active) {
      await i18n.changeLanguage(active);
    }

    return i18n;
  })();

  return initPromise;
}

// =================================================================================================
// Public API
// =================================================================================================

/**
 * Preload a feature namespace. Call from `routes.tsx` so the locale
 * chunk downloads in parallel with the page chunk:
 *
 * ```ts
 * const TasksPage = lazy(async () => {
 *   const [mod] = await Promise.all([
 *     import('./pages/TasksPage'),
 *     loadNamespace('tasks'),
 *   ]);
 *   return { default: mod.TasksPage };
 * });
 * ```
 *
 * Awaiting `initI18n()` inside makes the call safe regardless of
 * whether the bootstrap has resolved yet — order-independent on the
 * call site.
 */
async function loadNamespace(ns: string): Promise<void> {
  await initI18n();
  await i18n.loadNamespaces(ns);
}

// =================================================================================================
// Exports
// =================================================================================================

export { initI18n, loadNamespace, DEFAULT_NS, SUPPORTED_LANGS };
export type { SupportedLang };
export default i18n;
