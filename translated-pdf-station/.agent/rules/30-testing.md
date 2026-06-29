---
id: testing
title: Testing strategy with Vitest + Testing Library
description: Where tests live, what they must cover, and how to write them. Replaces the legacy Jest setup.
applies_to: ["src/**/__tests__/**", "__tests__/**"]
severity: must
---

# Testing

## Tooling

- Default runner: **Vitest** with **happy-dom** under Node.
  - `pnpm test` — run once
  - `pnpm test:watch` — watch mode
  - `pnpm test:coverage` — v8 coverage
- Browser-mode runner: **Vitest + @vitest/browser + Playwright (chromium)**. Opt-in; not part of `pnpm test`.
  - `pnpm test:browser:setup` — one-time chromium download (`playwright install chromium`).
  - `pnpm test:browser` — runs every spec under `__tests__/browser/**` in real headless Chromium.
- Helpers: **@testing-library/react**, **@testing-library/user-event**, **@testing-library/jest-dom** (extended matchers).
- Global setup lives in [__tests__/setup.ts](../../__tests__/setup.ts) and:
  - Registers `jest-dom` matchers and autoclean (`afterEach(cleanup)`).
  - Eagerly initialises i18next: every shipped locale × every feature namespace (`common` + each `src/features/*/i18n/<lng>.json`) is bundled synchronously via `import.meta.glob({ eager: true })` and registered before the first test runs. `useSuspense: false` keeps tests synchronous — `useTranslation('tasks')` etc. just works without `act(...)` wrappers or per-test providers.
- Two vitest configs:
  - [`vitest.config.ts`](../../vitest.config.ts) — happy-dom, includes `src/**/__tests__/**`, `__tests__/**`; EXCLUDES `__tests__/browser/**`.
  - [`vitest.browser.config.ts`](../../vitest.browser.config.ts) — Chromium via Playwright, includes ONLY `__tests__/browser/**`.

## Where tests go

- Per-feature tests live inside `src/features/<name>/__tests__/`, **mirroring** the source layout. Both feature shapes are supported:

  Simple / pure-client feature (e.g. `counter`):

  ```
  src/features/counter/
  ├── stores/counterStore.ts
  ├── components/CounterDisplay.tsx
  └── __tests__/
      ├── stores/counterStore.test.ts
      └── components/CounterDisplay.test.tsx
  ```

  Swappable-backend feature (e.g. `tasks`) — mirror `store/` (singular), `selectors/`, `services/`:

  ```
  src/features/tasks/
  ├── store/tasksStore.ts
  ├── selectors/{basic,computed,memoized,actions,index}.ts
  ├── services/{interfaces,implementations,factory,tasksService}.ts
  ├── components/…
  ├── pages/…
  └── __tests__/
      ├── store/tasksStore.test.ts
      ├── services/MockTasksService.test.ts        # one per implementation
      └── components/…
  ```

- Shared utility tests live in `src/shared/<area>/__tests__/`.
- True cross-cutting tests (e.g. router smoke tests, app shell wiring, integration tests) live in the top-level `__tests__/`. Five canonical subdirectories plus two required files; the structural fence at `__tests__/structure/tests-root.test.ts` enforces them:
  - `__tests__/setup.ts` — global setup (do not delete or rename)
  - `__tests__/test-utils.tsx` — shared helpers (`renderWithRouter`, `supabaseMockTrap`) importable as `@test/test-utils`
  - `__tests__/structure/` — repo-shape tests (this rule, file naming, marker balance, etc.)
  - `__tests__/app/` — tests for things in `src/app/` (e.g. `RootLayout.test.tsx`)
  - `__tests__/integration/` — multi-layer integration tests that cross feature boundaries
  - `__tests__/eslint-rules/` — unit tests for the project's local eslint rules under `eslint-rules/`
  - `__tests__/browser/` — browser-mode (real Chromium) e2e-ish specs (optional, opt-in via `vitest.browser.config.ts`)
- File suffix is `.test.ts` or `.test.tsx`. Do not use `.spec.*` (Vitest config does accept both, but the convention is `.test`).

## What to test

The template ships with a layered test pyramid. New features should reach the same minimum coverage:

| Layer | Lives in | Required for new feature? | Speed |
|---|---|---|---|
| Pure logic — store / service / helper | `<feature>/__tests__/{store,services,…}/` | YES — every store + every service implementation | <100ms each |
| Component | `<feature>/__tests__/components/` | YES — at least the user-facing entrypoint(s) | <300ms each |
| Page render | `<feature>/__tests__/pages/` | YES — every route-level page (smoke render + key interaction) | <500ms each |
| App-shell wiring | `__tests__/app/` | When the feature exposes a new nav link or layout slot | <500ms each |
| Integration (router + selectors + service) | `__tests__/integration/` | At least one per feature with a non-trivial happy-path flow | 1–4s each |
| Browser-mode e2e | `__tests__/browser/` | Optional — add when a happy-dom edge case bites, or for real-keyboard/mouse coverage | 2–10s each |

Snapshot tests are discouraged — they encode coupling without intent. Use targeted assertions (`getByRole`, `getByText`) instead.

The integration layer is the **most valuable** for catching regressions in the swappable-backend pattern: it uses the real `MockTasksService` through the real factory through the real store through the real selectors. Mock only `@/shared/supabase` (so the supabase impl never accidentally instantiates).

Browser-mode e2e is optional and OPT-IN — it costs a one-time chromium download (~120 MB) and adds ~5s per file. Use it when:

- You need to verify real focus/IME/keyboard behaviour that happy-dom fakes.
- A bug only reproduces with a real layout engine.
- You want a smoke test that confirms the template runs at all in a real browser before shipping.

`pnpm test` MUST stay fast and not require any external binaries — never move browser-mode specs into the default config.

## How to write a test

- Prefer Testing Library queries that mirror how users interact: `getByRole`, `getByLabelText`, `getByText`. Fall back to `getByTestId` only when accessibility queries are infeasible.
- Use `userEvent` (not `fireEvent`) for any interaction more complex than a single click — it models real user keyboard/mouse sequences.
- Mock at the module boundary closest to the I/O. For a feature with a `services/` layer, mock the service via `vi.mock('@/features/foo/services/...')`, not the global `fetch`.
- Async assertions go through `findBy*` queries or `await waitFor(...)`. Never sleep with `setTimeout`.
- For tests that render anything using react-router (`<Link>`, `useNavigate`, `useParams`, …), import `renderWithRouter` from `@test/test-utils` rather than re-wrapping a `<MemoryRouter>` per file.
- For `vi.mock` factories that need access to fixtures, declare the fixtures inside `vi.hoisted(() => ({ … }))` — `vi.mock` is hoisted to the top of the file and cannot reference normal top-level consts.

## Testing vanilla Zustand stores

Stores under `<feature>/store/<x>Store.ts` are vanilla zustand stores (not React hooks). Test them by interacting with `getState()` and `subscribe()` directly:

```ts
import { tasksStore } from '../../store/tasksStore';

beforeEach(() => {
  tasksStore.getState().reset();
});

it('addTask prepends', async () => {
  await tasksStore.getState().addTask({ title: 'Hi' });
  expect(tasksStore.getState().tasks[0]?.title).toBe('Hi');
});
```

`subscribeWithSelector` is part of the public test surface for fine-grained subscription assertions:

```ts
const handler = vi.fn();
const unsub = tasksStore.subscribe((s) => s.tasks.length, handler);
await tasksStore.getState().initialize();
expect(handler).toHaveBeenCalled();
unsub();
```

## Mocking `@/shared/supabase` in Node tests

`@supabase/supabase-js` constructs a Realtime client during module load and touches the global `WebSocket`, which happy-dom does not provide. Any test that imports a module which (transitively) imports `@/shared/supabase` MUST mock the module before the first import:

```ts
import { vi } from 'vitest';

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy({}, {
    get() {
      throw new Error(
        '@/shared/supabase was accessed in a unit test — mock it explicitly.',
      );
    },
  }),
}));

// `import` lines below this MUST come AFTER the vi.mock call.
import { tasksStore } from '../../store/tasksStore';
```

The Proxy fail-fast surface makes accidental leaks loud — if a test path reaches into Supabase you'll see a clear error rather than a silent network call.

For tests of feature services that legitimately need to assert on Supabase calls, mock the relevant query builder chain explicitly:

```ts
vi.mock('@/shared/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [/* … */], error: null }),
      }),
    }),
  },
}));
```

## Browser-mode e2e (`__tests__/browser/`)

Browser-mode specs render real React components inside a real Chromium driven by Playwright. They live under `__tests__/browser/` and run via `pnpm test:browser` only (the default `pnpm test` explicitly excludes this folder).

Public API surface (imported from `@vitest/browser/context`):

```ts
import { page, userEvent } from '@vitest/browser/context';
import { render } from '@testing-library/react';

render(<MyApp />);
const titleInput = page.getByLabelText(/title/i);
await expect.element(titleInput).toBeInTheDocument();
await userEvent.fill(titleInput, 'Hello');
await userEvent.click(page.getByRole('button', { name: /submit/i }));
```

Key differences vs the happy-dom layer:

- Use `page.*` queries and `expect.element(...)` chains — these wait for DOM updates automatically.
- `userEvent` from `@vitest/browser/context` drives real keyboard/mouse events via Playwright.
- `vi.mock(...)` works the same way as in the default config; the supabase / serviceConfig mocks should be identical to the integration test.

When to add a browser-mode spec:

- The behaviour is provably wrong in a real browser but passes in happy-dom (rare but loud — e.g. focus traps, scroll-into-view).
- Verifying a happy-path flow once in a real browser is cheaper than maintaining a separate Playwright project.

Do NOT pile every feature's tests into browser mode. Browser mode is 10x slower than happy-dom; it's a complement to the lower layers, not a replacement.

## What NOT to test

- Implementation details (CSS class strings, internal state shape, lifecycle ordering). Test the **contract**.
- Third-party libraries (Radix, Motion, React Router). Trust their tests.
- Visual styling. Visual regressions belong in Storybook/Chromatic if introduced later.

## Coverage

Coverage is collected by `pnpm test:coverage` via v8. Aim for ≥80% on feature code; the threshold is not enforced in CI by default — add `--coverage --reporter=text-summary` to commands when needed.
