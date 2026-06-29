/**
 * @file tasksStore.test.ts
 * @description Tests for the vanilla tasksStore.
 *
 * Exercises the store via `getState()` / `setState()` directly so the
 * tests don't need a React renderer. The supabase module is mocked at
 * the top of the file because importing the real client in a Node test
 * runtime constructs a Realtime client that needs `WebSocket` — which
 * happy-dom doesn't provide.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { beforeEach, describe, expect, it, vi } from 'vitest';

// =================================================================================================
// Module mocks (must be hoisted ABOVE imports of code-under-test)
// =================================================================================================

vi.mock('@/shared/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get() {
        throw new Error(
          '@/shared/supabase was accessed in a unit test — mock it explicitly.'
        );
      },
    }
  ),
}));

// --- Relative Imports (after vi.mock) ---
import { tasksStore } from '../../store/tasksStore';

// =================================================================================================
// Tests
// =================================================================================================

describe('tasksStore', () => {
  beforeEach(() => {
    tasksStore.getState().reset();
  });

  it('starts empty and uninitialised', () => {
    const s = tasksStore.getState();
    expect(s.tasks).toEqual([]);
    expect(s.isInitialized).toBe(false);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('loads tasks via initialize', async () => {
    await tasksStore.getState().initialize();
    const s = tasksStore.getState();
    expect(s.isInitialized).toBe(true);
    expect(s.error).toBeNull();
    expect(s.tasks.length).toBeGreaterThan(0);
  });

  it('initialize is idempotent — second call is a no-op', async () => {
    await tasksStore.getState().initialize();
    const after = tasksStore.getState().tasks;
    await tasksStore.getState().initialize();
    expect(tasksStore.getState().tasks).toBe(after);
  });

  it('addTask prepends the new entry', async () => {
    await tasksStore.getState().initialize();
    const before = tasksStore.getState().tasks.length;
    const created = await tasksStore
      .getState()
      .addTask({ title: 'Hello', description: 'World' });
    const tasks = tasksStore.getState().tasks;
    expect(tasks.length).toBe(before + 1);
    expect(tasks[0]?.id).toBe(created.id);
    expect(tasks[0]?.title).toBe('Hello');
  });

  it('subscribeWithSelector fires when a slice changes', async () => {
    const handler = vi.fn();
    const unsubscribe = tasksStore.subscribe(
      (s) => s.tasks.length,
      handler
    );
    await tasksStore.getState().initialize();
    expect(handler).toHaveBeenCalled();
    unsubscribe();
  });
});
