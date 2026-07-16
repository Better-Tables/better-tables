import type { FilterGroupNode, FilterNode, FilterState } from '@better-tables/core';
import { isFilterGroupNode } from '@better-tables/core';

function formatValues(filter: FilterState): string {
  if (filter.includeNull && filter.values.length === 0) {
    return 'is empty';
  }
  if (filter.values.length === 0) {
    return '(any value)';
  }
  if (filter.values.length === 1) {
    return String(filter.values[0]);
  }
  return `[${filter.values.map(String).join(', ')}]`;
}

const OPERATOR_WORDS: Partial<Record<string, string>> = {
  is: 'is',
  isNot: 'is not',
  isAnyOf: 'is any of',
  isNoneOf: 'is none of',
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  isTrue: 'is',
  isFalse: 'is',
  greaterThan: '>',
  greaterThanOrEqual: '>=',
  lessThan: '<',
  lessThanOrEqual: '<=',
};

function describeLeaf(filter: FilterState): string {
  if (filter.type === 'boolean') {
    return `${filter.columnId} is ${filter.operator === 'isTrue' ? 'true' : 'false'}`;
  }

  // Null-only filter (027 showcase): `includeNull: true, values: []` reads
  // as "is empty" on its own -- prefixing the operator word ("equals is
  // empty") is redundant, since the operator's normal meaning doesn't apply
  // when there are no values to compare against.
  if (filter.includeNull && filter.values.length === 0) {
    return `${filter.columnId} is empty`;
  }

  const operatorWord =
    OPERATOR_WORDS[filter.operator] ?? filter.operator.replaceAll(/([A-Z])/g, ' $1').toLowerCase();
  return `${filter.columnId} ${operatorWord} ${formatValues(filter)}`;
}

/**
 * Render a `FilterNode` (a leaf `FilterState` or a recursive `FilterGroupNode`
 * -- the query-groups example's whole point) as a readable, plain-English
 * sentence: `"a AND b"`, `"a OR (b AND c)"`, etc. Nested groups whose logic
 * differs from their parent's are parenthesized for clarity; a nested group
 * with the SAME logic as its parent is flattened into the parent's list
 * (mirrors how `a AND b AND c` reads more naturally than `a AND (b AND c)`).
 */
export function describeFilterNode(node: FilterNode, parentLogic?: 'and' | 'or'): string {
  if (!isFilterGroupNode(node)) {
    return describeLeaf(node);
  }

  const parts = node.children.map((child) => {
    if (isFilterGroupNode(child) && child.logic !== node.logic) {
      return `(${describeFilterNode(child, node.logic)})`;
    }
    return describeFilterNode(child, node.logic);
  });

  const joined = parts.join(node.logic === 'and' ? ' AND ' : ' OR ');

  // Only wrap the TOP-level call in parens when it will be nested inside a
  // different-logic parent (the recursive branch above already handles
  // that); a bare top-level call returns unwrapped.
  if (parentLogic && parentLogic !== node.logic) {
    return joined;
  }
  return joined;
}

/** Count every leaf `FilterState` in a `FilterNode` tree (for a quick "N conditions" label). */
export function countLeaves(node: FilterNode): number {
  if (!isFilterGroupNode(node)) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * `FetchDataParams.filters` (and this app's `SupportScenarioPreset.filters`)
 * is `FilterState[] | FilterGroupNode` -- a bare array means implicit AND,
 * not a single `FilterNode`. These wrap a flat array as a synthetic
 * `{ kind: 'group', logic: 'and' }` before delegating, so callers can pass
 * either shape without checking first.
 */
export function describeFilters(filters: FilterState[] | FilterGroupNode): string {
  if (Array.isArray(filters)) {
    if (filters.length === 0) return '(no filters)';
    if (filters.length === 1) {
      const only = filters[0];
      return only ? describeLeaf(only) : '(no filters)';
    }
    return describeFilterNode({ kind: 'group', logic: 'and', children: filters });
  }
  return describeFilterNode(filters);
}

export function countFilterLeaves(filters: FilterState[] | FilterGroupNode): number {
  if (Array.isArray(filters)) return filters.length;
  return countLeaves(filters);
}

export function filtersAreGroup(filters: FilterState[] | FilterGroupNode): boolean {
  return !Array.isArray(filters);
}

export type { FilterGroupNode, FilterNode, FilterState };
