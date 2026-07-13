---
"@better-tables/core": patch
---

The six managers (`FilterManager`, `PaginationManager`, `SelectionManager`,
`SortingManager`, `VirtualizationManager`, `TableStateManager`) now extend a
shared `Subscribable` emitter (`packages/core/src/lib/subscribable.ts`)
instead of each hand-rolling subscribe/notify. `subscribe`, its unsubscribe
return, and every manager's event types are unchanged.

Two visible behavior changes, both intentional:

- A subscriber that throws is now always caught and logged via
  `console.error` (including the manager name), never rethrown. Previously
  `sorting-manager`, `virtualization-manager`, and `table-state-manager`
  swallowed subscriber errors silently with no trace; they now log like
  `filter-manager`, `pagination-manager`, and `selection-manager` already did.
- Notify now iterates a snapshot of the listener array, so a listener that
  subscribes or unsubscribes another listener from within its own callback
  can no longer cause a sibling listener to be skipped or double-invoked for
  that event. This fixes a latent hazard present in all six previous
  hand-rolled implementations.

`TableStateManager`'s `flushStateChanged` batching (added in a prior plan)
is unchanged -- it still decides when to notify; it now just calls the
inherited `notify` for delivery.
