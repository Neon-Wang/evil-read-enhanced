# `.agent/` — Portable AI Coding Agent Protocol

This directory is the **single source of truth** for how any AI coding agent (Cursor, Claude Code, Codex, GitHub Copilot Workspace, generic LLM-driven scripts, etc.) should reason about and modify this codebase.

If you are an AI agent, **read this file first**, then load every file under `rules/` in numeric order, and consult the relevant `skills/` entry whenever you are about to start a recognizable task.

Humans editing this project should also follow these rules — they encode the team's conventions, not just AI scaffolding.

---

## Directory layout

```
.agent/
├── README.md                    <- this file
├── rules/                       <- hard constraints, read top-to-bottom in numeric order
│   ├── 00-architecture.md
│   ├── 10-react-conventions.md
│   ├── 20-tailwind-v4.md
│   ├── 30-testing.md
│   ├── 40-state-management.md
│   ├── 50-ui-axis.md
│   ├── 60-i18n.md
│   ├── 70-commit-style.md
│   ├── 80-quality-system.md     <- structure guards + AI-friendly lint (read before changing layout/banners/filenames)
│   └── 90-platform-targets.md   <- web/desktop/mobile target rules (read before suggesting layouts, scripts, or shells)
└── skills/                      <- task playbooks, invoke when the task matches
    ├── add-feature/SKILL.md              <- pure-client feature or fixed-backend feature
    ├── add-data-feature/SKILL.md         <- feature with swappable Mock+Supabase backends (canonical: tasks)
    ├── add-page/SKILL.md
    ├── add-animate-ui-component/SKILL.md
    ├── add-modal/SKILL.md                  <- Dialog / Sheet / Command / feature-level modal (mirror SignInModal)
    ├── add-zustand-store/SKILL.md        <- both flavours: hook (create()) and vanilla (createStore())
    ├── add-i18n-keys/SKILL.md
    ├── add-locale/SKILL.md                <- register a new BCP 47 language across every feature ns
    ├── customize-design/SKILL.md          <- tweak tokens / switch design preset / add a new --design value
    ├── customize-toast/SKILL.md           <- tweak toast position / styling / Sonner props
    ├── write-component-test/SKILL.md
    └── enable-supabase/SKILL.md          <- path A: factory + Mock impl; path B: direct TanStack Query
```

## How an agent should use this directory

1. Read `.agent/README.md` (this file).
2. Read every file in `.agent/rules/` in filename order. Treat them as **non-negotiable constraints**.
3. Inspect the user's request. For each match against a skill's `description` / `keywords`, load the corresponding `skills/<name>/SKILL.md` and follow its step list.
4. When implementing, **never** silently break a rule. If a rule must be violated, surface the conflict to the user and ask for confirmation.
5. After completing a task, ensure the change still satisfies every rule (especially `00-architecture.md`'s feature-boundary import constraints) and that the relevant tests live under `__tests__/`.

## Rule file frontmatter schema

Every file under `rules/` and `skills/<name>/SKILL.md` MUST start with a YAML frontmatter block:

```yaml
---
id: <stable kebab-case id>
title: <short human-readable title>
description: <1–2 sentence summary an agent uses to decide relevance>
applies_to: ["src/**"]            # optional glob list this guidance applies to
keywords: [feature, scaffold]     # optional, helps semantic-search-driven agents
severity: must | should | may     # rules only; default is "must"
---
```

Fields not listed here may be added by callers but should be ignored by parsers.

## Conventions referenced repeatedly

- The repository uses **feature-first** architecture under `src/features/<name>/`. Cross-feature imports may only target a feature's barrel `index.ts`.
- Two feature shapes are supported (00-architecture.md and add-feature/SKILL.md cover the choice):
  - **Pure-client** (`counter`, `home`): `stores/` (plural, optional) + `pages/` + `components/`.
  - **Data layer** (`tasks`): `store/` (singular vanilla zustand) + `selectors/` + `services/{interfaces,implementations,factory,facade}` for swappable Mock + Supabase backends.
- The CSS strategy is **Tailwind v4 CSS-first**: theme tokens live in `src/styles/index.css` under `@theme`; do not introduce a `tailwind.config.js`.
- Tests live in `__tests__/` directories **inside** each feature (mirroring its source tree). Cross-cutting setup lives in the root `__tests__/setup.ts`. Tests that transitively load `@/shared/supabase` must mock it before import.
- Visible strings go through i18next (`useTranslation`); do not hard-code copy in components.
- Every `.ts` / `.tsx` source file opens with the v1 file banner: `/** @file ... @description ... */` JSDoc header, `// ===` section separators (Imports / Types / Component / Exports etc.) and `// --- Group ---` import sub-headers. See `rules/10-react-conventions.md`.
- Optional modules are wrapped with comment markers:
  - `// @eikon:feature(<name>) begin … // @eikon:feature(<name>) end` — removed when the feature is stripped. Can appear anywhere in the file.
  - `// @eikon:feature(<name>) file` — the entire file is removed when the feature is stripped. **Must be on the very first line of the file** (leading whitespace is fine). Anywhere else and the marker is treated as inert prose, so documentation files like this one can quote the literal safely.
  - `// @eikon:variant(<axis>=<value>) begin … end` — keeps only the chosen value when scaffolding; non-chosen blocks are removed.
  - `// @eikon:variant(<axis>=<value>) file` — same as the feature file marker, including the first-line constraint.

  **Do not remove these markers** unless intentionally removing the feature itself.

## Updating this protocol

When the team changes a convention, update both:

1. The relevant rule in `rules/` (or add a new numeric file)
2. Any skill in `skills/` that referenced the old convention

Treat `.agent/` as production code: review rule changes in PRs the same way you review source changes.
