/**
 * @fileoverview Shared subscribe/notify emitter base for the table managers.
 *
 * All six managers (filter, pagination, selection, sorting, virtualization,
 * table-state) hand-rolled an identical `subscribe` plus a notify method
 * that drifted across three different error policies. This base class is
 * the single implementation they all extend.
 *
 * @module lib/subscribable
 */

/**
 * Generic subscriber callback signature for a {@link Subscribable} emitter.
 */
export type SubscribableCallback<TEvent> = (event: TEvent) => void;

/**
 * Shared subscribe/notify emitter.
 *
 * Provides the subscribe/unsubscribe bookkeeping and a protected `notify`
 * used by manager subclasses to deliver events. The error policy is fixed:
 * every listener is invoked in a per-listener try/catch, a throwing
 * listener is logged via `console.error` (including the manager name) and
 * never rethrown, and remaining listeners still run. `notify` iterates a
 * snapshot of the listener array so a listener unsubscribing itself (or
 * another listener) during notification can't cause a listener to be
 * skipped.
 *
 * @template TEvent - The event type delivered to subscribers
 */
export class Subscribable<TEvent> {
  private subscribers: SubscribableCallback<TEvent>[] = [];

  /**
   * @param managerName - Human-readable manager name used in the
   * `console.error` message when a subscriber throws, e.g. `'filter
   * manager'` produces `'Error in filter manager subscriber:'`.
   */
  constructor(private readonly managerName: string) {}

  /**
   * Subscribe to events.
   *
   * @param callback - Function to call when an event is notified
   * @returns Unsubscribe function to remove the subscription
   */
  subscribe(callback: SubscribableCallback<TEvent>): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all current subscribers of an event.
   *
   * Iterates a snapshot of the subscriber list, so subscribing/unsubscribing
   * from within a listener never skips or double-calls a sibling listener
   * for this notification. Listener errors are caught individually and
   * logged; they never abort delivery to remaining listeners.
   */
  protected notify(event: TEvent): void {
    const snapshot = [...this.subscribers];
    for (const callback of snapshot) {
      try {
        callback(event);
      } catch (error) {
        // biome-ignore lint: Intentional error logging for subscriber errors
        console.error(`Error in ${this.managerName} subscriber:`, error);
      }
    }
  }

  /**
   * Remove all subscribers.
   */
  protected clearSubscribers(): void {
    this.subscribers.length = 0;
  }
}
