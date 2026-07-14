/**
 * @fileoverview The app-level `betterTables()` instance + `defineTable()`
 * table-definition runtime.
 * @module factory
 *
 * @description
 * This is the 0.6 runtime realization of the plan 011 design
 * (`plans/design/table-definition-dx.md`) and its compiling prototype
 * (`packages/core/src/types/experimental/table-def-v1.ts`). Per the
 * maintainer's 2026-07-12 release-policy decision, it REPLACES the legacy
 * per-table `betterTables(config)` shell outright -- same export name, new
 * signature, no overload, no deprecation cycle (`plans/018-instance-api-runtime.md`).
 *
 * @example
 * ```typescript
 * import { betterTables, defineTable } from '@better-tables/core';
 * import { drizzleAdapter } from '@better-tables/adapters-drizzle';
 *
 * export const tables = betterTables({
 *   database: drizzleAdapter(db),          // carries $types (schema catalog)
 *   defaults: { pageSize: 20 },
 *   plugins: [],
 * });
 *
 * export const usersTable = defineTable<typeof tables>()('users', (t) => ({
 *   columns: [
 *     t.text('name'),
 *     t.number('age').range(18, 100),
 *     t.option('role').options([
 *       { value: 'admin', label: 'Admin' },
 *       { value: 'editor', label: 'Editor' },
 *     ]),
 *   ],
 * }));
 * // also supported: tables.define('users', (t) => ({...})) -- method form
 * ```
 */

import type { ColumnBuilder } from './builders/column-builder';
import { validateColumns } from './builders/column-factory';
import { createPathColumnFactory, type PathColumnFactory } from './builders/path-builders';
import type { FacetQueryParams, TableAdapter } from './types/adapter';
import type { ColumnDefinition } from './types/column';
import type {
  BetterTablesConfig,
  BetterTablesInstance,
  DefineTableCurried,
  DefineTableRowCurried,
  RowOf,
  TableColumnEntry,
  TableDefinition,
  TableDefResult,
  TableNamesOf,
  TableScopedFetchDataParams,
} from './types/factory';
import type { SchemaAwareAdapter } from './types/paths';

/**
 * Create the app-level Better Tables instance (Better-Auth-style: ONE config
 * object, provider decided here). See design doc Step 1 decision 1.
 *
 * `$types` is a type-only phantom -- never assigned or read at runtime; see
 * {@link SchemaAwareAdapter}.
 */
export function betterTables<TAdapter extends SchemaAwareAdapter>(
  config: BetterTablesConfig<TAdapter>
): BetterTablesInstance<TAdapter> {
  const instance = {
    database: config.database,
    defaults: config.defaults ?? {},
    plugins: config.plugins ?? [],
    // Phantom: intentionally not a real value. Never read at runtime.
    $types: undefined,
  } as unknown as BetterTablesInstance<TAdapter>;

  // The method form (design doc Step 1 decision 3): `tables.define('users', (t) => ({...}))`.
  // Implemented via the same erasure/cast bridge as the standalone `defineTable()`/
  // `defineTableRow()` curried functions below -- see their doc comments.
  instance.define = ((
    tableName: string,
    factory: (t: PathColumnFactory<unknown>) => TableDefResult<unknown>
  ) => defineTableImpl(tableName, factory)) as unknown as DefineTableCurried<
    BetterTablesInstance<TAdapter>
  >;

  // The table-scoped read surface (plan 030, findings 9 + 16): every method
  // here injects `primaryTable: table.tableName` (where the adapter
  // contract supports it -- see `TableScopedFetchDataParams`'s doc comment)
  // and returns a result typed to the TABLE's own row/columnId, not the
  // whole-schema union `TAdapter` is generic over. `asTableAdapter` is the
  // single audited erasure point bridging `config.database` (typed only as
  // `SchemaAwareAdapter`, i.e. carrying no compile-time guarantee of
  // `fetchData` et al.) to the real `TableAdapter` interface every
  // concrete adapter (Drizzle, REST, memory, ...) implements at runtime --
  // the same trust boundary `defineTableImpl`'s cast documents above.
  instance.fetchData = (async (
    table: TableDefinition<string, unknown>,
    params?: TableScopedFetchDataParams
  ) => {
    return asTableAdapter(config.database).fetchData({
      ...params,
      primaryTable: table.tableName,
    });
  }) as unknown as BetterTablesInstance<TAdapter>['fetchData'];

  instance.getFacetedValues = (async (
    _table: TableDefinition<string, unknown>,
    columnId: string,
    params?: FacetQueryParams
  ) => {
    return asTableAdapter(config.database).getFacetedValues(columnId, params);
  }) as unknown as BetterTablesInstance<TAdapter>['getFacetedValues'];

  instance.getMinMaxValues = (async (
    _table: TableDefinition<string, unknown>,
    columnId: string,
    params?: FacetQueryParams
  ) => {
    return asTableAdapter(config.database).getMinMaxValues(columnId, params);
  }) as unknown as BetterTablesInstance<TAdapter>['getMinMaxValues'];

  instance.getFilterOptions = (async (
    _table: TableDefinition<string, unknown>,
    columnId: string,
    params?: FacetQueryParams
  ) => {
    return asTableAdapter(config.database).getFilterOptions(columnId, params);
  }) as unknown as BetterTablesInstance<TAdapter>['getFilterOptions'];

  return instance;
}

/**
 * Single audited erasure point: `SchemaAwareAdapter` (the generic
 * constraint `betterTables<TAdapter>` is written against) only guarantees a
 * `$types` phantom, not the real `fetchData`/`getFacetedValues`/... methods
 * every concrete adapter implements. Every real adapter DOES implement
 * `TableAdapter` at runtime (it's how `database.fetchData(...)` already
 * worked before this table-scoped surface existed); this cast documents
 * that fact once, rather than re-asserting it at each call site above.
 */
function asTableAdapter(database: unknown): TableAdapter<unknown> {
  return database as TableAdapter<unknown>;
}

/**
 * Build every column entry in a `defineTable()` factory's `columns` array
 * into a real `ColumnDefinition`, calling `.build()` on any builder entries
 * (the "implicit build" design decision -- Step 2 section 3) and passing raw
 * `ColumnDefinition` literals through unchanged (the escape hatch -- Step 2
 * section 8). Duplicate-id validation reuses `validateColumns`'s existing
 * check (`builders/column-factory.ts`) -- the same runtime check the design
 * doc names for computed-id/real-path collisions (Step 2 section 4), since
 * `Exclude<string, Paths<Row>>` cannot be expressed at the type level.
 *
 * The final erasure to `ColumnDefinition<TRow, unknown>[]` is the SAME
 * single-cast pattern `defineColumns()` (`builders/column-factory.ts`) uses
 * for its own value-type erasure -- applied inline here (rather than calling
 * `defineColumns` itself) because `defineColumns` is shaped for a literal
 * call-site tuple (per-element compile-time inference), while this
 * function's input is a dynamic-length array assembled at runtime from a
 * heterogeneous factory return. One audited erasure POINT (this function),
 * not a second erasure MECHANISM.
 */
function buildTableColumns<TRow>(
  tableName: string,
  entries: ReadonlyArray<TableColumnEntry<TRow>>
): ColumnDefinition<TRow, unknown>[] {
  const built = entries.map((entry) => {
    const maybeBuilder = entry as unknown as ColumnBuilder<TRow, unknown>;
    return typeof maybeBuilder.build === 'function'
      ? maybeBuilder.build()
      : (entry as ColumnDefinition<TRow, unknown>);
  });

  const validation = validateColumns(built as unknown as ColumnDefinition[]);
  if (!validation.valid) {
    throw new Error(
      `defineTable('${tableName}'): invalid columns -- ${validation.errors.join('; ')}`
    );
  }

  // Single audited erasure to the table boundary's value-type-erased shape --
  // see the doc comment above.
  return built as unknown as ColumnDefinition<TRow, unknown>[];
}

/** Shared implementation behind `defineTable<TInstance>()(...)`, `defineTableRow<TRow>()(...)`, and `tables.define(...)`. */
function defineTableImpl<TRow>(
  tableName: string,
  factory: (t: PathColumnFactory<TRow>) => TableDefResult<TRow>
): TableDefinition<string, TRow> {
  const t = createPathColumnFactory<TRow>();
  const result = factory(t);
  const columns = buildTableColumns<TRow>(tableName, result.columns);

  return {
    tableName,
    columns,
    // Type-only phantom -- $infer is never read at runtime, see TableDefInfer.
    $infer: undefined as unknown as TableDefinition<string, TRow>['$infer'],
  };
}

/**
 * The curried form: `defineTable<typeof tables>()('users', (t) => ({...}))`.
 *
 * Curried because TypeScript has no partial type-argument inference --
 * `TInstance` must be supplied explicitly while the table name's literal
 * type is inferred from the call (design doc Step 1 decision 3). This is the
 * RSC-safe form: it needs only `import type { tables } from '../tables'`, no
 * runtime import of the instance (and therefore no transitive DB-driver
 * import) in files that only define column shapes.
 *
 * The `as unknown as DefineTableCurried<TInstance>` bridge is necessary
 * because the runtime implementation is a single, non-generic function
 * (`defineTableImpl`) doing the real work for every table, while the public
 * type is a per-call-site generic signature (`TName` inferred fresh at each
 * call) -- TypeScript generics have no runtime representation to dispatch
 * on, so the cast documents "this implementation is correct for every `TRow`
 * the caller instantiates it with," the same trust boundary
 * `ColumnBuilder.id()`/`.accessor()` already cross internally.
 */
export function defineTable<TInstance>(): DefineTableCurried<TInstance> {
  return ((
    tableName: string,
    factory: (t: PathColumnFactory<unknown>) => TableDefResult<unknown>
  ) => defineTableImpl(tableName, factory)) as unknown as DefineTableCurried<TInstance>;
}

/**
 * Tier-2 escape hatch for adapters without `$types` (REST, memory): an
 * explicit row generic replaces schema-derived inference. Table name is an
 * unconstrained `string` (no schema catalog to check it against), but
 * columns remain fully path-typed against `TRow`.
 */
export function defineTableRow<TRow>(): DefineTableRowCurried<TRow> {
  return ((tableName: string, factory: (t: PathColumnFactory<TRow>) => TableDefResult<TRow>) =>
    defineTableImpl<TRow>(tableName, factory)) as unknown as DefineTableRowCurried<TRow>;
}

export type { TableNamesOf, RowOf };
