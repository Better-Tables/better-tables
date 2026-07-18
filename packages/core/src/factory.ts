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
import {
  createPathColumnFactory,
  isAutoColumnsSentinel,
  type PathColumnFactory,
} from './builders/path-builders';
import {
  buildCellEditPolicy,
  type CellEditAction,
  type CellEditPolicy,
} from './lib/cell-edit-core';
import type { FacetQueryParams, InferredColumnSpec, TableAdapter } from './types/adapter';
import type { ColumnDefinition, ColumnType } from './types/column';
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
 * {@link SchemaAwareAdapter}. The constraint is `object`, NOT
 * `SchemaAwareAdapter`: `SchemaAwareAdapter` is all-optional (`{ $types?: T }`),
 * so constraining to it triggers TypeScript's weak-type detection and REJECTS
 * every adapter that doesn't carry `$types` ("has no properties in common") --
 * i.e. exactly the REST/in-memory/`httpAdapter` adapters `SchemaAwareAdapter`'s
 * own docs say are supported. `SchemaOf<TAdapter>` still extracts the catalog
 * when `$types` is present, and falls back to the untyped-name behavior (the
 * documented `defineTable<TRow>()` escape hatch) when it isn't.
 */
export function betterTables<TAdapter extends object>(
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
    factory?: (t: PathColumnFactory<unknown>) => TableDefResult<unknown>
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

  // Table-scoped writes (plan 047): inject `{ table: table.tableName }` so
  // multi-table schemas don't rely on defaultMutationTable at the instance
  // level. The low-level adapter keeps a single-table form + optional
  // MutationOptions.table seam (option A).
  instance.createRecord = (async (
    table: TableDefinition<string, unknown>,
    data: Partial<unknown>
  ) => {
    const adapter = asTableAdapter(config.database);
    if (!adapter.createRecord) {
      throw new Error('Adapter does not support createRecord');
    }
    return adapter.createRecord(data, { table: table.tableName });
  }) as unknown as BetterTablesInstance<TAdapter>['createRecord'];

  instance.updateRecord = (async (
    table: TableDefinition<string, unknown>,
    id: string,
    data: Partial<unknown>
  ) => {
    const adapter = asTableAdapter(config.database);
    if (!adapter.updateRecord) {
      throw new Error('Adapter does not support updateRecord');
    }
    return adapter.updateRecord(id, data, { table: table.tableName });
  }) as unknown as BetterTablesInstance<TAdapter>['updateRecord'];

  instance.deleteRecord = (async (table: TableDefinition<string, unknown>, id: string) => {
    const adapter = asTableAdapter(config.database);
    if (!adapter.deleteRecord) {
      throw new Error('Adapter does not support deleteRecord');
    }
    return adapter.deleteRecord(id, { table: table.tableName });
  }) as unknown as BetterTablesInstance<TAdapter>['deleteRecord'];

  // Zero-boilerplate cell saves (plan 055): one generated plain-async
  // function per table definition, memoized so a `'use server'` module can
  // call `tables.cellEditAction(def)(input)` per request without rebuilding
  // the policy. The policy itself builds lazily on the FIRST call (it is
  // async — dot columns resolve through the adapter capability).
  const cellEditActions = new WeakMap<object, CellEditAction>();
  instance.cellEditAction = ((tableDef: TableDefinition<string, unknown>) => {
    const existing = cellEditActions.get(tableDef);
    if (existing) return existing;

    let policyPromise: Promise<CellEditPolicy> | null = null;
    const action: CellEditAction = async (input) => {
      policyPromise ??= buildCellEditPolicy(tableDef, asTableAdapter(config.database));
      const policy = await policyPromise;

      const check = policy.check(input);
      if (!check.ok) {
        return { ok: false, error: check.error };
      }

      try {
        const adapter = asTableAdapter(config.database);
        if (typeof adapter.updateRecord !== 'function') {
          return { ok: false, error: 'Adapter does not support updates.' };
        }
        // Low-level adapter form with an EXPLICIT table: dot columns write
        // the RELATED table; own-table targets carry the def's own tableName.
        const data = await adapter.updateRecord(
          input.id,
          { [check.target.field]: check.value },
          { table: check.target.table }
        );
        return { ok: true, data };
      } catch (error) {
        // Never leak adapter/DB internals across the action boundary.
        console.error('[better-tables] cellEditAction failed:', error);
        return { ok: false, error: 'Save failed.' };
      }
    };

    cellEditActions.set(tableDef, action);
    return action;
  }) as BetterTablesInstance<TAdapter>['cellEditAction'];

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
): { columns: ColumnDefinition<TRow, unknown>[]; autoColumns: boolean } {
  // Strip `t.auto()` sentinels first (plan 054): they mark column-SET
  // inference on the definition and never become real columns, so they must
  // not reach validation (a sentinel isn't a valid column) nor render.
  let autoColumns = false;
  const concrete = entries.filter((entry) => {
    if (isAutoColumnsSentinel(entry)) {
      autoColumns = true;
      return false;
    }
    return true;
  });

  const built = concrete.map((entry) => {
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
  return { columns: built as unknown as ColumnDefinition<TRow, unknown>[], autoColumns };
}

/**
 * Shared implementation behind `defineTable<TInstance>()(...)`,
 * `defineTableRow<TRow>()(...)`, and `tables.define(...)`.
 *
 * `factory` is optional (plan 054): the no-factory form produces a fully
 * inferred table — `columns: []` + `autoColumns: true`, resolved lazily at
 * mount by {@link resolveTableColumns}.
 */
function defineTableImpl<TRow>(
  tableName: string,
  factory?: (t: PathColumnFactory<TRow>) => TableDefResult<TRow>
): TableDefinition<string, TRow> {
  if (!factory) {
    return {
      tableName,
      columns: [],
      autoColumns: true,
      // Type-only phantom -- $infer is never read at runtime, see TableDefInfer.
      $infer: undefined as unknown as TableDefinition<string, TRow>['$infer'],
    };
  }

  const t = createPathColumnFactory<TRow>();
  const result = factory(t);
  const { columns, autoColumns } = buildTableColumns<TRow>(tableName, result.columns);

  return {
    tableName,
    columns,
    ...(autoColumns ? { autoColumns: true } : {}),
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
    factory?: (t: PathColumnFactory<unknown>) => TableDefResult<unknown>
  ) => defineTableImpl(tableName, factory)) as unknown as DefineTableCurried<TInstance>;
}

/**
 * Tier-2 escape hatch for adapters without `$types` (REST, memory): an
 * explicit row generic replaces schema-derived inference. Table name is an
 * unconstrained `string` (no schema catalog to check it against), but
 * columns remain fully path-typed against `TRow`.
 */
export function defineTableRow<TRow>(): DefineTableRowCurried<TRow> {
  return ((tableName: string, factory?: (t: PathColumnFactory<TRow>) => TableDefResult<TRow>) =>
    defineTableImpl<TRow>(tableName, factory)) as unknown as DefineTableRowCurried<TRow>;
}

// ============================================================================
// Lazy column resolution (plan 054)
// ============================================================================

/** Dev-mode warn — advisory diagnostics only, silenced in production builds. */
function devWarn(message: string): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  console.warn(message);
}

/**
 * Coarse type families for the declared-vs-schema mismatch warn: a declared
 * type is compatible with the schema-inferred one when they share a family
 * or the declaration is a common storage refinement (e.g. `multiOption`
 * over a JSON/text column holding an encoded array, `text` over an enum).
 */
const COLUMN_TYPE_FAMILIES: Record<ColumnType, string> = {
  text: 'string',
  email: 'string',
  url: 'string',
  phone: 'string',
  option: 'string',
  number: 'number',
  currency: 'number',
  percentage: 'number',
  date: 'date',
  boolean: 'boolean',
  multiOption: 'array',
  json: 'json',
  custom: 'any',
};

function declaredTypeMatchesSpec(declared: ColumnType, inferred: ColumnType): boolean {
  const declaredFamily = COLUMN_TYPE_FAMILIES[declared];
  const inferredFamily = COLUMN_TYPE_FAMILIES[inferred];
  if (declaredFamily === 'any' || inferredFamily === 'any') return true;
  if (declaredFamily === inferredFamily) return true;
  // String/JSON storage commonly backs richer declared types.
  if (inferredFamily === 'string' && (declaredFamily === 'array' || declaredFamily === 'json')) {
    return true;
  }
  if (inferredFamily === 'json' && (declaredFamily === 'array' || declaredFamily === 'string')) {
    return true;
  }
  return false;
}

/** An option/multiOption column with no declared (or enriched) choices. */
function columnHasEnrichableGap(column: ColumnDefinition<unknown, unknown>): boolean {
  if (column.type !== 'option' && column.type !== 'multiOption') return false;
  const options = column.filter?.options;
  return !options || options.length === 0;
}

/**
 * Whether mounting `def` needs a `resolveTableColumns` pass: the definition
 * requested column-set inference (`autoColumns`), or an explicit column has
 * a gap enrichment can fill (an option column without options). Fully
 * declared tables return `false` — they must not pay a resolution
 * round-trip (plan 054).
 */
export function tableNeedsColumnResolution<TName extends string, TRow>(
  def: TableDefinition<TName, TRow>
): boolean {
  if (def.autoColumns) return true;
  return def.columns.some((column) =>
    columnHasEnrichableGap(column as ColumnDefinition<unknown, unknown>)
  );
}

/** The one member of `TableAdapter` the resolver needs — structural, so any adapter (or none) fits. */
type DescribeColumnsSource = Pick<TableAdapter<unknown>, 'describeColumns'>;

/** Stable placeholder cache key for "no adapter" so those calls memoize too. */
const MISSING_ADAPTER_KEY: object = Object.freeze({});

/** Memoized resolutions per (definition, adapter) pair — see {@link resolveTableColumns}. */
const resolvedColumnsCache = new WeakMap<
  object,
  WeakMap<object, Promise<ColumnDefinition<unknown, unknown>[]>>
>();

function enrichExplicitColumn(
  tableName: string,
  column: ColumnDefinition<unknown, unknown>,
  spec: InferredColumnSpec | undefined
): ColumnDefinition<unknown, unknown> {
  if (!spec) return column;

  if (!declaredTypeMatchesSpec(column.type, spec.columnType)) {
    devWarn(
      `[better-tables] resolveTableColumns('${tableName}'): column '${column.id}' is declared ` +
        `'${column.type}' but the schema says '${spec.columnType}' — the declaration wins, but ` +
        `check the column definition.`
    );
  }

  // Fill gaps only — declared values always win. Today the only enrichable
  // gap is option choices (plan 054); schema enum values back an
  // option/multiOption column that declared none.
  if (columnHasEnrichableGap(column) && spec.options && spec.options.length > 0) {
    return {
      ...column,
      filter: { ...column.filter, options: spec.options },
    };
  }

  return column;
}

function buildInferredColumn(spec: InferredColumnSpec): ColumnDefinition<unknown, unknown> {
  const field = spec.field;
  return {
    id: field,
    displayName: spec.label,
    accessor: (row: unknown) => (row == null ? undefined : (row as Record<string, unknown>)[field]),
    type: spec.columnType,
    sortable: true,
    filterable: true,
    hideable: true,
    // NOT editable: inferred columns are read-only until explicitly
    // overridden (`[...t.auto(), t.text('subject').editable()]`).
    ...(spec.options && spec.options.length > 0 ? { filter: { options: spec.options } } : {}),
  };
}

async function resolveTableColumnsUncached(
  def: TableDefinition<string, unknown>,
  adapter: DescribeColumnsSource | null | undefined
): Promise<ColumnDefinition<unknown, unknown>[]> {
  const describe = adapter?.describeColumns;
  if (typeof describe !== 'function') {
    // Enrichment silently no-ops (columns behave exactly as declared);
    // requested column-set inference degrades to the explicit list with a
    // dev warn — nothing to infer from.
    if (def.autoColumns) {
      devWarn(
        `[better-tables] resolveTableColumns('${def.tableName}'): the adapter does not ` +
          `implement describeColumns — auto columns resolve to the explicitly declared list.`
      );
    }
    return def.columns;
  }

  let specs: InferredColumnSpec[];
  try {
    specs = await describe.call(adapter, def.tableName);
  } catch (error) {
    devWarn(
      `[better-tables] resolveTableColumns('${def.tableName}'): describeColumns failed ` +
        `(${error instanceof Error ? error.message : String(error)}) — falling back to the ` +
        `declared columns.`
    );
    return def.columns;
  }

  const specByField = new Map(specs.map((spec) => [spec.field, spec]));

  // 1. Enrichment — ALWAYS runs, `t.auto()` NOT required: fill config the
  //    user didn't declare on explicit columns. Declared values always win.
  const explicit = def.columns.map((column) =>
    enrichExplicitColumn(def.tableName, column, specByField.get(column.id))
  );

  if (!def.autoColumns) return explicit;

  // 2. Column-set inference — ONLY when requested: build real definitions
  //    for the remaining spec fields. Explicit wins by id; order is explicit
  //    first, then inferred in stable schema order.
  const declaredIds = new Set(def.columns.map((column) => column.id));
  const inferred = specs
    .filter((spec) => !declaredIds.has(spec.field))
    .map((spec) => buildInferredColumn(spec));

  return [...explicit, ...inferred];
}

/**
 * Resolve a table definition's columns against an adapter (plan 054) — the
 * ONE lazy resolver behind both auto-column halves:
 *
 * 1. **Enrichment** (always): explicit columns matching a schema field get
 *    config the user didn't declare filled in — today, enum options on an
 *    `option`/`multiOption` column with no `.options()`. Declared values
 *    always win; a declared-vs-schema type contradiction is a dev warn.
 * 2. **Column-set inference** (only when the definition carries the
 *    `autoColumns` marker — `t.auto()` or the no-factory `define`): the
 *    remaining schema fields become real, read-only column definitions,
 *    appended after the explicit ones in stable schema order.
 *
 * Runs lazily at mount, never at definition time — the curried `defineTable`
 * form is deliberately runtime-adapter-free (RSC-safe). Memoized per
 * (definition, adapter) pair; an adapter without `describeColumns` resolves
 * to the declared columns unchanged (dev warn only when inference was
 * requested).
 */
export function resolveTableColumns<TName extends string, TRow>(
  def: TableDefinition<TName, TRow>,
  adapter: DescribeColumnsSource | null | undefined
): Promise<ColumnDefinition<TRow, unknown>[]> {
  const defKey = def as object;
  const adapterKey = (adapter ?? MISSING_ADAPTER_KEY) as object;

  let perAdapter = resolvedColumnsCache.get(defKey);
  if (!perAdapter) {
    perAdapter = new WeakMap();
    resolvedColumnsCache.set(defKey, perAdapter);
  }

  const cached = perAdapter.get(adapterKey);
  if (cached) {
    return cached as Promise<ColumnDefinition<TRow, unknown>[]>;
  }

  const pending = resolveTableColumnsUncached(
    def as unknown as TableDefinition<string, unknown>,
    adapter
  );
  perAdapter.set(adapterKey, pending);
  return pending as Promise<ColumnDefinition<TRow, unknown>[]>;
}

export type { TableNamesOf, RowOf };
