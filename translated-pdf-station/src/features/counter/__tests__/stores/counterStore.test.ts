/**
 * @file counterStore.test.ts
 * @description Tests for the counter store's pure logic.
 */

// =================================================================================================
// Imports
// =================================================================================================

// --- Third-party Libraries ---
import { beforeEach, describe, expect, it } from 'vitest';

// --- Relative Imports ---
import { useCounterStore } from '../../stores/counterStore';

// =================================================================================================
// Tests
// =================================================================================================

describe('counterStore', () => {
  beforeEach(() => {
    useCounterStore.getState().reset();
  });

  it('starts at zero', () => {
    expect(useCounterStore.getState().value).toBe(0);
  });

  it('increments the value', () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().value).toBe(2);
  });

  it('decrements but never below zero', () => {
    useCounterStore.getState().decrement();
    expect(useCounterStore.getState().value).toBe(0);
  });

  it('resets to zero', () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().reset();
    expect(useCounterStore.getState().value).toBe(0);
  });
});
