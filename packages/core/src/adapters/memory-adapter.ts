/**
 * @fileoverview In-memory `TableAdapter` over a plain array of rows.
 *
 * `memoryAdapter(rows)` gives client-only tables, playgrounds, tests, and
 * docs examples the full flagship pipeline — filtering (every operator,
 * AND/OR trees), sorting, pagination, facets with self-exclusion, schema
 * inference for auto columns, and optional in-place cell edits — with zero
 * backend.
 *
 * Scope (v1): own-table columns only. Column ids resolve against the row
 * object with dot-path support (`profile.bio` walks nested objects), but
 * there is no relationship model — no JOIN semantics, no
 * `resolveCellWriteTarget`. For relational data, use a database adapter.
 */

import { buildPathAccessor } from '../builders/path-builders';
import type {
  FacetQueryParams,
  FetchDataParams,
  FetchDataResult,
  InferredColumnSpec,
  MutationOptions,
  TableAdapter,
} from '../types/adapter';
import type { ColumnType } from '../types/column';
import type { AggregateFn, DerivedFetchSpec } from '../types/derived';
import type {
  FilterGroupNode,
  FilterNode,
  FilterOperator,
  FilterOption,
  FilterState,
} from '../types/filter';
import { FILTER_OPERATORS, getDefaultOperatorsForType } from '../types/filter-operators';
import type { SortingParams } from '../types/sorting';

const ALL_AGGREGATE_FNS: AggregateFn[] = ['count', 'sum', 'avg', 'min', 'max'];

/** Evaluate a derived aggregate over a nested array relation on the row. */
function evaluateDerivedAggregate(row: unknown, spec: DerivedFetchSpec): number {
  const relationValue =
    row && typeof row === 'object' ? (row as Record<string, unknown>)[spec.relation] : undefined;
  const items = Array.isArray(relationValue) ? relationValue : [];

  if (spec.fn === 'count') {
    return items.length;
  }

  const field = spec.field;
  const numbers: number[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || field == null) continue;
    const raw = (item as Record<string, unknown>)[field];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isNaN(n)) numbers.push(n);
  }

  if (numbers.length === 0) {
    return 0;
  }

  switch (spec.fn) {
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'avg':
      return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return 0;
  }
}

/** Materialize derived column values onto shallow row copies. */
function withDerivedValues<TData>(rows: TData[], derived: DerivedFetchSpec[] | undefined): TData[] {
  if (!derived || derived.length === 0) return rows;
  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...(row as object as Record<string, unknown>) };
    for (const spec of derived) {
      copy[spec.columnId] = evaluateDerivedAggregate(row, spec);
    }
    return copy as TData;
  });
}

/** Options for {@link memoryAdapter}. */
export interface MemoryAdapterOptions<TData> {
  /**
   * Row identity for `updateRecord` (inline editing). Defaults to reading a
   * string/number `id` field. Edits mutate the row object in place.
   */
  getRowId?: (row: TData) => string;
  /** Table name reported by `describeColumns` / errors. Default `'memory'`. */
  tableName?: string;
  /**
   * Distinct-string-value ceiling under which `describeColumns` infers an
   * `option` column (with choices) instead of `text`. Default `12`; pass `0`
   * to disable enum inference.
   */
  enumInferenceLimit?: number;
  /**
   * Derived aggregate column ids (from `t.count` / `t.aggregate`).
   * **Required** when those columns exist and you may call facets/min-max —
   * otherwise `getFacetedValues` / `getMinMaxValues` cannot tell a derived id
   * from a missing field and would silently return empty/zero results.
   * Pass the same ids you send on `fetchData({ derived })`. Facets on these
   * ids throw until facet transport carries derived specs.
   */
  derivedColumnIds?: string[];
}

const DEFAULT_FACET_LIMIT = 100;

/** Available on every column type — evaluated before the per-type switch. */
const UNIVERSAL_NULL_OPERATORS: FilterOperator[] = ['isNull', 'isNotNull'];

/** Resolve a column id to a per-row value getter (dot-paths walk objects). */
function accessorFor(columnId: string): (row: unknown) => unknown {
  return buildPathAccessor(columnId);
}

function isGroupNode(node: FilterState[] | FilterGroupNode | FilterNode): node is FilterGroupNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'kind' in node &&
    (node as { kind?: unknown }).kind === 'group'
  );
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** [startMs, endMs) for the relative date operators, from "now". */
function relativePeriod(operator: string, now: Date): [number, number] {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = startOfDay(now);
  switch (operator) {
    case 'isToday':
      return [today, today + dayMs];
    case 'isYesterday':
      return [today - dayMs, today];
    case 'isThisWeek': {
      // Sunday-start week, matching the toolkit's `computeDatePeriodRange`
      // (`now.getDate() - now.getDay()`) so a filter returns the same rows
      // whether it runs here or through a SQL adapter.
      const start = today - now.getDay() * dayMs;
      return [start, start + 7 * dayMs];
    }
    case 'isThisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return [start, end];
    }
    case 'isThisYear': {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
      return [start, end];
    }
    default:
      return [Number.NaN, Number.NaN];
  }
}

/** One dev warning per (type, operator) pair — see the `default` branch below. */
const warnedUnevaluatable = new Set<string>();

function warnUnevaluatable(type: string, operator: string): void {
  // `typeof process` guard: core runs in browsers, where a bare `process`
  // dereference throws ReferenceError. Matches factory.ts / cell-edit-core.ts.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const key = `${type}:${operator}`;
  if (warnedUnevaluatable.has(key)) return;
  warnedUnevaluatable.add(key);
  // biome-ignore lint/suspicious/noConsole: dev-only diagnostic, matches core's other adapter warns
  console.warn(
    `[better-tables] memoryAdapter cannot evaluate operator '${operator}' on a '${type}' column ` +
      `— those rows will not match. Custom columns support only 'isNull' / 'isNotNull'; ` +
      `filter on a built-in column type, or use a database adapter.`
  );
}

function jsonIsEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return value === '';
}

/** Evaluate one leaf `FilterState` against a single row value. */
function matchesLeaf(filter: FilterState, raw: unknown): boolean {
  const operator = filter.operator as string;
  const values = (filter.values ?? []) as unknown[];

  // Universal null operators come first so they work for every column type.
  if (operator === 'isNull') return raw == null;
  if (operator === 'isNotNull') return raw != null;

  // `includeNull` lets null rows pass the filter in addition to real matches.
  if (raw == null) return filter.includeNull === true;

  switch (filter.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone': {
      const value = String(raw);
      const needle = values[0] == null ? '' : String(values[0]);
      switch (operator) {
        case 'contains':
          return value.toLowerCase().includes(needle.toLowerCase());
        case 'equals':
          return value === needle;
        case 'startsWith':
          return value.toLowerCase().startsWith(needle.toLowerCase());
        case 'endsWith':
          return value.toLowerCase().endsWith(needle.toLowerCase());
        case 'isEmpty':
          return value === '';
        case 'isNotEmpty':
          return value !== '';
        default:
          return false;
      }
    }
    // `currency` / `percentage` are number columns with display formatting —
    // they share NUMBER_OPERATORS, so they must evaluate identically here.
    case 'number':
    case 'currency':
    case 'percentage': {
      const value = Number(raw);
      if (Number.isNaN(value)) return false;
      const [a, b] = [Number(values[0]), Number(values[1])];
      switch (operator) {
        case 'equals':
          return value === a;
        case 'notEquals':
          return value !== a;
        case 'greaterThan':
          return value > a;
        case 'greaterThanOrEqual':
          return value >= a;
        case 'lessThan':
          return value < a;
        case 'lessThanOrEqual':
          return value <= a;
        case 'between':
          return value >= Math.min(a, b) && value <= Math.max(a, b);
        case 'notBetween':
          return value < Math.min(a, b) || value > Math.max(a, b);
        default:
          return false;
      }
    }
    case 'date': {
      const value = toDate(raw);
      if (!value) return false;
      const time = value.getTime();
      const day = startOfDay(value);
      if (
        operator === 'isToday' ||
        operator === 'isYesterday' ||
        operator === 'isThisWeek' ||
        operator === 'isThisMonth' ||
        operator === 'isThisYear'
      ) {
        const [start, end] = relativePeriod(operator, new Date());
        return time >= start && time < end;
      }
      const a = toDate(values[0]);
      const b = toDate(values[1]);
      switch (operator) {
        case 'is':
          return a != null && day === startOfDay(a);
        case 'isNot':
          return a != null && day !== startOfDay(a);
        case 'before':
          return a != null && time < a.getTime();
        case 'after':
          return a != null && time > a.getTime();
        case 'between':
          return a != null && b != null && time >= a.getTime() && time <= b.getTime();
        case 'notBetween':
          return a != null && b != null && (time < a.getTime() || time > b.getTime());
        default:
          return false;
      }
    }
    case 'option': {
      const value = String(raw);
      const wanted = values.map(String);
      switch (operator) {
        case 'is':
          return value === wanted[0];
        case 'isNot':
          return value !== wanted[0];
        case 'isAnyOf':
          return wanted.includes(value);
        case 'isNoneOf':
          return !wanted.includes(value);
        default:
          return false;
      }
    }
    case 'multiOption': {
      const value = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const wanted = values.map(String);
      const first = wanted[0] ?? '';
      switch (operator) {
        case 'includes':
          return value.includes(first);
        case 'excludes':
          return !value.includes(first);
        case 'includesAny':
          return wanted.some((v) => value.includes(v));
        case 'includesAll':
          return wanted.every((v) => value.includes(v));
        case 'excludesAny':
          return wanted.some((v) => !value.includes(v));
        case 'excludesAll':
          return wanted.every((v) => !value.includes(v));
        default:
          return false;
      }
    }
    case 'boolean': {
      const value = Boolean(raw);
      switch (operator) {
        case 'isTrue':
          return value === true;
        case 'isFalse':
          return value === false;
        default:
          return false;
      }
    }
    case 'json': {
      switch (operator) {
        case 'contains':
          return JSON.stringify(raw)
            .toLowerCase()
            .includes(String(values[0] ?? '').toLowerCase());
        case 'equals':
          return JSON.stringify(raw) === JSON.stringify(values[0]);
        case 'isEmpty':
          return jsonIsEmpty(raw);
        case 'isNotEmpty':
          return !jsonIsEmpty(raw);
        default:
          return false;
      }
    }
    default:
      // `custom` columns land here: their operators are user-defined, so there
      // is no generic semantics to apply. Only the universal `isNull` /
      // `isNotNull` (handled above) work — warn instead of silently matching
      // nothing, which reads as "the filter is broken".
      warnUnevaluatable(filter.type, operator);
      return false;
  }
}

/** Evaluate a filter node (leaf, implicit-AND array, or group tree) for a row. */
function matchesNode(
  node: FilterState[] | FilterGroupNode | FilterNode,
  row: unknown,
  getAccessor: (columnId: string) => (row: unknown) => unknown
): boolean {
  if (Array.isArray(node)) {
    return node.every((child) => matchesNode(child, row, getAccessor));
  }
  if (isGroupNode(node)) {
    if (node.children.length === 0) return true;
    return node.logic === 'or'
      ? node.children.some((child) => matchesNode(child, row, getAccessor))
      : node.children.every((child) => matchesNode(child, row, getAccessor));
  }
  const leaf = node as FilterState;
  return matchesLeaf(leaf, getAccessor(leaf.columnId)(row));
}

/**
 * Remove every leaf for `columnId` from a filter input (facet self-exclusion:
 * a column's own filter must not narrow its own facet). Groups left empty by
 * the removal are pruned.
 */
function excludeColumn(
  filters: FilterState[] | FilterGroupNode | undefined,
  columnId: string
): FilterState[] | FilterGroupNode | undefined {
  if (!filters) return filters;
  if (Array.isArray(filters)) {
    return filters.filter((f) => f.columnId !== columnId);
  }
  const pruneNode = (node: FilterNode): FilterNode | null => {
    if (isGroupNode(node)) {
      const children = node.children
        .map(pruneNode)
        .filter((child): child is FilterNode => child !== null);
      if (children.length === 0) return null;
      return { ...node, children };
    }
    return (node as FilterState).columnId === columnId ? null : node;
  };
  const pruned = pruneNode(filters);
  if (pruned === null) return [];
  return isGroupNode(pruned) ? pruned : [pruned as FilterState];
}

function normalizeFacetLimit(limit: number | null | undefined): number | null {
  if (limit === null) return null;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_FACET_LIMIT;
  }
  return limit;
}

function compareValues(a: unknown, b: unknown): number {
  // Nulls sort last regardless of direction (applied by caller).
  if (a instanceof Date || b instanceof Date) {
    const at = toDate(a)?.getTime() ?? Number.NaN;
    const bt = toDate(b)?.getTime() ?? Number.NaN;
    if (!Number.isNaN(at) && !Number.isNaN(bt)) return at - bt;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

function inferColumnType(
  samples: unknown[],
  enumLimit: number
): {
  columnType: ColumnType;
  options?: Array<{ value: string; label: string }>;
} {
  const first = samples.find((v) => v != null);
  if (first == null) return { columnType: 'text' };
  if (typeof first === 'boolean') return { columnType: 'boolean' };
  if (typeof first === 'number') return { columnType: 'number' };
  if (first instanceof Date) return { columnType: 'date' };
  if (Array.isArray(first)) {
    const distinct = new Set(samples.flatMap((v) => (Array.isArray(v) ? v.map(String) : [])));
    return {
      columnType: 'multiOption',
      options: [...distinct].sort().map((value) => ({ value, label: value })),
    };
  }
  if (typeof first === 'object') return { columnType: 'json' };
  // Strings: infer an enum when the distinct set is small.
  const distinct = new Set(samples.filter((v) => v != null).map(String));
  if (enumLimit > 0 && distinct.size <= enumLimit && distinct.size < samples.length) {
    return {
      columnType: 'option',
      options: [...distinct].sort().map((value) => ({ value, label: value })),
    };
  }
  return { columnType: 'text' };
}

function humanize(field: string): string {
  const last = field.split('.').pop() ?? field;
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Create an in-memory {@link TableAdapter} over an array of rows.
 *
 * @example
 * ```typescript
 * import { betterTables, memoryAdapter } from '@better-tables/core';
 *
 * const tables = betterTables({ database: memoryAdapter(tickets) });
 * const usersTable = tables.define('memory'); // fully inferred auto columns
 *
 * const result = await tables.fetchData(usersTable, {
 *   filters: [{ columnId: 'status', type: 'option', operator: 'is', values: ['open'] }],
 *   pagination: { page: 1, limit: 20 },
 * });
 * ```
 */
export function memoryAdapter<TData>(
  rows: TData[],
  options: MemoryAdapterOptions<TData> = {}
): TableAdapter<TData> {
  const tableName = options.tableName ?? 'memory';
  const enumLimit = options.enumInferenceLimit ?? 12;
  const getRowId = options.getRowId ?? ((row: TData) => String((row as { id?: unknown }).id ?? ''));
  // Explicit only — do not infer from fetchData order (that silently no-ops
  // when facets run before the first derived fetch).
  const knownDerivedColumnIds = new Set<string>(options.derivedColumnIds ?? []);
  const accessorCache = new Map<string, (row: unknown) => unknown>();
  const getAccessor = (columnId: string) => {
    let accessor = accessorCache.get(columnId);
    if (!accessor) {
      accessor = accessorFor(columnId);
      accessorCache.set(columnId, accessor);
    }
    return accessor;
  };

  const rejectDerivedFacet = (columnId: string): void => {
    if (!knownDerivedColumnIds.has(columnId)) return;
    throw new Error(
      `[better-tables] memoryAdapter does not support facets or min/max on derived aggregate columns yet (column '${columnId}'). Pass derivedColumnIds when constructing the adapter.`
    );
  };

  const applyFilters = (source: TData[], filters: FetchDataParams['filters']): TData[] => {
    if (!filters || (Array.isArray(filters) && filters.length === 0)) return [...source];
    return source.filter((row) => matchesNode(filters, row, getAccessor));
  };

  const applySorting = (data: TData[], sorting: SortingParams[] | undefined): TData[] => {
    if (!sorting || sorting.length === 0) return data;
    const sorted = [...data];
    sorted.sort((left, right) => {
      for (const { columnId, direction } of sorting) {
        const accessor = getAccessor(columnId);
        const a = accessor(left);
        const b = accessor(right);
        if (a == null && b == null) continue;
        if (a == null) return 1; // nulls last
        if (b == null) return -1;
        const cmp = compareValues(a, b);
        if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
    return sorted;
  };

  return {
    async fetchData(params: FetchDataParams = {}): Promise<FetchDataResult<TData>> {
      throwIfAborted(params.signal);
      const materialised = withDerivedValues(rows, params.derived);
      const filtered = applySorting(applyFilters(materialised, params.filters), params.sorting);
      const total = filtered.length;
      const limit = Math.max(1, params.pagination?.limit ?? (total || 1));
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const page = Math.min(Math.max(1, params.pagination?.page ?? 1), totalPages);
      const start = (page - 1) * limit;
      const data = params.pagination ? filtered.slice(start, start + limit) : filtered;
      return {
        data,
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    },

    async getFilterOptions(columnId: string, params?: FacetQueryParams): Promise<FilterOption[]> {
      throwIfAborted(params?.signal);
      const counts = await this.getFacetedValues(columnId, params);
      return [...counts.entries()].map(([value, count]) => ({ value, label: value, count }));
    },

    async getFacetedValues(
      columnId: string,
      params?: FacetQueryParams
    ): Promise<Map<string, number>> {
      throwIfAborted(params?.signal);
      rejectDerivedFacet(columnId);
      const filters = excludeColumn(params?.filters, columnId);
      const accessor = getAccessor(columnId);
      const counts = new Map<string, number>();
      for (const row of applyFilters(rows, filters)) {
        const raw = accessor(row);
        if (raw == null) continue;
        const values = Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          const key = String(value);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      const limit = normalizeFacetLimit(params?.limit);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return new Map(limit === null ? sorted : sorted.slice(0, limit));
    },

    async getMinMaxValues(columnId: string, params?: FacetQueryParams): Promise<[number, number]> {
      throwIfAborted(params?.signal);
      rejectDerivedFacet(columnId);
      const filters = excludeColumn(params?.filters, columnId);
      const accessor = getAccessor(columnId);
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const row of applyFilters(rows, filters)) {
        const raw = accessor(row);
        const value = raw instanceof Date ? raw.getTime() : Number(raw);
        if (raw == null || Number.isNaN(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      if (min === Number.POSITIVE_INFINITY) return [0, 0];
      return [min, max];
    },

    async describeColumns(): Promise<InferredColumnSpec[]> {
      const sample = rows.slice(0, 200);
      const fields = new Set<string>();
      for (const row of sample) {
        if (row && typeof row === 'object') {
          for (const key of Object.keys(row)) fields.add(key);
        }
      }
      return [...fields].map((field) => {
        const samples = sample.map((row) => (row as Record<string, unknown>)[field]);
        const { columnType, options: choices } = inferColumnType(samples, enumLimit);
        const primaryKey = field === 'id';
        return {
          field,
          columnType,
          label: humanize(field),
          ...(choices && choices.length > 0 ? { options: choices } : {}),
          nullable: samples.some((v) => v == null),
          primaryKey,
          foreignKey: false,
          writable: !primaryKey,
        };
      });
    },

    async updateRecord(
      id: string,
      data: Partial<TData>,
      _options?: MutationOptions
    ): Promise<TData> {
      const row = rows.find((candidate) => getRowId(candidate) === id);
      if (!row) {
        throw new Error(`memoryAdapter: no row with id '${id}' in '${tableName}'`);
      }
      Object.assign(row as object, data);
      return row;
    },

    meta: {
      name: 'memory',
      version: '1.0.0',
      features: {
        create: false,
        read: true,
        update: true,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: Object.keys(FILTER_OPERATORS) as ColumnType[],
      // Built-in types get their full operator set. `custom` columns carry
      // user-defined operators this adapter has no semantics for, so it
      // advertises only the universal null operators — the ones it can
      // actually evaluate (anything else warns and matches nothing).
      supportedOperators: Object.fromEntries(
        (Object.keys(FILTER_OPERATORS) as ColumnType[]).map((type) => [
          type,
          type === 'custom' ? UNIVERSAL_NULL_OPERATORS : getDefaultOperatorsForType(type),
        ])
      ) as Record<ColumnType, FilterOperator[]>,
      supportsFilterGroups: true,
      capabilities: {
        aggregates: {
          fns: [...ALL_AGGREGATE_FNS],
          render: true,
          filter: true,
          sort: true,
        },
      },
    },
  };
}
