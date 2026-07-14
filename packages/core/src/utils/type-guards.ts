import type { ColumnType } from '../types/column';
import type {
  BooleanFilterState,
  CustomFilterState,
  DateFilterState,
  FilterGroupNode,
  FilterNode,
  FilterState,
  JsonFilterState,
  MultiOptionFilterState,
  NumberFilterState,
  OptionFilterState,
  TextFilterState,
} from '../types/filter';
import { getAllOperators } from '../types/filter-operators';

/**
 * Known filter `type` discriminants (the eight members of the `FilterState` union).
 */
const KNOWN_FILTER_TYPES: ReadonlyArray<FilterState['type']> = [
  'text',
  'email',
  'url',
  'phone',
  'number',
  'currency',
  'percentage',
  'date',
  'boolean',
  'option',
  'multiOption',
  'json',
  'custom',
];

/**
 * Set of all known filter operator keys, built from the canonical operator
 * definitions in `types/filter-operators.ts` so it can't drift from them.
 */
const KNOWN_FILTER_OPERATORS: ReadonlySet<string> = new Set(getAllOperators().map((op) => op.key));

/**
 * Shape guard for untrusted, `unknown`-typed input (e.g. decompressed URL
 * payloads) that validates the minimal structural contract of a `FilterState`
 * without assuming the input has already been typed.
 *
 * This is intentionally permissive on `values` element types — per-type
 * element checking (e.g. all-numbers for `number` filters) is left to the
 * managers, which re-validate values against operator/column requirements.
 */
export function isFilterStateShape(value: unknown): value is FilterState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.id !== undefined && typeof candidate.id !== 'string') {
    return false;
  }

  if (typeof candidate.columnId !== 'string' || candidate.columnId.length === 0) {
    return false;
  }

  if (
    typeof candidate.type !== 'string' ||
    !KNOWN_FILTER_TYPES.includes(candidate.type as FilterState['type'])
  ) {
    return false;
  }

  if (typeof candidate.operator !== 'string' || !KNOWN_FILTER_OPERATORS.has(candidate.operator)) {
    return false;
  }

  if (!Array.isArray(candidate.values)) {
    return false;
  }

  if (candidate.includeNull !== undefined && typeof candidate.includeNull !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Default maximum {@link FilterGroupNode} nesting depth. Mirrors plan 011's
 * `Paths<T>` depth cap (`experimental/table-def-v1.ts`) -- one "3" to reason
 * about across the whole contract (design §1.2). A group at depth 1 (the
 * root) may nest a group at depth 2, which may nest one more at depth 3;
 * anything past that fails closed.
 */
const DEFAULT_MAX_GROUP_DEPTH = 3;

/**
 * Shape guard: is this node a boolean AND/OR {@link FilterGroupNode} (as
 * opposed to a filter leaf)? Structural only -- `kind === 'group'` -- no
 * `FilterState` member has a top-level `kind`, so this is a collision-free
 * discriminant (design §1.1). Callers needing full recursive validation
 * should use {@link isFilterNodeShape}.
 */
export function isFilterGroupNode(value: unknown): value is FilterGroupNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).kind === 'group'
  );
}

/**
 * Recursive shape guard for untrusted input (e.g. a decompressed `c2:` URL
 * payload) that validates the minimal structural contract of a
 * {@link FilterNode} -- a filter leaf or a nested AND/OR group -- without
 * assuming the input has already been typed.
 *
 * A group node is valid only if: it is within `maxDepth` nesting (default
 * {@link DEFAULT_MAX_GROUP_DEPTH}, fail closed on over-deep trees per design
 * §1.2/§1.3), its `logic` is `'and'`/`'or'`, its `children` is a non-empty
 * array, and every child recursively validates. A leaf delegates to
 * {@link isFilterStateShape} verbatim -- one leaf contract, reused.
 *
 * This guard only reports validity; it does not repair a tree (e.g. drop an
 * invalid child and keep the rest). Use {@link normalizeFilterNode} for
 * fail-closed, cascading normalization of untrusted input.
 */
export function isFilterNodeShape(
  value: unknown,
  depth = 1,
  maxDepth = DEFAULT_MAX_GROUP_DEPTH
): value is FilterNode {
  if (isFilterGroupNode(value)) {
    if (depth > maxDepth) {
      return false;
    }

    if (value.logic !== 'and' && value.logic !== 'or') {
      return false;
    }

    if (!Array.isArray(value.children) || value.children.length === 0) {
      return false;
    }

    return value.children.every((child) => isFilterNodeShape(child, depth + 1, maxDepth));
  }

  return isFilterStateShape(value);
}

/**
 * Normalize an untrusted {@link FilterNode} candidate, fail closed and
 * consistent with plan 004's `deserializeFiltersFromURL` convention (design
 * §1.4):
 *
 * | Condition | Action |
 * |---|---|
 * | Empty group (0 children, or 0 after dropping invalid children) | Drop the group |
 * | Single-child group | Unwrap -- replace the group with its sole child |
 * | Unknown `logic` (not `'and'`/`'or'`) | Drop the node |
 * | Non-array `children` | Drop the node |
 * | Depth beyond `maxDepth` | Drop the over-deep subtree (not the whole payload) |
 * | Invalid leaf (`isFilterStateShape` false) | Drop the leaf |
 *
 * Normalization runs bottom-up (children are normalized before their
 * parent's emptiness is checked) so a dropped invalid leaf can cascade into
 * "now-empty group -> drop" in one pass. Warnings stay value-free (never log
 * `values`), matching `deserializeFiltersFromURL`'s existing convention.
 *
 * @returns The normalized node, or `null` when nothing in the subtree
 * survives.
 */
export function normalizeFilterNode(
  node: unknown,
  depth = 1,
  maxDepth = DEFAULT_MAX_GROUP_DEPTH
): FilterNode | null {
  if (isFilterGroupNode(node)) {
    if (depth > maxDepth) {
      // biome-ignore lint: Intentional warning logging for dropped invalid filter groups
      console.warn(`[better-tables] Dropped filter group: nesting exceeds max depth ${maxDepth}.`);
      return null;
    }

    if (node.logic !== 'and' && node.logic !== 'or') {
      // biome-ignore lint: Intentional warning logging for dropped invalid filter groups
      console.warn('[better-tables] Dropped filter group: unknown logic.');
      return null;
    }

    if (!Array.isArray(node.children)) {
      // biome-ignore lint: Intentional warning logging for dropped invalid filter groups
      console.warn('[better-tables] Dropped filter group: children is not an array.');
      return null;
    }

    const normalizedChildren = node.children
      .map((child) => normalizeFilterNode(child, depth + 1, maxDepth))
      .filter((child): child is FilterNode => child !== null);

    if (normalizedChildren.length === 0) {
      // biome-ignore lint: Intentional warning logging for dropped invalid filter groups
      console.warn('[better-tables] Dropped empty filter group.');
      return null;
    }

    if (normalizedChildren.length === 1) {
      // and/or of one thing is that thing -- unwrap the singleton.
      const [only] = normalizedChildren;
      if (only !== undefined) {
        return only;
      }
    }

    return { kind: 'group', logic: node.logic, children: normalizedChildren };
  }

  if (isFilterStateShape(node)) {
    return node;
  }

  const columnId =
    node &&
    typeof node === 'object' &&
    typeof (node as { columnId?: unknown }).columnId === 'string'
      ? (node as { columnId: string }).columnId
      : '<unknown>';
  // biome-ignore lint: Intentional warning logging for dropped invalid filters
  console.warn(
    `[better-tables] Dropped invalid filter node for column "${columnId}": entry does not match the expected filter or group shape.`
  );
  return null;
}

/**
 * Depth-first, order-preserving leaf collector for a {@link FilterNode}.
 *
 * Used by the state layer's legacy flat accessors (design
 * `plans/design/core-contract-v2.md`, plan 016 semantic contract rule 3):
 * `getFilters()` returns a stored {@link FilterGroupNode} tree's flat LEAVES
 * for display/badge-count purposes when the real stored value is a group.
 * This view is deliberately lossy -- the AND/OR structure is discarded -- so
 * it must never be written back into state (that would silently destroy the
 * group). Leaf references are returned as-is (no cloning).
 */
export function flattenFilterNode(node: FilterNode): FilterState[] {
  if (isFilterGroupNode(node)) {
    return node.children.flatMap((child) => flattenFilterNode(child));
  }
  return [node];
}

/**
 * Type guard for text filter states (text, email, url, phone)
 */
export function isTextFilterState(filter: FilterState): filter is TextFilterState {
  return ['text', 'email', 'url', 'phone'].includes(filter.type);
}

/**
 * Type guard for number filter states (number, currency, percentage)
 */
export function isNumberFilterState(filter: FilterState): filter is NumberFilterState {
  return ['number', 'currency', 'percentage'].includes(filter.type);
}

/**
 * Type guard for date filter states
 */
export function isDateFilterState(filter: FilterState): filter is DateFilterState {
  return filter.type === 'date';
}

/**
 * Type guard for boolean filter states
 */
export function isBooleanFilterState(filter: FilterState): filter is BooleanFilterState {
  return filter.type === 'boolean';
}

/**
 * Type guard for option filter states
 */
export function isOptionFilterState(filter: FilterState): filter is OptionFilterState {
  return filter.type === 'option';
}

/**
 * Type guard for multi-option filter states
 */
export function isMultiOptionFilterState(filter: FilterState): filter is MultiOptionFilterState {
  return filter.type === 'multiOption';
}

/**
 * Type guard for JSON filter states
 */
export function isJsonFilterState(filter: FilterState): filter is JsonFilterState {
  return filter.type === 'json';
}

/**
 * Type guard for custom filter states
 */
export function isCustomFilterState(filter: FilterState): filter is CustomFilterState {
  return filter.type === 'custom';
}

/**
 * Assert filter values match expected type
 * @throws {Error} If filter type doesn't match expected type
 */
export function assertFilterValueType<T>(
  filter: FilterState,
  expectedType: ColumnType
): filter is FilterState & { values: T[] } {
  if (filter.type !== expectedType) {
    throw new Error(`Expected filter type ${expectedType}, got ${filter.type}`);
  }
  return true;
}

/**
 * Type predicate for filter values with runtime validation
 * Validates that all values in the filter match the expected type
 */
export function isFilterValuesOfType<T>(
  filter: FilterState,
  typeChecker: (value: unknown) => value is T
): filter is FilterState & { values: T[] } {
  return filter.values.every(typeChecker);
}

/**
 * Type predicate for text filter values
 */
export function isTextFilterValues(
  filter: FilterState
): filter is FilterState & { values: string[] } {
  return isFilterValuesOfType(filter, (value): value is string => typeof value === 'string');
}

/**
 * Type predicate for number filter values
 */
export function isNumberFilterValues(
  filter: FilterState
): filter is FilterState & { values: number[] } {
  return isFilterValuesOfType(filter, (value): value is number => typeof value === 'number');
}

/**
 * Type predicate for date filter values
 */
export function isDateFilterValues(
  filter: FilterState
): filter is FilterState & { values: Date[] } {
  return isFilterValuesOfType(
    filter,
    (value): value is Date => value instanceof Date && !Number.isNaN(value.getTime())
  );
}

/**
 * Check if a value is a valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Check if a value can be converted to a Date
 */
export function isDateLike(value: unknown): value is Date | string | number {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }
  return false;
}
