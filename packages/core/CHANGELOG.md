# @better-tables/core

## 0.5.4

### Patch Changes

- Move table state and URL sync into @better-tables/core and slim down @better-tables/ui. Demo imports updated to use core; adds a Zustand-backed table store and consolidates utilities.

  - **Refactors**

    - Introduced core stores: table-store, table-registry, and a framework-agnostic UrlSyncAdapter.
    - Moved server URL utilities and serialization to core and re-exported under core/lib and core/utils.
    - Removed UI server bundle and internal stores; UI now uses core APIs and re-exports the URL sync hook.
    - Updated UI components to import format and filter helpers from core; minor UI tweak to pagination button variants.
    - Pinned date-fns to 4.1.0 and added zustand for state management; added typecheck scripts across packages.

  - **Migration**
    - Replace `@better-tables/ui/server` imports with `@better-tables/core` (e.g., `parseTableSearchParams`).
    - Import `UrlSyncAdapter`, `getOrCreateTableStore`, `getTableStore`, and `destroyTableStore` from `@better-tables/core`.
    - Update components/hooks to use format and filter utilities from `@better-tables/core`.
    - Run `pnpm typecheck` to catch any remaining outdated imports.

## 0.5.3

### Patch Changes

- Adds compressed URL state sync for tables (filters, sorting, column visibility, and column order) and a new urlSync API in BetterTable for easy sharing and SSR-friendly URLs.

## 0.5.2

### Patch Changes

- Fixes filter and table state sync by creating the table store synchronously, and prevents hydration warnings in the FilterBar. Enhance FilterHandler to support JSONB field extraction and improve security validations.

## 0.5.1

### Patch Changes

- Fixed JSON accessor column resolution and extraction for MySQL, PostgreSQL, and SQLite. JSON fields can now be accessed using dot notation (e.g., `survey.title`) and are properly extracted at the SQL level and nested in the response data.
