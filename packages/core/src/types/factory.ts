/**
 * @fileoverview Factory types for Better Tables: the app-level `betterTables()`
 * instance and the `defineTable()` table-definition runtime.
 * @module types/factory
 *
 * @remarks
 * This is the 0.6 REPLACEMENT of the legacy per-table `betterTables()` shape
 * (`BetterTablesConfig<TRecord>` / `BetterTablesInstance<TRecord>` with a
 * `columns`/`filters`/`pagination`/... bag). Per the maintainer's 2026-07-12
 * release-policy decision (`plans/design/table-definition-dx.md`, "Maintainer
 * decisions"), the legacy shape is REMOVED outright -- same export names,
 * new signatures, no overload, no deprecation cycle. See
 * `plans/018-instance-api-runtime.md` for the promotion this file performs
 * (renaming the `experimental/table-def-v1.ts` prototype's `*V1`-suffixed
 * instance/defineTable types to their production names, same semantics).
 */

import type { ColumnBuilder } from '../builders/column-builder';
import type { PathColumnFactory } from '../builders/path-builders';
import type { FacetQueryParams, FetchDataParams, FetchDataResult } from './adapter';
import type { ColumnDefinition } from './column';
import type { FilterOption } from './filter';
import type { AdapterTableTypes, Paths, SchemaAwareAdapter, SchemaOf } from './paths';

// ============================================================================
// 1. The app-level instance: betterTables()
// ============================================================================

/**
 * A Better Tables plugin (Better-Auth-style: an array on the instance
 * config). Capability contributions and fetch-lifecycle hooks are SKETCHED
 * (not modeled) here -- see the design doc Step 1 decision 5. Plugins are
 * not this plan's critical path; the config seam is stored and passed
 * through, but no hook execution happens yet (deferred, per plan 018 scope).
 */
export interface TableDefPlugin {
  name: string;
  [key: string]: unknown;
}

/** Instance-wide defaults (Better-Auth-style config, design doc Step 1 decision 1). */
export interface BetterTablesDefaults {
  pageSize?: number;
  urlSync?: boolean;
}

/**
 * Configuration for the app-level `betterTables()` factory.
 *
 * @template TAdapter - The data adapter, optionally schema-aware via `$types`
 * (see {@link SchemaAwareAdapter} in `types/paths.ts`).
 */
export interface BetterTablesConfig<TAdapter extends object = SchemaAwareAdapter> {
  /** The data adapter. Carries `$types` (the schema catalog) when schema-aware. */
  database: TAdapter;
  /** Instance-wide defaults. */
  defaults?: BetterTablesDefaults;
  /** Plugin seam -- stored, not yet executed (hooks are a follow-up). */
  plugins?: TableDefPlugin[];
}

/**
 * The app-level Better Tables instance returned by `betterTables()`.
 *
 * Exposes `define()` as a method (design doc Step 1 decision 3's "method
 * form", for single-file/SPA apps where importing the instance's runtime
 * value everywhere is fine). The curried, type-only `defineTable<typeof
 * tables>()` free function (below) is the RSC-safe alternative.
 */
export interface BetterTablesInstance<TAdapter extends object = SchemaAwareAdapter> {
  /** The configured data adapter. */
  readonly database: TAdapter;
  /** Instance-wide defaults, as passed to `betterTables()`. */
  readonly defaults: BetterTablesDefaults;
  /** Registered plugins, as passed to `betterTables()`. */
  readonly plugins: TableDefPlugin[];
  /**
   * Type-only: the schema catalog carried by `TAdapter`. A phantom property,
   * never assigned or read at runtime -- see {@link SchemaAwareAdapter}.
   */
  readonly $types: SchemaOf<TAdapter>;
  /** The method form of `defineTable` -- see {@link DefineTableCurried}. */
  define: DefineTableCurried<BetterTablesInstance<TAdapter>>;

  /**
   * Query THROUGH a table definition instead of the raw adapter (plan 030,
   * findings 9 + 16): `tables.fetchData(usersTable, params)` injects
   * `primaryTable: usersTable.tableName` automatically -- the caller never
   * supplies (or omits) it -- and returns `FetchDataResult<TRow>` typed to
   * the table's own row, with no `as FetchDataResult<...>` cast.
   *
   * This is the ergonomic path multi-table schemas should use for reads.
   * `database.fetchData(...)` (the raw adapter method) remains available
   * for callers who need to bypass a single table (e.g. a cross-table
   * report query); on a multi-table schema, THAT path throws a
   * `SchemaError` rather than guessing when neither `columns` nor
   * `primaryTable` disambiguates it (see the Drizzle adapter's
   * `resolvePrimaryTableForRead`) -- this method makes that failure mode
   * unreachable by construction, since `primaryTable` is always supplied.
   *
   * @example
   * ```typescript
   * // No cast, no primaryTable to get wrong -- ticketsTable.$infer.Row is
   * // inferred automatically as the return row type.
   * const { data, total } = await tables.fetchData(ticketsTable, {
   *   pagination: { page: 1, limit: 20 },
   * });
   * ```
   */
  fetchData<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    params?: TableScopedFetchDataParams
  ): Promise<FetchDataResult<TRow>>;

  /**
   * Table-scoped `getFacetedValues`: `columnId` is typed against
   * `table.$infer.ColumnId`, so a typo'd or wrong-table column id is a
   * compile error. `database.getFacetedValues(columnId, params)` has no
   * `primaryTable` parameter at the adapter-contract level (unlike
   * `fetchData`), so this wrapper cannot inject one -- it delegates to the
   * SAME runtime column-based resolution `database.getFacetedValues`
   * already does. The value here is the typed `columnId`, not a new
   * runtime disambiguation guarantee.
   */
  getFacetedValues<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    columnId: TableDefInfer<TName, TRow>['ColumnId'],
    params?: FacetQueryParams
  ): Promise<Map<string, number>>;

  /** Table-scoped `getMinMaxValues` -- see {@link BetterTablesInstance.getFacetedValues}. */
  getMinMaxValues<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    columnId: TableDefInfer<TName, TRow>['ColumnId'],
    params?: FacetQueryParams
  ): Promise<[number, number]>;

  /** Table-scoped `getFilterOptions` -- see {@link BetterTablesInstance.getFacetedValues}. */
  getFilterOptions<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    columnId: TableDefInfer<TName, TRow>['ColumnId'],
    params?: FacetQueryParams
  ): Promise<FilterOption[]>;

  /**
   * Table-scoped write: injects the mutation target from `table.tableName`
   * (plan 047). Prefer this over `database.createRecord(data)` on multi-table
   * schemas — the heuristic `defaultMutationTable` is only a fallback for
   * direct adapter callers.
   */
  createRecord<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    data: Partial<TRow>
  ): Promise<TRow>;

  /** Table-scoped update — see {@link BetterTablesInstance.createRecord}. */
  updateRecord<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    id: string,
    data: Partial<TRow>
  ): Promise<TRow>;

  /** Table-scoped delete — see {@link BetterTablesInstance.createRecord}. */
  deleteRecord<TName extends string, TRow>(
    table: TableDefinition<TName, TRow>,
    id: string
  ): Promise<void>;
}

/**
 * Params for {@link BetterTablesInstance.fetchData}: identical to
 * `FetchDataParams` minus `primaryTable`, which the table-scoped method
 * injects itself from `table.tableName` -- a caller-supplied `primaryTable`
 * here would either be redundant or (worse) contradict the table being
 * queried through, so it's removed from the surface entirely rather than
 * silently ignored or validated at runtime.
 */
export type TableScopedFetchDataParams = Omit<FetchDataParams, 'primaryTable'>;

// ============================================================================
// 2. defineTable() -- schema-aware (curried) and explicit-row (tier-2)
// ============================================================================

/** Table names known to a schema-aware instance's adapter. */
export type TableNamesOf<TInstance> = TInstance extends {
  readonly $types: { tables: infer TTables };
}
  ? keyof TTables & string
  : never;

/** The relation-aware row type for table `TName` on a schema-aware instance. */
export type RowOf<TInstance, TName extends string> = TInstance extends {
  readonly $types: { tables: infer TTables };
}
  ? TName extends keyof TTables
    ? TTables[TName] extends AdapterTableTypes
      ? TTables[TName]['row']
      : never
    : never
  : never;

/**
 * A single entry in a `defineTable()` factory's `columns` array: either a
 * `t.*()` path builder (implicit `build()` at collection time -- design doc
 * Step 2 section 3) or an already-built `ColumnDefinition` (the raw escape
 * hatch, design doc Step 2 section 8).
 *
 * `any` here (not `unknown`) is a deliberate, narrow erasure: each column's
 * OWN value-type safety is already fully enforced at its `t.text(path)` /
 * `t.number(path)` / etc. call site inside the factory body (a wrong path is
 * a compile error there, before the value ever reaches this array). This
 * container type only needs to hold the heterogeneous result -- the same
 * boundary problem `defineColumns` (`builders/column-factory.ts`) solves for
 * the OUTPUT side; `defineTable`'s implicit-build step feeds every entry
 * through that SAME audited erasure function, not a new one.
 */
export type TableColumnEntry<TRow> =
  // biome-ignore lint/suspicious/noExplicitAny: narrow, documented erasure -- see doc comment above
  ColumnBuilder<TRow, any, string> | ColumnDefinition<TRow, any, string>;

/** The object a `defineTable()` factory function returns. */
export interface TableDefResult<TRow> {
  columns: ReadonlyArray<TableColumnEntry<TRow>>;
}

/**
 * `$infer` surface (design doc Step 1 decision 6).
 *
 * `FilterState` is reserved for plan 006's typed filter registry
 * (`ColumnRegistry`, `types/experimental/contract-v2.ts`) -- left as
 * `unknown` here since threading a real per-table registry through
 * `defineTable` is out of this plan's scope (see
 * `plans/018-instance-api-runtime.md`, "Deferred OUT of this plan").
 */
export interface TableDefInfer<TName extends string, TRow> {
  Row: TRow;
  /** Every valid path PLUS free-form computed-column ids. */
  ColumnId: Paths<TRow> | string;
  TableName: TName;
  /** Reserved for plan 006 (`ColumnRegistry`-derived filter state). */
  FilterState: unknown;
}

/** A table definition returned by `defineTable()` / `tables.define()`. */
export interface TableDefinition<TName extends string, TRow> {
  readonly tableName: TName;
  readonly columns: ColumnDefinition<TRow, unknown>[];
  /**
   * Internal marker (plan 054): column-SET inference was requested — either
   * the no-factory `define('users')` form, or a `...t.auto()` spread in the
   * factory's `columns`. Resolved lazily at mount by `resolveTableColumns`
   * against `adapter.describeColumns`; never resolved at definition time
   * (the curried `defineTable` form is deliberately runtime-adapter-free).
   *
   * Auto-inclusion is opt-in by design: declaring a subset of columns is
   * deliberate (schemas contain columns that must not silently render).
   */
  readonly autoColumns?: boolean;
  readonly $infer: TableDefInfer<TName, TRow>;
}

/**
 * The curried form: `defineTable<typeof tables>()('users', (t) => ({...}))`.
 * Curried because TS has no partial type-argument inference -- `TInstance`
 * must be supplied explicitly while `TName` is inferred from the call
 * (design doc Step 1 decision 3).
 *
 * The factory is optional (plan 054): `defineTable<T>()('users')` with NO
 * factory produces a fully inferred table (`columns: []` +
 * `autoColumns: true`), resolved lazily at mount via
 * `adapter.describeColumns`.
 */
export interface DefineTableCurried<TInstance> {
  /** No-factory form: every column inferred from the adapter schema at mount. */
  <TName extends TableNamesOf<TInstance>>(
    tableName: TName
  ): TableDefinition<TName, RowOf<TInstance, TName>>;
  <TName extends TableNamesOf<TInstance>>(
    tableName: TName,
    factory: (
      t: PathColumnFactory<RowOf<TInstance, TName>>
    ) => TableDefResult<RowOf<TInstance, TName>>
  ): TableDefinition<TName, RowOf<TInstance, TName>>;
}

/**
 * Tier-2 escape hatch for adapters without `$types` (REST, memory): an
 * explicit row generic replaces schema-derived inference. Table name is an
 * unconstrained `string` (there's no schema catalog to check it against),
 * but columns remain fully path-typed against `TRow`. The factory is
 * optional, same as {@link DefineTableCurried} (plan 054).
 */
export interface DefineTableRowCurried<TRow> {
  /** No-factory form: every column inferred from the adapter schema at mount. */
  (tableName: string): TableDefinition<string, TRow>;
  (
    tableName: string,
    factory: (t: PathColumnFactory<TRow>) => TableDefResult<TRow>
  ): TableDefinition<string, TRow>;
}

export type { AdapterTableTypes, AdapterTypes, SchemaAwareAdapter, SchemaOf } from './paths';
