/**
 * @file MockTasksService.test.ts
 * @description Tests for the in-memory MockTasksService implementation.
 *
 * Exercises every method on the ITasksService contract against a
 * fresh instance per test, so seed mutations from one case can't
 * bleed into another.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { beforeEach, describe, expect, it } from 'vitest';

// --- Relative Imports ---
import { MockTasksService } from '../../services/implementations/MockTasksService';

// =================================================================================================
// Tests
// =================================================================================================

describe('MockTasksService', () => {
  let service: MockTasksService;

  beforeEach(() => {
    service = new MockTasksService();
  });

  it('returns the seed tasks newest-first', async () => {
    const tasks = await service.getTasks();
    expect(tasks.length).toBe(3);
    for (let i = 1; i < tasks.length; i++) {
      expect(
        tasks[i - 1]!.createdAt.localeCompare(tasks[i]!.createdAt)
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('finds a known task by id', async () => {
    const tasks = await service.getTasks();
    const first = tasks[0]!;
    const found = await service.getTaskById(first.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(first.id);
  });

  it('returns null for an unknown id', async () => {
    expect(await service.getTaskById('does-not-exist')).toBeNull();
  });

  it('adds a task with title + optional description', async () => {
    const before = (await service.getTasks()).length;
    const created = await service.addTask({
      title: 'Hello',
      description: 'World',
    });
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Hello');
    expect(created.status).toBe('pending');
    const after = await service.getTasks();
    expect(after.length).toBe(before + 1);
  });

  it('updates a task and returns the new record', async () => {
    const all = await service.getTasks();
    const t = all[0]!;
    const next = await service.updateTask(t.id, { status: 'completed' });
    expect(next.status).toBe('completed');
    const refetched = await service.getTaskById(t.id);
    expect(refetched?.status).toBe('completed');
  });

  it('throws when updating an unknown id', async () => {
    await expect(
      service.updateTask('does-not-exist', { status: 'completed' })
    ).rejects.toThrow(/not found/i);
  });

  it('deletes a task by id', async () => {
    const all = await service.getTasks();
    const t = all[0]!;
    await service.deleteTask(t.id);
    expect(await service.getTaskById(t.id)).toBeNull();
  });

  it('isolates state across instances', async () => {
    const a = new MockTasksService();
    const b = new MockTasksService();
    await a.addTask({ title: 'A-only' });
    const aTasks = await a.getTasks();
    const bTasks = await b.getTasks();
    expect(aTasks.length).toBe(bTasks.length + 1);
  });
});
