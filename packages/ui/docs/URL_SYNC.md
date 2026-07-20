# URL Synchronization

> **Canonical docs:** [better-tables.com/docs/url-state](https://better-tables.com/docs/url-state)
> (source: `apps/marketing/content/docs/url-state.mdx`). The full teaching —
> adapter interface, framework adapters (Next.js, React Router, vanilla),
> `UrlSyncConfig` flags, the `c:` compressed parameter format, and SSR
> hydration via `deserializeTableStateFromUrl` — lives there. This file is
> only a pointer for readers browsing the repo.

Quick orientation for contributors:

- `useTableUrlSync(tableId, config, adapter)` is implemented in
  `src/hooks/use-table-url-sync.ts` (also exports `createVanillaUrlAdapter`).
- The adapter type (`UrlSyncAdapter`), `UrlSyncConfig`, and the
  serialization machinery (`serializeTableStateToUrl` /
  `deserializeTableStateFromUrl`, lz-string compression) live in
  `@better-tables/core` (`packages/core/src/stores/url-sync-adapter.ts`,
  `packages/core/src/utils/url-serialization.ts`).
- `<BetterTable urlSync={{ adapter, config }}>` wires the hook internally;
  calling the hook directly is equivalent.
- Syncable state: `filters`, `pagination`, `sorting`, `columnVisibility`,
  `columnOrder`.

In-repo demos import from the workspace package `@better-tables/ui`;
consumers import the copied files instead (see the canonical page).
