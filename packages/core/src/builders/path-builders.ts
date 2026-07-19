/**
 * @fileoverview The `t.*()` path-typed column builder factory -- the runtime
 * realization of the plan 011 design's `PathColumnFactory` prototype
 * (`packages/core/src/types/experimental/table-def-v1.ts`).
 *
 * @module builders/path-builders
 *
 * @remarks
 * `t.text(path)` / `t.number(path)` / etc. are THIN typed wrappers: they
 * construct the matching landed fluent builder (plan 005/014's
 * `TextColumnBuilder`, `NumberColumnBuilder`, ...), pre-load `.id(path)`,
 * `.accessor(<derived getter>)`, and `.displayName(humanize(lastSegment))`,
 * then return the SAME subclass instance so `.range()`, `.options()`,
 * `.cellRenderer()`, etc. keep chaining exactly as the hand-written fluent
 * API does. This is what makes the "identical `ColumnDefinition`" invariant
 * (`plans/design/table-definition-dx.md`, migration story) hold: a path
 * builder and its fluent equivalent produce the SAME `ColumnDefinition`
 * object shape, because they ARE the same builder class underneath.
 *
 * See `plans/018-instance-api-runtime.md` Step 3 for the scope this file
 * implements, and its "Deferred OUT of this plan" list for what's
 * intentionally NOT here: `t.count()`/`t.sum()` (aggregate builders --
 * need adapter execution work), `t.json().path()`, and runtime enum
 * auto-OPTIONS metadata.
 */

import { humanize, lastPathSegment } from '../lib/format-utils';
import type { ColumnDefinition } from '../types/column';
import type { Paths, PathsOfType, PathValue } from '../types/paths';
import { BooleanColumnBuilder } from './boolean-column-builder';
import { ColumnBuilder } from './column-builder';
import { DateColumnBuilder } from './date-column-builder';
import { MultiOptionColumnBuilder } from './multi-option-column-builder';
import { NumberColumnBuilder } from './number-column-builder';
import { OptionColumnBuilder } from './option-column-builder';
import { TextColumnBuilder } from './text-column-builder';

/**
 * Walk a dot-notation path against a row, matching the RUNTIME accessor
 * semantics `RelationshipManager.resolveColumnPath` implements at the
 * adapter layer (design doc Step 2 section 1): optional-chained field
 * access, with an array-relation hop (`?.[0]`) taken BEFORE continuing past
 * an array-valued intermediate segment -- e.g. for `'posts.title'`, resolves
 * to `row?.posts?.[0]?.title`, matching how the demo hand-writes
 * `u.posts?.[0]?.title` today. A leaf path that itself names an array
 * relation (`'posts'`) returns the array unchanged (no hop -- the hop only
 * applies to segments AFTER an array is encountered, not the array's own
 * terminal segment).
 *
 * Documented display-level semantic (design doc Step "Derived accessor"):
 * this is for DISPLAY only. Filtering happens adapter-side by columnId
 * (`RelationshipManager.resolveColumnPath`), which applies the full
 * relational join semantics -- this accessor is a client-side convenience
 * for rendering the SAME kind of "first match" value the demo code already
 * hand-writes.
 */
export function buildPathAccessor(path: string): (row: unknown) => unknown {
  const segments = path.split('.');
  return (row: unknown) => {
    let current: unknown = row;
    for (const segment of segments) {
      if (Array.isArray(current)) {
        current = current[0];
      }
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  };
}

// ============================================================================
// The `t.auto()` sentinel (plan 054)
// ============================================================================

/**
 * Marker property identifying the `t.auto()` sentinel entry. A plain string
 * property (not a symbol) so the marker survives any structural copying a
 * caller might do to the columns array before `defineTable` collects it.
 */
const AUTO_COLUMNS_MARKER = '__betterTablesAutoColumns';

/** Well-known id of the sentinel — never rendered; filtered out at build time. */
export const AUTO_COLUMNS_SENTINEL_ID = '__better_tables_auto__';

/**
 * True when a columns-array entry is the `t.auto()` sentinel. Used by
 * `defineTable`'s implicit-build step to strip the sentinel and set the
 * definition's `autoColumns` marker instead — the sentinel itself never
 * becomes a real column.
 */
export function isAutoColumnsSentinel(entry: unknown): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    (entry as Record<string, unknown>)[AUTO_COLUMNS_MARKER] === true
  );
}

/**
 * Build the sentinel `t.auto()` returns (inside a one-element array so it can
 * be SPREAD into a columns list: `[...t.auto(), overrides]`). Shaped like a
 * minimal `ColumnDefinition` so it flows through `TableDefResult`'s existing
 * public shape unchanged; `buildTableColumns` removes it before validation.
 */
function createAutoColumnsSentinel<TRow>(): ColumnDefinition<TRow, unknown> {
  const sentinel = {
    [AUTO_COLUMNS_MARKER]: true,
    id: AUTO_COLUMNS_SENTINEL_ID,
    displayName: 'Auto columns',
    type: 'custom' as const,
    accessor: () => undefined,
  };
  return sentinel as unknown as ColumnDefinition<TRow, unknown>;
}

// ============================================================================
// The `t` builder factory shape
// ============================================================================

/**
 * Type-directed dispatch for `t.computed()`: the returned builder's shape
 * follows the inferred value type `V` (design doc Step 2 section 4).
 *
 * Note the runtime honesty boundary this dispatch stops at: TypeScript
 * generics are erased, so a SINGLE generic `computed(id, accessor)`
 * implementation cannot runtime-branch on `V` to decide which concrete
 * builder CLASS to instantiate (there is no sample row available at
 * `defineTable()` time to probe the accessor's actual return value).
 * Instantiating, say, a real `NumberColumnBuilder` only when `V extends
 * number` would require knowing `V` at runtime, which is impossible. This
 * plan's runtime therefore always constructs the base `ColumnBuilder<TRow,
 * TValue, TId>` (`type: 'custom'`) for computed columns -- honest (the
 * runtime object always matches its declared type), at the cost of NOT
 * exposing subclass-only methods like `.range()`/`.options()` on computed
 * columns. This is a deliberate, reported simplification versus the
 * `experimental/table-def-v1.ts` prototype's `ComputedBuilderFor`, whose
 * mock implementation could paper over the gap because ITS runtime object
 * was an inert duck-typed mock supporting every method name unconditionally
 * -- not an option for a real, working builder. See
 * `plans/018-instance-api-runtime.md` NOTES for the full rationale.
 */
export type ComputedBuilder<TData, TValue, TId extends string = string> = ColumnBuilder<
  TData,
  TValue,
  TId
>;

/**
 * The `t` builder factory bound to a specific table's row type `TRow`.
 * Implements plan 011 Step 3's required members
 * (`text/number/date/boolean/option/multiOption/computed/custom`).
 *
 * `t.count()`/`t.sum()` (aggregate builders) are deliberately NOT modeled --
 * deferred out of this plan (see module docblock).
 */
export interface PathColumnFactory<TRow> {
  text<P extends PathsOfType<TRow, string | null>>(
    path: P
  ): TextColumnBuilder<TRow, Extract<NonNullable<PathValue<TRow, P>>, string>, P>;

  number<P extends PathsOfType<TRow, number | null>>(
    path: P
  ): NumberColumnBuilder<TRow, Extract<NonNullable<PathValue<TRow, P>>, number>, P>;

  date<P extends PathsOfType<TRow, Date | null>>(
    path: P
  ): DateColumnBuilder<TRow, Extract<NonNullable<PathValue<TRow, P>>, Date>, P>;

  boolean<P extends PathsOfType<TRow, boolean | null>>(
    path: P
  ): BooleanColumnBuilder<TRow, Extract<NonNullable<PathValue<TRow, P>>, boolean>, P>;

  /** Zero-config when the path's value is a literal union (e.g. a pg enum
   * column) -- see design doc Step 2 section 6. Runtime enum auto-OPTIONS
   * (populating `.options()` from adapter schema metadata) is deferred. */
  option<P extends PathsOfType<TRow, string | null>>(
    path: P
  ): OptionColumnBuilder<TRow, Extract<NonNullable<PathValue<TRow, P>>, string>, P>;

  multiOption<P extends PathsOfType<TRow, readonly string[] | null>>(
    path: P
  ): MultiOptionColumnBuilder<
    TRow,
    NonNullable<PathValue<TRow, P>> extends readonly (infer E)[] ? Extract<E, string>[] : never,
    P
  >;

  /**
   * Free-form id (NOT a path). Computed-id/real-path collisions are a
   * RUNTIME check (`defineTable`'s implicit-build step, reusing
   * `validateColumns`'s existing duplicate-id check), not a compile-time
   * constraint -- `Exclude<string, Paths<Row>>` is not expressible in
   * TypeScript (design doc Step 2 section 4).
   */
  computed<TId extends string, TValue>(
    id: TId,
    accessor: (row: TRow) => TValue
  ): ComputedBuilder<TRow, TValue, TId>;

  /** Passthrough escape hatch to the plan-005 fluent builder (design doc
   * Step 2 section 8) when no path fits. Unconfigured -- caller must still
   * call `.id()`/`.accessor()`/`.displayName()` themselves. */
  custom<TValue = unknown>(): ColumnBuilder<TRow, TValue>;

  /**
   * Include every REMAINING schema column, inferred from
   * `adapter.describeColumns` lazily at mount (plan 054). Spread it into the
   * columns list — explicit entries always win by id:
   *
   * ```typescript
   * columns: [...t.auto(), t.text('subject').editable()]
   * ```
   *
   * `t.auto()`'s ONLY job is column-SET inclusion ("and the rest of the
   * table's columns"). Per-column enrichment (e.g. enum options on a
   * declared `t.option()` with no `.options()`) happens with or without it.
   * Inferred columns are read-only — `.editable()` requires an explicit
   * entry.
   */
  auto(): ColumnDefinition<TRow, unknown>[];
}

// ============================================================================
// Runtime implementation
// ============================================================================

/** Derive the default `.displayName()` for a path: `humanize(lastSegment(path))`. */
function defaultLabel(path: string): string {
  return humanize(lastPathSegment(path));
}

/**
 * Create the `t` builder factory for a table's row type `TRow`.
 *
 * Each method below pre-loads a landed fluent builder (`.id()`, `.accessor()`
 * with the path-derived getter, `.displayName()`) and returns the SAME
 * subclass instance, so subclass-only chain methods keep working. The single
 * cast per method (`buildPathAccessor(path) as (row: TRow) => V`) is
 * necessary because `buildPathAccessor` is a generic runtime string-walker
 * with no compile-time knowledge of the schema; it is the one audited cast
 * this file introduces, mirroring the sanctioned pattern already used by
 * `ColumnBuilder.id()`/`.accessor()` (`as unknown as` internally) and
 * `defineColumns()` (`builders/column-factory.ts`).
 */
export function createPathColumnFactory<TRow>(): PathColumnFactory<TRow> {
  return {
    text<P extends PathsOfType<TRow, string | null>>(path: P) {
      type V = Extract<NonNullable<PathValue<TRow, P>>, string>;
      const getter = buildPathAccessor(path) as (row: TRow) => V;
      return new TextColumnBuilder<TRow, V, P>()
        .id(path)
        .accessor(getter)
        .displayName(defaultLabel(path));
    },

    number<P extends PathsOfType<TRow, number | null>>(path: P) {
      type V = Extract<NonNullable<PathValue<TRow, P>>, number>;
      const getter = buildPathAccessor(path) as (row: TRow) => V;
      return new NumberColumnBuilder<TRow, V, P>()
        .id(path)
        .accessor(getter)
        .displayName(defaultLabel(path));
    },

    date<P extends PathsOfType<TRow, Date | null>>(path: P) {
      type V = Extract<NonNullable<PathValue<TRow, P>>, Date>;
      const getter = buildPathAccessor(path) as (row: TRow) => V;
      return new DateColumnBuilder<TRow, V, P>()
        .id(path)
        .accessor(getter)
        .displayName(defaultLabel(path));
    },

    boolean<P extends PathsOfType<TRow, boolean | null>>(path: P) {
      type V = Extract<NonNullable<PathValue<TRow, P>>, boolean>;
      const getter = buildPathAccessor(path) as (row: TRow) => V;
      return new BooleanColumnBuilder<TRow, V, P>()
        .id(path)
        .accessor(getter)
        .displayName(defaultLabel(path));
    },

    option<P extends PathsOfType<TRow, string | null>>(path: P) {
      type V = Extract<NonNullable<PathValue<TRow, P>>, string>;
      const getter = buildPathAccessor(path) as (row: TRow) => V;
      return new OptionColumnBuilder<TRow, V, P>()
        .id(path)
        .accessor(getter)
        .displayName(defaultLabel(path));
    },

    multiOption<P extends PathsOfType<TRow, readonly string[] | null>>(path: P) {
      type V =
        NonNullable<PathValue<TRow, P>> extends readonly (infer E)[] ? Extract<E, string>[] : never;
      const getter = buildPathAccessor(path) as (row: TRow) => V;
      return new MultiOptionColumnBuilder<TRow, V, P>()
        .id(path)
        .accessor(getter)
        .displayName(defaultLabel(path));
    },

    computed<TId extends string, TValue>(id: TId, accessor: (row: TRow) => TValue) {
      return new ColumnBuilder<TRow, TValue, TId>('custom')
        .id(id)
        .accessor(accessor)
        .displayName(humanize(id)) as ComputedBuilder<TRow, TValue, TId>;
    },

    custom<TValue = unknown>() {
      return new ColumnBuilder<TRow, TValue>('custom');
    },

    auto() {
      return [createAutoColumnsSentinel<TRow>()];
    },
  };
}

export type { Paths, PathsOfType, PathValue };
