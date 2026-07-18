/**
 * @fileoverview Dot-notation path types for schema-derived, autocompleted
 * column definitions (the `t.text('profile.location')` DX).
 *
 * @module types/paths
 *
 * @remarks
 * Promoted out of `types/experimental/table-def-v1.ts` (plan 011's compiling
 * prototype) per the design doc's Open Question (a): path types live in
 * `@better-tables/core`, not a separate package, because anyone using them is
 * already depending on core. See `plans/design/table-definition-dx.md`,
 * Step 2, for the full design rationale -- this file promotes the TYPE
 * MACHINERY verbatim (semantics unchanged); the reasoning/trade-offs live in
 * that doc, not repeated here.
 *
 * The runtime contract these types mirror is
 * `RelationshipManager.resolveColumnPath` in
 * `packages/adapters/drizzle/src/relationship-manager.ts` -- see the design
 * doc's Step 2 section 1 table for the exhaustive runtime-to-type mapping.
 */

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
 * conditional type would not terminate. Default depth is **3** (maintainer
 * decision 2026-07-17 / plan 046): ~10x/2.5x headroom on the perf fixture.
 * Pass `Paths<Row, 2>` (or another `D`) per call to lower the cap; re-measure
 * `tests/types/table-def-perf-fixture.ts` before ever changing the global
 * default.
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
 * (`'posts.title'`, which resolves to a scalar, not an array). Used by
 * aggregate builders (`t.count()`/`t.sum()` -- deferred out of this plan,
 * see `plans/018-instance-api-runtime.md`); kept here since it is a pure
 * function of `Paths`/`PathValue` and part of the promoted prototype.
 */
export type ArrayRelationPaths<T, D extends number = 3> = {
  [P in Paths<T, D>]: PathValue<T, P> extends readonly unknown[] ? P : never;
}[Paths<T, D>];

/**
 * Numeric paths reachable BENEATH a given array-relation path `Rel`
 * (e.g. `NumericPathsUnder<Row, 'orders'>` -> `'orders.amount'`).
 * Powers `t.sum()/.avg()/.min()/.max()` (deferred out of this plan).
 */
export type NumericPathsUnder<T, Rel extends string, D extends number = 3> = Extract<
  PathsOfType<T, number, D>,
  `${Rel}.${string}`
>;

// ============================================================================
// Adapter type protocol
// ============================================================================

/** Per-table type info an adapter can expose. */
export interface AdapterTableTypes {
  /**
   * The relation-aware row shape for this table. For a schema-aware adapter
   * (Drizzle, and eventually Prisma), this includes nested relation fields
   * up to the same depth cap `Paths` uses -- see the design doc's Step 1
   * decision 2 for the exact Drizzle recipe (`ExtractTablesWithRelations` +
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
 * `defineTable` something to extract `TName`/`TRow` from at the type level.
 * Adapters without schema awareness (REST, in-memory) simply don't populate
 * `$types`; the explicit-row `defineTable<TRow>()` form is the escape hatch
 * for those (tier-2 DX: explicit row generic, still fully path-typed).
 */
export interface SchemaAwareAdapter<T extends AdapterTypes = AdapterTypes> {
  readonly $types?: T;
}

/** Extract the `AdapterTypes` catalog from a `SchemaAwareAdapter`. */
export type SchemaOf<TAdapter> = TAdapter extends SchemaAwareAdapter<infer T> ? T : never;
