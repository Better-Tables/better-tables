/**
 * @fileoverview EXPERIMENTAL type prototype for "core contract v2": the
 * recursive AND/OR filter-group tree and the typed column registry that narrows
 * a filter's `columnId` and `values` to a table's real columns.
 *
 * @module types/experimental/contract-v2
 *
 * @remarks
 * This module backs the design in `plans/design/core-contract-v2.md`
 * (plan 006, Steps 3-4). It is a COMPILING TYPE PROTOTYPE used to validate the
 * contract BEFORE any runtime/serialization implementation exists. Nothing
 * under `src/` outside `experimental/` imports it, and it changes no production
 * type. Verify isolation with:
 *
 * ```sh
 * grep -rn "experimental/contract-v2" packages/core/src --include="*.ts" | grep -v experimental/
 * # -> 0 matches
 * ```
 *
 * Imports FROM parent production types are intentional and allowed: this is the
 * SAFE direction (parent types never import back, so isolation holds). It lets
 * the prototype reference the real filter leaf shape (`BaseFilterState`),
 * adapter result/meta, and pagination/sorting params so the v2 surface stays a
 * faithful superset rather than a parallel invention.
 *
 * ## Unresolved dependency: literal-preserving column ids
 *
 * `ColumnRegistry<TCols>` (below) keys the registry by each column's `id`
 * LITERAL. The live builder does NOT preserve id literals yet:
 * `ColumnBuilder.id(id: string): this` (`builders/column-builder.ts:106`) and
 * `ColumnDefinition['id']: string` (`types/column.ts:29`) both widen every id to
 * `string`, which would collapse a registry keyed off real column defs to
 * `{ [x: string]: ... }`. Until that follow-up lands (see the design doc's
 * "Unresolved dependency: literal-preserving column ids" section), this
 * prototype takes the design's option (b): it keys the tuple-based registry off
 * a local {@link ColumnDefLike} whose id literal is a type PARAMETER, so tests
 * supply literal ids via `as const` / a branded mock def. The row-derived
 * {@link RegistryFromRow} variant sidesteps the gap entirely (a row type's keys
 * are literal by construction) and shows how plan 011's `define()` would derive
 * the same registry from a resolved row -- one source of truth.
 *
 * The only runtime export is {@link isFilterGroupNode}; everything else is
 * type-level. The guard exists so `bun test` (which strips types but executes
 * the JS) has something to actually call.
 */

import type { AdapterMeta, FacetQueryParams, FetchDataResult } from '../adapter';
import type { BaseFilterState, FilterOption } from '../filter';
import type { PaginationParams } from '../pagination';
import type { SortingParams } from '../sorting';
import type { Paths, PathValue } from './table-def-v1';

// ============================================================================
// 1. Filter groups -- the recursive AND/OR tree (design Step 1)
// ============================================================================

/**
 * Boolean combinator for a group node. Deliberately just `'and' | 'or'` --
 * anything else (e.g. `'xor'`) is a compile error, and unknown logic is a
 * runtime drop per the design's fail-closed validation table (Step 1.4).
 */
export type FilterGroupLogic = 'and' | 'or';

/**
 * A boolean AND/OR node over other {@link FilterNode}s.
 *
 * Named `FilterGroupNode` -- NOT `FilterGroup` -- to avoid colliding with the
 * existing UI control-grouping `FilterGroup` in `types/filter.ts` (design
 * Step, unresolved-dependency note 2). The `kind: 'group'` discriminant is
 * collision-free: no `FilterState`/leaf carries a top-level `kind`, so it
 * cleanly separates a group from a leaf (see {@link isFilterGroupNode}).
 *
 * `TReg` threads the typed registry down to the leaves. It defaults to
 * `Record<string, unknown>`, which reproduces today's untyped behavior.
 *
 * NOTE: the depth cap (max 3, per `AdapterMetaV2.maxGroupDepth`) is a RUNTIME
 * validation concern (`isFilterNodeShape`, a later step); it is intentionally
 * not encoded in this recursive type.
 */
export interface FilterGroupNode<TReg = Record<string, unknown>> {
  /** Discriminant. No leaf has a top-level `kind`. */
  kind: 'group';
  /** How this group combines its children. */
  logic: FilterGroupLogic;
  /** Non-empty after validation; an empty/singleton group is normalized away. */
  children: Array<FilterNode<TReg>>;
}

/**
 * A single filter leaf, keyed and value-narrowed by the registry `TReg`.
 *
 * For each registered column `K`, the leaf reuses the real
 * {@link BaseFilterState} shape (`operator`/`includeNull`/`meta`) but pins
 * `columnId` to the literal `K` and ties `values` to that column's registered
 * value type. With the default `TReg = Record<string, unknown>`,
 * `keyof TReg & string` is `string`, so this collapses to
 * `{ columnId: string; values: unknown[]; ... }` -- exactly today's untyped
 * leaf. Every existing `FilterState` value is assignable to
 * `FilterStateFor<Record<string, unknown>>`, so the untyped path is unchanged.
 *
 * SIMPLIFICATION: the real `FilterState` is a `type`-discriminated union whose
 * `values` element type is fixed per `type` (text -> string[], number ->
 * number[], ...). This prototype instead derives the `values` element type
 * straight from `TReg[K]` to prove registry-keyed narrowing in isolation; the
 * per-`type` refinement is layered in by the production types step.
 */
export type FilterStateFor<TReg = Record<string, unknown>> = {
  [K in keyof TReg & string]: Omit<BaseFilterState, 'columnId'> & {
    columnId: K;
    values: Array<TReg[K]>;
  };
}[keyof TReg & string];

/**
 * The top of the recursive tree: a leaf OR a group. A bare `FilterStateFor`
 * array (implicit AND) and a `FilterGroupNode` are the two shapes callers use;
 * both are valid `FetchDataParamsV2['filters']` inputs.
 */
export type FilterNode<TReg = Record<string, unknown>> =
  | FilterStateFor<TReg>
  | FilterGroupNode<TReg>;

/**
 * Runtime discriminant: is this node an AND/OR group (vs a filter leaf)?
 *
 * Implemented as `node.kind === 'group'`, mirroring the design's
 * `isFilterGroupNode`. The cast is only needed because a leaf has no `kind`
 * property to narrow on structurally.
 */
export function isFilterGroupNode<TReg = Record<string, unknown>>(
  node: FilterNode<TReg>
): node is FilterGroupNode<TReg> {
  return (node as Partial<FilterGroupNode<TReg>>).kind === 'group';
}

// ============================================================================
// 2. Typed column registry (design Step 2)
// ============================================================================

/**
 * The minimal column-definition shape the registry derivation needs: an id
 * LITERAL (`TId`) as the key, plus a value type (`TValue`) carried
 * structurally via `accessor` so `ColumnRegistry` can `infer` it. This mirrors
 * a projection of `types/column.ts#ColumnDefinition<TData, TValue>` (plus the
 * `TId` literal that production ids don't carry yet -- see the file header).
 *
 * `accessor` is declared method-style on purpose: method parameters are checked
 * bivariantly, which keeps a tuple of concrete-row column defs assignable to
 * the `readonly ColumnDefLike[]` bound on {@link ColumnRegistry} without
 * resorting to `any`.
 */
export interface ColumnDefLike<TData = unknown, TValue = unknown, TId extends string = string> {
  /** The column id LITERAL -- becomes a registry key. */
  id: TId;
  /** Carries `TValue` structurally so the registry can infer it. */
  accessor(data: TData): TValue;
}

/**
 * Derive a `{ [id]: valueType }` registry from a built column tuple -- the
 * shape plan 006 sketched, keyed by each column's id literal.
 *
 * This ONLY narrows if the column ids are literal-preserving; production ids
 * are not yet (file header), so callers/tests build the tuple from
 * {@link ColumnDefLike} with explicit `TId` literals. Once the follow-up lands,
 * `ColumnDefinition<TData, TValue, TId>` slots in directly with no change here.
 */
export type ColumnRegistry<TCols extends readonly ColumnDefLike[]> = {
  [C in TCols[number] as C['id']]: C extends ColumnDefLike<unknown, infer V, string> ? V : never;
};

/**
 * The same registry, derived directly from a resolved ROW type via plan 011's
 * `Paths`/`PathValue`. This is the "one source of truth" tie-in: it is a pure
 * type FUNCTION of the row, keyed by every dotted path (relationship ids are
 * opaque literal keys -- design Step 2.3) and valued by the path's resolved
 * type. Unlike {@link ColumnRegistry}, it needs no literal-id builder, because
 * a row type's keys are already literal -- which is why it works TODAY while
 * the tuple form waits on literal-preserving ids.
 */
export type RegistryFromRow<TRow> = {
  [P in Paths<TRow>]: PathValue<TRow, P>;
};

// ============================================================================
// 3. Threading TReg through the adapter contract (design Step 2.2)
// ============================================================================

/**
 * `AdapterMeta` plus the two group-capability flags the design adds
 * (Step 1.2). Both optional so an untyped meta object still satisfies it;
 * absence means "no group support" / "depth 3 when supported".
 */
export interface AdapterMetaV2 extends AdapterMeta {
  /** Whether the adapter can execute `FilterGroupNode` trees. Default false. */
  supportsFilterGroups?: boolean;
  /** Max nesting the adapter accepts. Default 3 when groups are supported. */
  maxGroupDepth?: number;
}

/**
 * `FetchDataParams` with the registry threaded in. `columns` and the filter
 * tree narrow to registered keys; with the default registry `keyof TReg &
 * string` is `string`, so this is behaviorally identical to today's params.
 */
export interface FetchDataParamsV2<TReg = Record<string, unknown>> {
  pagination?: PaginationParams;
  sorting?: SortingParams[];
  /** A flat array (implicit AND) or a single group node (design Step 1.1). */
  filters?: Array<FilterStateFor<TReg>> | FilterGroupNode<TReg>;
  search?: string;
  columns?: Array<keyof TReg & string>;
  primaryTable?: string;
  params?: Record<string, unknown>;
}

/**
 * The v2 adapter surface: a second `TReg` generic on every stringly-typed
 * member, each defaulting so an untyped `TableAdapterV2<TData>` compiles and
 * behaves exactly as today (`columnId: string`). Passing a real registry
 * narrows the keyed methods to that table's columns.
 *
 * Only the read/keyed surface is modeled here (the design's Step 2.2 target);
 * write methods are Open question (d) and out of scope for this prototype.
 */
export interface TableAdapterV2<TData = unknown, TReg = Record<string, unknown>> {
  fetchData(params: FetchDataParamsV2<TReg>): Promise<FetchDataResult<TData>>;
  getFilterOptions(
    columnId: keyof TReg & string,
    params?: FacetQueryParams
  ): Promise<FilterOption[]>;
  getFacetedValues(
    columnId: keyof TReg & string,
    params?: FacetQueryParams
  ): Promise<Map<string, number>>;
  getMinMaxValues(
    columnId: keyof TReg & string,
    params?: FacetQueryParams
  ): Promise<[number, number]>;
  meta: AdapterMetaV2;
}
