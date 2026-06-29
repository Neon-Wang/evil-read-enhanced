---
id: commit-style
title: Conventional Commits
description: Commit message format for human and automated changelog generation. Applies to every commit on every branch.
severity: must
---

# Commit messages

All commits MUST follow [Conventional Commits](https://www.conventionalcommits.org/) 1.0.0:

```
<type>(<scope>): <short imperative summary>

[optional body explaining the why]

[optional footer(s)]
```

## Types

| type       | when to use                                                             |
| ---------- | ----------------------------------------------------------------------- |
| `feat`     | A new user-visible feature                                              |
| `fix`      | A bug fix                                                               |
| `refactor` | Code change that neither fixes a bug nor adds a feature                 |
| `perf`     | A performance improvement                                               |
| `style`    | Formatting, missing semicolons, etc. (no production code change)        |
| `docs`     | Documentation only                                                      |
| `test`     | Adding or fixing tests                                                  |
| `build`    | Build system, package manager, bundler                                  |
| `ci`       | CI configuration                                                        |
| `chore`    | Routine maintenance, dependency bumps, anything not user-facing         |
| `revert`   | Reverts a previous commit                                               |

## Scope

The scope is the most-specific feature, package, or area being touched:

- `feat(counter): persist value across reloads`
- `fix(auth): redirect after sign-in races with router`
- `refactor(shared/ui): extract button variants into cva`
- `chore(deps): bump tailwindcss to 4.0.7`

Omit the scope only for repo-wide changes (`build: switch to pnpm`, `docs: rewrite README`).

## Subject line

- Imperative mood: "add", "fix", "update" — not "added", "fixes", "updating".
- No trailing period.
- ≤72 characters preferred; ≤100 is the hard cap.

## Body

- Explain **why**, not what (the diff already shows the what).
- Wrap at ~72 columns.
- Reference issues at the bottom (`Closes #123`, `Relates to #456`).

## Breaking changes

Append `!` after the type/scope or add a `BREAKING CHANGE:` footer:

```
feat(api)!: drop /v1 endpoints

BREAKING CHANGE: callers must migrate to /v2 endpoints. See docs/migration.md.
```

## Examples

```
feat(counter): show toast on increment
fix(home): correct CTA route target
refactor(shared/ui): extract button variants into cva
chore(deps): bump tailwindcss to 4.0.7
docs(agent): describe rule frontmatter schema
test(counter): cover decrement clamping
```
