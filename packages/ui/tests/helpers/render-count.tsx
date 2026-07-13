import type { ProfilerOnRenderCallback } from 'react';
import { Profiler } from 'react';

/**
 * Counts React commits per `<Profiler id>` for characterization/regression
 * tests. Pass `counter.onRender` to every `<Profiler>` you render; read
 * counts back with `countFor(id)`.
 */
export interface RenderCounter {
  onRender: ProfilerOnRenderCallback;
  countFor: (id: string) => number;
  totalRenders: () => number;
  reset: () => void;
}

export function createRenderCounter(): RenderCounter {
  const counts = new Map<string, number>();

  const onRender: ProfilerOnRenderCallback = (id) => {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  };

  return {
    onRender,
    countFor: (id) => counts.get(id) ?? 0,
    totalRenders: () => Array.from(counts.values()).reduce((sum, n) => sum + n, 0),
    reset: () => counts.clear(),
  };
}

export { Profiler };

/**
 * Mocks the global `ResizeObserver` (absent in happy-dom) so tests can count
 * constructor calls and currently-active observers.
 *
 * Simplifying assumption: every observer instance in this codebase observes
 * exactly one element (a table row, or a virtualization container), so
 * `disconnect()`/`unobserve()` decrement the active count by 1 regardless of
 * how many elements were passed to `observe()`. That matches every call site
 * under test; revisit if a multi-element observer appears.
 */
export interface ResizeObserverMock {
  /** Restore whatever `ResizeObserver` existed (or didn't) before installing. */
  restore: () => void;
  /** How many times `new ResizeObserver(cb)` has been called. */
  constructionCount: () => number;
  /** How many times `.observe()` has been called across all instances. */
  observeCallCount: () => number;
  /** Net active observers: `.observe()` calls minus `.disconnect()`/`.unobserve()` calls. */
  activeObserverCount: () => number;
  /** Manually fire an observer's callback (simulates a real resize) by construction order. */
  triggerResize: (constructionIndex: number, contentRect: Partial<DOMRectReadOnly>) => void;
}

export function installResizeObserverMock(): ResizeObserverMock {
  const globalObject = globalThis as { ResizeObserver?: typeof ResizeObserver };
  const original = globalObject.ResizeObserver;

  let constructions = 0;
  let observeCalls = 0;
  let active = 0;
  const callbacks: ResizeObserverCallback[] = [];

  class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
      constructions += 1;
    }

    observe() {
      observeCalls += 1;
      active += 1;
    }

    unobserve() {
      active = Math.max(0, active - 1);
    }

    disconnect() {
      active = Math.max(0, active - 1);
    }
  }

  globalObject.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

  return {
    restore: () => {
      if (original) {
        globalObject.ResizeObserver = original;
      } else {
        delete globalObject.ResizeObserver;
      }
    },
    constructionCount: () => constructions,
    observeCallCount: () => observeCalls,
    activeObserverCount: () => active,
    triggerResize: (constructionIndex, contentRect) => {
      const callback = callbacks[constructionIndex];
      if (!callback) return;
      callback(
        [{ contentRect } as unknown as ResizeObserverEntry],
        undefined as unknown as ResizeObserver
      );
    },
  };
}
