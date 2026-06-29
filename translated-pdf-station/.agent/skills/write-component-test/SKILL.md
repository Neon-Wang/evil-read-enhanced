---
id: write-component-test
title: Write a component / hook / store test
description: Standard recipe for Vitest + Testing Library tests, including async patterns and how to mock service layers.
keywords: [test, vitest, testing-library, component, hook, store]
applies_to: ["src/**/__tests__/**", "__tests__/**"]
---

# Skill: write a test

Use whenever new code is added or a bug is fixed. Re-read [rules/30-testing.md](../../rules/30-testing.md) first.

## Decide what kind of test you need

| Code under test                | Test type                                                              | Lives in |
| ------------------------------ | ---------------------------------------------------------------------- | --- |
| Pure function / store / helper | Unit test (no DOM rendering)                                           | `<feature>/__tests__/{store,services,…}/` |
| React component                | Render test with Testing Library                                       | `<feature>/__tests__/components/` |
| React hook with logic          | `renderHook` test                                                      | `<feature>/__tests__/hooks/` |
| Route-level page               | Page render test (with router context)                                 | `<feature>/__tests__/pages/` |
| Service / API call             | Unit test with a fetch / supabase / TanStack-Query mock at the boundary | `<feature>/__tests__/services/` |
| Multiple features / layers     | Integration test                                                       | top-level `__tests__/integration/` |
| Real-browser smoke             | Browser-mode (Playwright + chromium) — opt-in                          | top-level `__tests__/browser/` |

## File location

- Feature code → `src/features/<name>/__tests__/<mirrored path>.test.ts(x)`
- Shared code → `src/shared/<area>/__tests__/<name>.test.ts(x)`
- Cross-cutting → top-level `__tests__/`

## Recipes

### Pure function / hook-flavour Zustand store (`create()`)

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useCounterStore } from '../../stores/counterStore';

describe('counterStore', () => {
  beforeEach(() => {
    useCounterStore.getState().reset();
  });

  it('increments', () => {
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().value).toBe(1);
  });
});
```

### Vanilla Zustand store (`createStore()`) — typically paired with a service

The store import path may transitively load `@/shared/supabase`, which constructs a Realtime client and needs the global `WebSocket`. Mock the supabase module BEFORE importing the store. See [rules/30-testing.md](../../rules/30-testing.md) for the full pattern.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy({}, {
    get() {
      throw new Error('@/shared/supabase touched in unit test — mock it explicitly');
    },
  }),
}));

import { tasksStore } from '../../store/tasksStore';

describe('tasksStore', () => {
  beforeEach(() => {
    tasksStore.getState().reset();
  });

  it('initialize loads tasks from the (mock) service', async () => {
    await tasksStore.getState().initialize();
    expect(tasksStore.getState().isInitialized).toBe(true);
    expect(tasksStore.getState().tasks.length).toBeGreaterThan(0);
  });

  it('addTask prepends', async () => {
    await tasksStore.getState().initialize();
    await tasksStore.getState().addTask({ title: 'Hi' });
    expect(tasksStore.getState().tasks[0]?.title).toBe('Hi');
  });
});
```

### Service implementation (`Mock<X>Service`)

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { MockTasksService } from '../../services/implementations/MockTasksService';

describe('MockTasksService', () => {
  let service: MockTasksService;

  beforeEach(() => {
    service = new MockTasksService();
  });

  it('getAll returns the seeded tasks', async () => {
    const tasks = await service.getAll();
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('add prepends', async () => {
    const before = await service.getAll();
    const created = await service.add({ title: 'New' });
    const after = await service.getAll();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]?.id).toBe(created.id);
  });
});
```

### Component render

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '@/shared/ui/button';

describe('<Button />', () => {
  it('fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Hi</Button>);
    await user.click(screen.getByRole('button', { name: /hi/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

### Hook with logic

```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMyHook } from '../../hooks/useMyHook';

describe('useMyHook', () => {
  it('toggles', () => {
    const { result } = renderHook(() => useMyHook());
    act(() => result.current.toggle());
    expect(result.current.isOn).toBe(true);
  });
});
```

### Mocking a service

```ts
import { vi } from 'vitest';

vi.mock('@/features/users/services/usersApi', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: '1', name: 'Ada' }),
}));
```

For features that use the swappable-backend pattern, mock the facade (`<feature>Service`) rather than the factory or implementations:

```ts
vi.mock('@/features/tasks/services/tasksService', () => ({
  tasksService: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
```

Prefer mocking at the **service module boundary** (facade or Api wrapper) rather than mocking `fetch` globally; this keeps tests stable when the implementation switches transports.

### Page-level render test (with router)

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithRouter } from '@test/test-utils';

import { TasksIndexPage } from '../../pages/TasksIndexPage';

describe('<TasksIndexPage />', () => {
  it('renders a loading state, then the task list', async () => {
    renderWithRouter(<TasksIndexPage />, { routerEntries: ['/tasks'] });
    expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
    expect(await screen.findByText('Read the Eikon README')).toBeInTheDocument();
  });
});
```

`renderWithRouter` from `@test/test-utils` wraps the unit under test in a `MemoryRouter`. For pages that use `useParams` or `<Routes>`-level matching, render `<Routes>...</Routes>` inside the wrapper with custom `routerEntries`.

For pages whose service layer is too slow (or hits the network), mock the service module above the imports:

```ts
vi.mock('../../services/tasksService', () => ({
  tasksService: {
    getTasks: vi.fn().mockResolvedValue([/* fixtures */]),
    getTaskById: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));
```

If the fixtures need to be referenced from both the mock factory and the assertions, declare them inside `vi.hoisted(() => ({...}))`:

```ts
const { fixtures } = vi.hoisted(() => ({ fixtures: [/* ... */] }));
vi.mock('../../services/tasksService', () => ({
  tasksService: { getTasks: vi.fn().mockResolvedValue(fixtures), /* … */ },
}));
```

### Integration test (multi-layer, top-level)

Place in `__tests__/integration/<feature>-flow.test.tsx`. Use the REAL service (no `vi.mock` on `tasksService`) so the router → page → selectors → store → service chain is exercised. Mock only `@/shared/supabase` (the supabase impl never instantiates) and `@/shared/services` (force `useMock: true`).

```tsx
import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';

vi.mock('@/shared/supabase', () => ({ supabase: new Proxy({}, { get() { throw new Error('mock me'); } }) }));
vi.mock('@/shared/services', () => ({ serviceConfig: { useMock: true } }));

import { tasksRoutes } from '@/features/tasks';
import { MockTasksService } from '@/features/tasks/services/implementations/MockTasksService';
import { tasksService } from '@/features/tasks/services/tasksService';
import { tasksStore } from '@/features/tasks/store/tasksStore';

beforeEach(() => {
  tasksStore.getState().reset();
  if (tasksService instanceof MockTasksService) tasksService.__resetForTests();
});

it('lets the user create a task end-to-end', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/tasks/new']}>
      <Suspense fallback={null}><Routes>{tasksRoutes}</Routes></Suspense>
    </MemoryRouter>,
  );
  const title = await screen.findByLabelText(/title/i, undefined, { timeout: 4000 });
  await user.type(title, 'Hello');
  await user.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument(), { timeout: 4000 });
});
```

Lazy-loaded routes need a `<Suspense>` wrapper in the test — the production boundary lives in RootLayout, but integration tests rendering `<Routes>` directly must provide their own.

### Browser-mode e2e (`__tests__/browser/`, opt-in)

Run via `pnpm test:browser` after one-time `pnpm test:browser:setup`. Files live in `__tests__/browser/` and are excluded from the default `pnpm test`. Use the `@vitest/browser/context` API instead of `@testing-library/react`:

```tsx
import { page, userEvent } from '@vitest/browser/context';
import { render } from '@testing-library/react';

it('types and submits in real chromium', async () => {
  render(<MyForm />);
  await userEvent.fill(page.getByLabelText(/title/i), 'Hi');
  await userEvent.click(page.getByRole('button', { name: /submit/i }));
  await expect.element(page.getByText('Hi')).toBeInTheDocument();
});
```

Use browser mode sparingly — it costs ~5s per file and ~120MB on the first install.

### Async assertions

```ts
expect(await screen.findByText(/loaded/i)).toBeInTheDocument();
// or
await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
```

Never use `setTimeout` in tests.

## Completion checklist

- [ ] Test file mirrors the source path under `__tests__/`.
- [ ] Uses `getByRole` / `getByLabelText` / `getByText` over `getByTestId`.
- [ ] Uses `userEvent` (not `fireEvent`) for any non-trivial interaction.
- [ ] Mocks at the service boundary, not at `fetch`.
- [ ] No snapshot assertions (unless explicitly motivated).
- [ ] Test resets shared state in `beforeEach` if it touches a store.
- [ ] `pnpm test` passes locally.

## Don't

- Don't assert on internal state, lifecycle ordering, or class strings.
- Don't share state across tests through module-level variables.
- Don't `await` arbitrary `setTimeout` to wait for async — use `findBy*` / `waitFor`.
