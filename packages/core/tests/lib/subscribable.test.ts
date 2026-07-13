import { describe, expect, it, mock } from 'bun:test';
import { Subscribable } from '../../src/lib/subscribable';

type TestEvent = { type: 'tick'; value: number };

/** Minimal harness exposing the protected members for direct testing. */
class TestEmitter extends Subscribable<TestEvent> {
  fire(value: number): void {
    this.notify({ type: 'tick', value });
  }

  clear(): void {
    this.clearSubscribers();
  }
}

describe('Subscribable', () => {
  it('calls subscribers with the notified event', () => {
    const emitter = new TestEmitter('test emitter');
    const subscriber = mock();
    emitter.subscribe(subscriber);

    emitter.fire(1);

    expect(subscriber).toHaveBeenCalledWith({ type: 'tick', value: 1 });
  });

  it('supports multiple subscribers', () => {
    const emitter = new TestEmitter('test emitter');
    const a = mock();
    const b = mock();
    emitter.subscribe(a);
    emitter.subscribe(b);

    emitter.fire(1);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications for that callback', () => {
    const emitter = new TestEmitter('test emitter');
    const subscriber = mock();
    const unsubscribe = emitter.subscribe(subscriber);

    emitter.fire(1);
    unsubscribe();
    emitter.fire(2);

    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing an already-unsubscribed callback is a no-op', () => {
    const emitter = new TestEmitter('test emitter');
    const subscriber = mock();
    const unsubscribe = emitter.subscribe(subscriber);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();

    emitter.fire(1);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('logs a throwing listener with the manager name and keeps notifying siblings', () => {
    const emitter = new TestEmitter('widget manager');
    const originalError = console.error;
    const consoleSpy = mock();
    console.error = consoleSpy as typeof console.error;

    const throwing = mock(() => {
      throw new Error('boom');
    });
    const sibling = mock();
    emitter.subscribe(throwing);
    emitter.subscribe(sibling);

    expect(() => emitter.fire(1)).not.toThrow();

    expect(sibling).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Error in widget manager subscriber:', expect.any(Error));

    console.error = originalError;
  });

  it('a throwing listener does not prevent earlier-registered siblings either', () => {
    const emitter = new TestEmitter('widget manager');
    const originalError = console.error;
    console.error = mock() as typeof console.error;

    const before = mock();
    const throwing = mock(() => {
      throw new Error('boom');
    });
    emitter.subscribe(before);
    emitter.subscribe(throwing);

    emitter.fire(1);

    expect(before).toHaveBeenCalledTimes(1);

    console.error = originalError;
  });

  it('notify iterates a snapshot so unsubscribe-during-notify does not skip a sibling', () => {
    const emitter = new TestEmitter('test emitter');
    const second = mock();
    let unsubscribeFirst: () => void;

    const first = mock(() => {
      unsubscribeFirst();
    });

    unsubscribeFirst = emitter.subscribe(first);
    emitter.subscribe(second);

    emitter.fire(1);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('notify iterates a snapshot so subscribing-during-notify does not call the new listener for that event', () => {
    const emitter = new TestEmitter('test emitter');
    const late = mock();

    const first = mock(() => {
      emitter.subscribe(late);
    });

    emitter.subscribe(first);

    emitter.fire(1);
    expect(late).not.toHaveBeenCalled();

    emitter.fire(2);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('clearSubscribers removes all listeners', () => {
    const emitter = new TestEmitter('test emitter');
    const a = mock();
    const b = mock();
    emitter.subscribe(a);
    emitter.subscribe(b);

    emitter.clear();
    emitter.fire(1);

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});
