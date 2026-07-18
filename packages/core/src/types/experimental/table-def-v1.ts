/**
 * @fileoverview EXPERIMENTAL type prototype for the v1 "path-typed" table
 * definition DX (Better-Auth-style config + dot-path column builders).
 *
 * @module types/experimental/table-def-v1
 *
 * @remarks
 * This module backs the design in `plans/design/table-definition-dx.md`
 * (plan 011). It is a compiling type prototype used to validate the design
 * BEFORE any runtime implementation exists -- nothing under `src/` imports
 * it. Verify with:
 *
 * ```sh
 * grep -rn "experimental/table-def-v1" packages/core/src --include="*.ts" | grep -v experimental/
 * # -> 0 matches
 * ```
 *
 * The exported types are the load-bearing part of this file. The exported
 * functions have real (but intentionally trivial/"inert") runtime bodies --
 * just enough that the type-level tests in `tests/types/table-def-v1.test.ts`
 * can actually *call* them (via `bun test`, which strips types but still
 * executes the JS) without throwing, while their signatures drive full
 * compile-time checking via `bun run typecheck`. None of this is wired into
 * the public API surface (`src/index.ts` does not re-export this module).
 */

// ============================================================================
// 1. Path primitives
// ============================================================================

/**
 * Scalar/leaf value types. Anything assignable to `Primitive` terminates
 * path recursion -- it's a "field", not a "relation" to keep traversing.
 */
export type Primitive = string | number | boolean | bigint | Date | null | undefined;

/**
 * Depth-decrement lookup used to cap recursive path types.
 * `Prev[3] = 2`, `Prev[2] = 1`, `Prev[1] = 0`, `Prev[0] = never`.
 * Indexing with `never` is the recursion's base case (see `Paths` below).
 */
export type Prev = [never, 0, 1, 2, 3];

/**
 * All dot-notation paths reachable from `T`, capped at depth `D` (default 3).
 *
 * Mirrors the RUNTIME path semantics of
 * `packages/adapters/drizzle/src/relationship-manager.ts#resolveColumnPath`:
 *  - a plain field                    -> the field name itself (1 segment)
 *  - a to-one/to-many relation alias  -> the alias itself, PLUS
 *                                        `alias.<nested path>` (dotted)
 *  - array relations FLATTEN in paths (`posts.title`, not `posts[0].title`)
 *    -- matching the runtime's join semantics ("any related row's field")
 *
 * Depth cap rationale: relation types can be mutually recursive
 * (user -> posts -> author -> posts -> ...); an uncapped recursive
 * conditional type would not terminate. See the design doc, Step 2 section 1,
 * and the perf fixture in `tests/types/table-def-perf-fixture.ts` for the
 * budget this cap is tuned against.
 */
export type Paths<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends Primitive
    ? never
    : T extends readonly (infer E)[]
      ? Paths<E, Prev[D]>
      : {
          [K in keyof T & string]: NonNullable<T[K]> extends Primitive
            ? K
            : K | `${K}.${Paths<NonNullable<T[K]>, Prev[D]>}`;
        }[keyof T & string];

/**
 * True if `T` includes `null` and/or `undefined`.
 */
type IncludesNullish<T> = [Extract<T, null | undefined>] extends [never] ? false : true;

/**
 * Resolve a dot-notation path `P` against `T` to its value type, propagating
 * nullability along the way: if ANY segment on the path is optional and/or
 * nullable, the resolved value type is unioned with `null`.
 *
 * `undefined` is folded into `null` rather than surfaced separately -- a
 * missing relation is represented the way a LEFT JOIN represents it (a null
 * row), not as `undefined`. This keeps `PathValue` usable directly as a
 * column's runtime value type (renderers/filters see `string | null`, never
 * `string | null | undefined`).
 */
export type PathValue<T, P extends string> = T extends readonly (infer E)[]
  ? PathValue<E, P>
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? IncludesNullish<T[K]> extends true
        ? PathValue<NonNullable<T[K]>, Rest> | null
        : PathValue<T[K], Rest>
      : never
    : P extends keyof T
      ? IncludesNullish<T[P]> extends true
        ? NonNullable<T[P]> | null
        : T[P]
      : never;

/**
 * `Paths<T>` filtered down to only the paths whose resolved value extends
 * `V`. This is what powers e.g. `t.number('...')`'s autocomplete: only
 * numeric paths are offered, and passing a non-numeric path is a compile
 * error (the path fails the generic constraint).
 */
export type PathsOfType<T, V, D extends number = 3> = {
  [P in Paths<T, D>]: PathValue<T, P> extends V ? P : never;
}[Paths<T, D>];

/**
 * Paths whose resolved value is itself an array -- i.e. paths that name an
 * array-relation ALIAS (`'posts'`), not a scalar field reached through one
 * (`'posts.title'`, which resolves to a scalar, not an array). This is what
 * `t.count()` accepts: you count relation rows, you don't "count" a title.
 */
export type ArrayRelationPaths<T, D extends number = 3> = {
  [P in Paths<T, D>]: PathValue<T, P> extends readonly unknown[] ? P : never;
}[Paths<T, D>];

/**
 * Numeric paths reachable BENEATH a given array-relation path `Rel`
 * (e.g. `NumericPathsUnder<Row, 'orders'>` -> `'orders.amount'`).
 * Powers `t.sum()/.avg()/.min()/.max()` -- see design doc Step 2 section 5.
 */
export type NumericPathsUnder<T, Rel extends string, D extends number = 3> = Extract<
  PathsOfType<T, number, D>,
  `${Rel}.${string}`
>;

// ============================================================================
// 2. Adapter type protocol
// ============================================================================

/** Per-table type info an adapter can expose. */
export interface AdapterTableTypes {
  /**
   * The relation-aware row shape for this table. For a schema-aware adapter
   * (Drizzle, and eventually Prisma), this includes nested relation fields
   * up to the same depth cap `Paths` uses -- see design doc Step 1 decision 2
   * for the exact Drizzle recipe (`ExtractTablesWithRelations` +
   * `BuildQueryResult`), verified against the installed drizzle-orm package.
   */
  row: unknown;
}

/** The type-level schema catalog an adapter factory can attach. */
export interface AdapterTypes {
  tables: Record<string, AdapterTableTypes>;
}

/**
 * An adapter that carries type-level schema info via `$types`.
 *
 * `$types` is a TYPE-ONLY PHANTOM PROPERTY: it is declared optional and is
 * never assigned or read at runtime. Its sole purpose is to give
 * `defineTableV1` something to extract `TName`/`TRow` from at the type
 * level. Adapters without schema awareness (REST, in-memory) simply don't
 * populate `$types`; `defineTableRowV1` (below) is the escape hatch for
 * those (tier-2 DX: explicit row generic, still fully path-typed).
 */
export interface SchemaAwareAdapter<T extends AdapterTypes = AdapterTypes> {
  readonly $types?: T;
}

/** Extract the `AdapterTypes` catalog from a `SchemaAwareAdapter`. */
export type SchemaOf<TAdapter> = TAdapter extends SchemaAwareAdapter<infer T> ? T : never;

// ============================================================================
// 3. The app-level instance: betterTablesV1()
// ============================================================================

export interface TableDefPluginV1 {
  name: string;
  // Capability contributions + fetch-lifecycle hooks are SKETCHED (not
  // modeled) here -- see design doc Step 1 decision 5. Plugins are not this
  // prototype's critical path; this field only reserves the shape.
  [key: string]: unknown;
}

export interface BetterTablesV1Defaults {
  pageSize?: number;
  urlSync?: boolean;
}

export interface BetterTablesV1Config<TAdapter extends SchemaAwareAdapter> {
  database: TAdapter;
  defaults?: BetterTablesV1Defaults;
  plugins?: TableDefPluginV1[];
}

export interface BetterTablesV1Instance<TAdapter extends SchemaAwareAdapter> {
  readonly database: TAdapter;
  /** Type-only: the schema catalog carried by `TAdapter`. Phantom at runtime. */
  readonly $types: SchemaOf<TAdapter>;
}

/**
 * Create the app-level Better Tables instance (Better-Auth-style: ONE config
 * object, provider decided here). See design doc Step 1 decision 1.
 *
 * Inert at runtime beyond carrying `database` through -- `$types` is never
 * actually populated (see `SchemaAwareAdapter` doc above).
 */
export function betterTablesV1<TAdapter extends SchemaAwareAdapter>(
  config: BetterTablesV1Config<TAdapter>
): BetterTablesV1Instance<TAdapter> {
  return {
    database: config.database,
    // Phantom: intentionally not a real value. Never read at runtime.
    $types: undefined as unknown as SchemaOf<TAdapter>,
  };
}

// ============================================================================
// 4. The path-typed column builder mock (`t`)
// ============================================================================

/**
 * The fluent surface every path-typed builder shares. In the real
 * implementation (a follow-up to this design) these are the SAME builder
 * classes plan 005 types (`.label()`/`.sortable()`/`.filterable()`/
 * `.cellRenderer()` etc. keep chaining with proper `this`-typed returns);
 * this prototype models just enough of the chain to prove the path-typing
 * concept without re-implementing plan 005.
 */
export interface PathColumnBuilder<TData, TValue> {
  /** Shorthand for `.displayName()` on today's `ColumnBuilder` -- see design
   * doc open question (d): today's fluent API uses `.displayName()`, the
   * target DX brief shows `.label()`. This prototype takes `.label()` as an
   * ADDITIONAL alias, not a replacement. */
  label(label: string): PathColumnBuilder<TData, TValue>;
  sortable(sortable?: boolean): PathColumnBuilder<TData, TValue>;
  filterable(filterable?: boolean): PathColumnBuilder<TData, TValue>;
  cellRenderer(renderer: (value: TValue, row: TData) => unknown): PathColumnBuilder<TData, TValue>;
}

export interface NumberPathColumnBuilder<TData> extends PathColumnBuilder<TData, number | null> {
  range(min: number, max: number): NumberPathColumnBuilder<TData>;
}

export interface OptionValue<TValue extends string> {
  value: TValue;
  label: string;
  color?: string;
}

export interface OptionPathColumnBuilder<TData, TValue extends string>
  extends PathColumnBuilder<TData, TValue> {
  /**
   * Checked (not inferred) against the path-derived literal union -- unlike
   * today's `.options()` (which INFERS the value type from this array and
   * therefore needs plan 005's `const`-literal inference trick), the
   * path-typed `.option(path)` already knows `TValue` from `PathValue`. This
   * array is a plain compile-time membership check.
   */
  options(options: ReadonlyArray<OptionValue<TValue>>): OptionPathColumnBuilder<TData, TValue>;
}

export type CountPathColumnBuilder<TData> = PathColumnBuilder<TData, number>;

/**
 * Type-directed dispatch for `t.computed()`: the returned builder shape
 * follows the inferred value type `V`, mirroring `.asText()`/`.asNumber()`
 * style refinement without requiring an explicit call (see design doc
 * Step 2 section 4; explicit override remains possible by annotating `V`
 * at the call site).
 */
export type ComputedBuilderFor<TData, V> = V extends number
  ? NumberPathColumnBuilder<TData>
  : V extends string
    ? PathColumnBuilder<TData, V>
    : PathColumnBuilder<TData, V>;

/**
 * Escape hatch: a raw `ColumnDefinition`-shaped literal stays accepted by
 * `define()` (design doc Step 2 section 8). This mirrors (a simplified
 * projection of) `packages/core/src/types/column.ts#ColumnDefinition` --
 * not re-imported here to keep this prototype self-contained.
 */
export interface RawColumnDefinitionLike<TData> {
  id: string;
  displayName: string;
  accessor: (data: TData) => unknown;
  type: string;
  [key: string]: unknown;
}

/**
 * The mock `t` builder factory bound to a specific table's row type `TRow`.
 * Required members per plan 011 Step 3: `text/number/option/count/computed`.
 * A few more are included to demonstrate "everything today's fluent API can
 * express remains expressible" (design doc target-DX property list).
 */
export interface PathColumnFactory<TRow> {
  text<P extends PathsOfType<TRow, string | null>>(
    path: P
  ): PathColumnBuilder<TRow, PathValue<TRow, P>>;

  number<P extends PathsOfType<TRow, number | null>>(path: P): NumberPathColumnBuilder<TRow>;

  date<P extends PathsOfType<TRow, Date | null>>(
    path: P
  ): PathColumnBuilder<TRow, PathValue<TRow, P>>;

  boolean<P extends PathsOfType<TRow, boolean | null>>(
    path: P
  ): PathColumnBuilder<TRow, PathValue<TRow, P>>;

  /** Zero-config when the path's value is a literal union (e.g. a pg enum
   * column) -- see design doc Step 2 section 6. */
  option<P extends PathsOfType<TRow, string | null>>(
    path: P
  ): OptionPathColumnBuilder<TRow, Extract<NonNullable<PathValue<TRow, P>>, string>>;

  multiOption<P extends PathsOfType<TRow, readonly string[] | null>>(
    path: P
  ): OptionPathColumnBuilder<
    TRow,
    NonNullable<PathValue<TRow, P>> extends readonly (infer E)[] ? Extract<E, string> : never
  >;

  /** Paths to array relations only -- `t.count('profile')` on a to-one
   * relation is a compile error, not a runtime one. */
  count<P extends ArrayRelationPaths<TRow>>(path: P): CountPathColumnBuilder<TRow>;

  /** Numeric paths reached THROUGH an array relation. */
  sum<Rel extends ArrayRelationPaths<TRow>, P extends NumericPathsUnder<TRow, Rel>>(
    path: P
  ): NumberPathColumnBuilder<TRow>;

  /**
   * Free-form id (NOT a path). Computed ids must not collide with real
   * paths; `Exclude<string, Paths<Row>>` is not expressible in TS, so this
   * is a RUNTIME uniqueness check in the real implementation, not a type
   * constraint here (see design doc Step 2 section 4).
   */
  computed<TId extends string, TValue>(
    id: TId,
    accessor: (row: TRow) => TValue
  ): ComputedBuilderFor<TRow, TValue>;

  /** Passthrough escape hatch to the plan-005 fluent builder (design doc
   * Step 2 section 8) when no path fits. */
  custom<TValue = unknown>(): PathColumnBuilder<TRow, TValue>;
}

// ============================================================================
// 5. defineTableV1() -- schema-aware (curried) and explicit-row (tier-2)
// ============================================================================

export interface TableDefResultV1<TRow> {
  columns: Array<PathColumnBuilder<TRow, unknown> | RawColumnDefinitionLike<TRow>>;
}

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
 * `$infer` surface (design doc Step 1 decision 6). `FilterState` is owned by
 * plan 006's typed filter registry and intentionally left as `unknown` here
 * -- this prototype only reserves the property.
 */
export interface TableDefInferV1<TName extends string, TRow> {
  Row: TRow;
  ColumnId: Paths<TRow> | string; // `string` covers free-form computed ids
  TableName: TName;
  /** Reserved for plan 006 (`ColumnRegistry`-derived filter state). */
  FilterState: unknown;
}

export interface TableDefinitionV1<TName extends string, TRow> {
  readonly tableName: TName;
  readonly columns: TableDefResultV1<TRow>['columns'];
  readonly $infer: TableDefInferV1<TName, TRow>;
}

/**
 * The curried form: `defineTableV1<typeof tables>()('users', (t) => ({...}))`.
 * Curried because TS has no partial type-argument inference -- `TInstance`
 * must be supplied explicitly while `TName` is inferred from the call
 * (design doc Step 1 decision 3).
 */
export type DefineTableV1Curried<TInstance> = <TName extends TableNamesOf<TInstance>>(
  tableName: TName,
  factory: (
    t: PathColumnFactory<RowOf<TInstance, TName>>
  ) => TableDefResultV1<RowOf<TInstance, TName>>
) => TableDefinitionV1<TName, RowOf<TInstance, TName>>;

export function defineTableV1<TInstance>(): DefineTableV1Curried<TInstance> {
  return ((
    tableName: string,
    factory: (t: PathColumnFactory<unknown>) => TableDefResultV1<unknown>
  ) => {
    const result = factory(createMockPathColumnFactory());
    return {
      tableName,
      columns: result.columns,
      $infer: undefined as unknown,
    };
  }) as DefineTableV1Curried<TInstance>;
}

/**
 * Tier-2 escape hatch for adapters without `$types` (REST, memory): an
 * explicit row generic replaces schema-derived inference. Table name is an
 * unconstrained `string` (there's no schema catalog to check it against),
 * but columns remain fully path-typed against `TRow`.
 */
export type DefineTableRowV1Curried<TRow> = (
  tableName: string,
  factory: (t: PathColumnFactory<TRow>) => TableDefResultV1<TRow>
) => TableDefinitionV1<string, TRow>;

export function defineTableRowV1<TRow>(): DefineTableRowV1Curried<TRow> {
  return (tableName: string, factory: (t: PathColumnFactory<TRow>) => TableDefResultV1<TRow>) => {
    const result = factory(createMockPathColumnFactory<TRow>());
    return {
      tableName,
      columns: result.columns,
      $infer: undefined as unknown,
    } as TableDefinitionV1<string, TRow>;
  };
}

// ============================================================================
// 6. Inert mock builder implementation (runtime-safe, type-erased)
// ============================================================================
//
// Everything below exists ONLY so that expressions like `t.count('posts')`
// can be evaluated by `bun test` (which strips types but still executes the
// JS) without throwing. None of it is meant to resemble the real runtime
// implementation -- the chain just returns itself.

function createChainableMock(): Record<string, (...args: unknown[]) => unknown> {
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  const chain = () => builder;
  builder.label = chain;
  builder.sortable = chain;
  builder.filterable = chain;
  builder.cellRenderer = chain;
  builder.range = chain;
  builder.options = chain;
  return builder;
}

function createMockPathColumnFactory<TRow = unknown>(): PathColumnFactory<TRow> {
  const factory = {
    text: () => createChainableMock(),
    number: () => createChainableMock(),
    date: () => createChainableMock(),
    boolean: () => createChainableMock(),
    option: () => createChainableMock(),
    multiOption: () => createChainableMock(),
    count: () => createChainableMock(),
    sum: () => createChainableMock(),
    computed: () => createChainableMock(),
    custom: () => createChainableMock(),
  };
  return factory as unknown as PathColumnFactory<TRow>;
}
