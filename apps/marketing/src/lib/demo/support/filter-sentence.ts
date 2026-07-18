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

  // Null-only filter (`includeNull: true`, no values) reads as "is empty".
  if (filter.includeNull && filter.values.length === 0) {
    return `${filter.columnId} is empty`;
  }

  const operatorWord =
    OPERATOR_WORDS[filter.operator] ?? filter.operator.replaceAll(/([A-Z])/g, ' $1').toLowerCase();
  return `${filter.columnId} ${operatorWord} ${formatValues(filter)}`;
}

/**
 * Render a filter leaf or AND/OR group as a plain-English sentence
 * (`"a AND b"`, `"a OR (b AND c)"`). Nested groups with different logic are
 * parenthesized; same-logic nesting is flattened.
 */
export function describeFilterNode(node: FilterNode): string {
  if (!isFilterGroupNode(node)) {
    return describeLeaf(node);
  }

  const parts = node.children.map((child) => {
    if (isFilterGroupNode(child) && child.logic !== node.logic) {
      return `(${describeFilterNode(child)})`;
    }
    return describeFilterNode(child);
  });

  return parts.join(node.logic === 'and' ? ' AND ' : ' OR ');
}

/** Count leaf filters in a group tree (for "N conditions" labels). */
export function countLeaves(node: FilterNode): number {
  if (!isFilterGroupNode(node)) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Describe either a flat filter list (implicit AND) or an explicit group node.
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
