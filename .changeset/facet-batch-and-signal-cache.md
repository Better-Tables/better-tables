---
"@better-tables/core": minor
---

Faster facet reads over HTTP: batched requests and a cache that works with
abort signals.

- New optional `TableAdapter.getFacets(requests, params)` answers several
  facet reads (`'values'` → `getFacetedValues` shape, `'minmax'` →
  `getMinMaxValues` shape) in one call, with the same per-column
  self-exclusion semantics. `httpAdapter` implements it as a single POST
  (new `getFacets` wire method, capped at `MAX_FACET_BATCH_SIZE` entries),
  and `handleAdapterRequest` serves it — preferring the server adapter's own
  `getFacets` and falling back to fanning out to the singular methods
  server-side. A K-facet sidebar refresh is now one HTTP round-trip instead
  of K.
- `httpAdapter`'s TTL cache/dedup no longer bypasses reads that carry an
  `AbortSignal` (previously every `useFacets` read went straight to the
  network). A fresh cached result is returned regardless of signal;
  concurrent identical reads share one underlying request with per-caller
  abort semantics — aborting one caller rejects only that caller, and the
  shared request is cancelled only when every caller has aborted. Aborted
  and failed requests are never cached.

Pair client and server on the same `@better-tables/core` version: a new
client's batched facet reads need a server whose route handler understands
the `getFacets` method.
