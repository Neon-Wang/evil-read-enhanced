---
id: add-locale
title: Add a new supported language
description: Register a BCP 47 code, drop in the common + every feature namespace bundle for the new language, verify coverage and detection.
keywords: [locale, language, i18n, translation, new language, BCP 47]
applies_to:
  - "src/shared/i18n/**"
  - "src/features/**/i18n/**"
---

# Skill: add a new supported language

Use whenever the project gains a new UI language (e.g. French, Japanese,
Traditional Chinese). The work is mechanical but crosses every feature
directory — easy to miss a file. Re-read
[rules/60-i18n.md](../../rules/60-i18n.md) first.

## Step 0 — pick the language code

Use **BCP 47** (hyphen-separated, lowercase script tag):

- `en`, `zh`, `ja`, `de` — base languages
- `zh-CN`, `zh-TW`, `pt-BR` — region-specific when you actually need
  to differentiate

Do **not** use underscores (`zh_TW`) — i18next + the browser
LanguageDetector both expect the hyphen form, and the
`languageChanged` cache key normalises on it.

If the new language is just a regional variant of an existing one
(e.g. `en-GB` on top of `en`), set its `fallbackLng` to the base
instead of fully duplicating every bundle — see step 5.

## Step 1 — register the code

Edit
[src/shared/i18n/index.ts](../../../src/shared/i18n/index.ts) and
extend `SUPPORTED_LANGS`:

```ts
const SUPPORTED_LANGS = ['en', 'zh', 'fr'] as const;
//                                  ^^^^
//                                  new entry
```

`SUPPORTED_LANGS` feeds three things in one shot:

1. The init-time `supportedLngs` list — without this, i18next rejects
   the activation.
2. The `LanguageDetector` allow-list — the navigator/localStorage
   value is filtered against this set.
3. The `SupportedLang` discriminated union — TypeScript will surface
   any spot that switches on the language and forgot a case.

No other edit to `index.ts` is required: the
`i18next-resources-to-backend` resolver discovers files from
`import.meta.glob` patterns at runtime.

## Step 2 — add the app-shell bundle

Create `src/shared/i18n/locales/<new-lng>/common.json` mirroring the
key set of `en/common.json` (line for line). At time of writing
`common.json` covers `nav.*` and `notFound.*` — the file is small
enough to translate by hand.

Use `en/common.json` as the source of truth for key order. Keep the
order identical across locales — it makes diff review during code
review trivial.

## Step 3 — add a bundle per feature

For every directory under `src/features/<feature>/i18n/`, create
`<new-lng>.json` mirroring the existing `en.json`. Quick start: copy
the English file and translate values in-place.

The eager glob in
[__tests__/setup.ts](../../../__tests__/setup.ts) auto-discovers the
new files — no test config edit is needed.

If you skip this step for a feature, react-i18next falls back to
`common` then to the literal key string for that feature only — the
breakage is silent and per-page, so verify in dev (`localStorage.i18nextLng`
= '<new-lng>'; refresh) AND via the coverage check in step 6.

## Step 4 — (optional) wire a language switcher

The template ships **without** a UI switcher because product needs
vary (split a marketing site by hostname vs. let users pick from a
dropdown). The actual API surface is tiny:

```ts
import i18n from '@/shared/i18n';

await i18n.changeLanguage('<new-lng>');
```

The `languageChanged` handler in
[src/shared/i18n/index.ts](../../../src/shared/i18n/index.ts) listens
for the event and lazily fetches every currently-loaded namespace's
bundle in the new language. The user's choice persists via
`localStorage` (see `detection.caches`).

Place the switcher in
[src/app/layouts/RootLayout.tsx](../../../src/app/layouts/RootLayout.tsx)
next to the nav so it's visible app-wide.

## Step 5 — (optional) adjust fallback chains

The default `fallbackLng: 'en'` covers most cases. Two situations
warrant tweaking:

- **Regional variant on top of a base.** E.g. `en-GB` should fall
  back to `en`, not to a key string:

  ```ts
  fallbackLng: {
    'en-GB': ['en', 'en'],
    default: ['en'],
  },
  ```

- **Different default for a regional build.** E.g. a Brazilian
  marketing site whose default is `pt-BR`:

  ```ts
  fallbackLng: 'pt-BR',
  ```

Both shapes still belong inside the existing `init({ ... })` block in
`shared/i18n/index.ts` — do not introduce a new bootstrap.

## Step 6 — verify coverage

Run a quick coverage check before opening the PR. The shape is
"every English JSON has a matching `<new-lng>.json` sibling and the
files have the same set of leaf keys".

A one-liner that works from the repo root (POSIX shell or Git Bash):

```bash
# 1. Every feature has the new bundle:
for f in src/features/*/i18n/en.json; do
  test -f "${f%/en.json}/<new-lng>.json" || echo "missing: ${f%/en.json}/<new-lng>.json"
done

# 2. common.json exists for the new lng:
test -f src/shared/i18n/locales/<new-lng>/common.json \
  || echo "missing: src/shared/i18n/locales/<new-lng>/common.json"
```

For a structural key-parity check (catches "translated but missed a
key"), a tiny node script using `flat`/`flatten-keys` works. If the
project later imports `i18next-parser`, run its `--fail-on-missing`
check in CI instead — that's the canonical tool.

## Step 7 — run the test suite

```bash
pnpm --filter @eikon/react test
pnpm --filter @eikon/react typecheck
pnpm --filter @eikon/react lint
```

The eager glob means every new bundle is bundled into the test
process automatically. If a render test renders i18n copy and the
new bundle is missing a key, the assertion that matches the English
string will fail loudly — that's the safety net.

## Completion checklist

- [ ] BCP 47 code added to `SUPPORTED_LANGS` in
      `src/shared/i18n/index.ts`.
- [ ] `src/shared/i18n/locales/<lng>/common.json` exists with the
      same keys as `en/common.json`, in the same order.
- [ ] Every directory under `src/features/*/i18n/` carries a
      matching `<lng>.json`, key-for-key.
- [ ] (Optional) `fallbackLng` adjusted if the new language is a
      regional variant.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` all green.
- [ ] Manually toggled `localStorage.i18nextLng` to the new code in
      dev and walked every route — nothing falls back to the key
      string.

## Common mistakes

- **Underscore in the code** (`zh_TW`). Use hyphens.
- **Forgetting one feature.** The breakage is silent — coverage check
  in step 6 is mandatory, not optional, for any non-trivial app.
- **Re-translating `common` from scratch when adding a regional
  variant.** Use `fallbackLng: { '<region>': ['<base>'] }` instead
  and only translate strings that actually differ.
- **Adding the bundle but forgetting `SUPPORTED_LANGS`.** i18next
  refuses to activate the language; `LanguageDetector` silently
  falls back to `en`. Symptom: the UI never picks up the new code
  even though the JSON is present.
- **Putting region-specific copy in the base bundle.** Keep `en` as
  the neutral source-of-truth and let `en-GB` (or whichever
  regional code) override only the deltas.

## See also

- [rules/60-i18n.md](../../rules/60-i18n.md) — the i18n contract.
- [skills/add-i18n-keys/SKILL.md](../add-i18n-keys/SKILL.md) — adding
  individual keys (run this AFTER add-locale when introducing both
  at once).
