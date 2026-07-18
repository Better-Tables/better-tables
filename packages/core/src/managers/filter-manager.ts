/**
 * @fileoverview Filter manager for handling table filter state and operations.
 *
 * This module provides comprehensive filter management including validation, operator support,
 * event-based subscriptions, and serialization for table column filtering operations.
 *
 * @module managers/filter-manager
 */

import { Subscribable } from '../lib/subscribable';
import type { ColumnDefinition, ColumnType } from '../types/column';
import type {
  FilterGroupNode,
  FilterOperator,
  FilterOperatorDefinition,
  FilterState,
} from '../types/filter';
import {
  createOperatorRegistry,
  getAllOperators,
  getDefaultOperatorsForType,
  getOperatorDefinition,
} from '../types/filter-operators';
import { flattenFilterNode, isFilterGroupNode, normalizeFilterNode } from '../utils/type-guards';

/**
 * Event types for filter manager.
 *
 * Defines the different types of events that can be emitted by the filter manager,
 * enabling reactive updates and state synchronization for filter operations.
 *
 * @example
 * ```typescript
 * const unsubscribe = filterManager.subscribe((event) => {
 *   switch (event.type) {
 *     case 'filter_added':
 *       console.log('Filter added:', event.filter);
 *       break;
 *     case 'filter_updated':
 *       console.log(`Filter updated for column ${event.columnId}:`, event.filter);
 *       break;
 *     case 'filter_removed':
 *       console.log(`Filter removed for column ${event.columnId}`);
 *       break;
 *     case 'filters_cleared':
 *       console.log('All filters cleared');
 *       break;
 *     case 'filters_replaced':
 *       console.log('Filters replaced:', event.filters);
 *       break;
 *   }
 * });
 * ```
 */
export type FilterManagerEvent =
  | { type: 'filter_added'; filter: FilterState }
  | { type: 'filter_updated'; columnId: string; filter: FilterState }
  | { type: 'filter_removed'; columnId: string }
  | { type: 'filters_cleared' }
  | { type: 'filters_replaced'; filters: FilterState[] | FilterGroupNode };

/**
 * Filter manager subscriber function type.
 *
 * Defines the callback function signature for filter event subscribers.
 *
 * @param event - The filter event that occurred
 *
 * @example
 * ```typescript
 * const handleFilterChange: FilterManagerSubscriber = (event) => {
 *   if (event.type === 'filter_added') {
 *     // Update UI to show new filter
 *     addFilterToUI(event.filter);
 *   }
 * };
 * ```
 */
export type FilterManagerSubscriber = (event: FilterManagerEvent) => void;

/**
 * Filter validation result interface.
 *
 * Contains the result of validating filter operations, including success status,
 * error information, and optional warnings for filter configuration issues.
 *
 * @example
 * ```typescript
 * const validation = filterManager.validateFilter({
 *   columnId: 'age',
 *   operator: 'greaterThan',
 *   values: [18]
 * });
 *
 * if (!validation.valid) {
 *   console.error('Invalid filter:', validation.error);
 * } else if (validation.warning) {
 *   console.warn('Filter warning:', validation.warning);
 * }
 * ```
 */
export interface FilterValidationResult {
  /** Whether the filter is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warning message if applicable */
  warning?: string;
}

/**
 * Filter serialization options interface.
 *
 * Provides configuration options for serializing filter states to various formats,
 * including metadata inclusion and compression settings.
 *
 * @example
 * ```typescript
 * const serializationOptions: FilterSerializationOptions = {
 *   includeMeta: true,
 *   compress: false
 * };
 *
 * const serialized = filterManager.serializeFilters(serializationOptions);
 * ```
 */
export interface FilterSerializationOptions {
  /** Whether to include metadata */
  includeMeta?: boolean;
  /** Whether to compress the output */
  compress?: boolean;
}

/**
 * Core filter manager class for managing filter state and operations.
 *
 * Provides comprehensive filter management including validation against column definitions,
 * operator support, event-based subscriptions, and serialization capabilities. Supports
 * both strict validation for data operations and lenient validation for UI editing states.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const filterManager = new FilterManager<User>(columns, [
 *   { columnId: 'status', operator: 'is', values: ['active'] },
 *   { columnId: 'age', operator: 'greaterThan', values: [18] }
 * ]);
 *
 * // Subscribe to changes
 * const unsubscribe = filterManager.subscribe((event) => {
 *   console.log('Filter changed:', event);
 * });
 *
 * // Add filters
 * filterManager.addFilter({
 *   columnId: 'name',
 *   operator: 'contains',
 *   values: ['John']
 * });
 *
 * // Update existing filter
 * filterManager.updateFilter('age', {
 *   columnId: 'age',
 *   operator: 'between',
 *   values: [18, 65]
 * });
 *
 * // Remove filter
 * filterManager.removeFilter('status');
 *
 * // Get current filters
 * const filters = filterManager.getFilters();
 * console.log('Active filters:', filters);
 * ```
 */
export class FilterManager<TData = unknown> extends Subscribable<FilterManagerEvent> {
  /**
   * The real stored filter state (plan 016 semantic contract rule 2): either
   * a flat `FilterState[]` (implicit AND) or a single {@link FilterGroupNode}
   * tree. Flat inputs behave byte-for-byte as before this widening (rule 1).
   */
  private filterNode: FilterState[] | FilterGroupNode = [];
  private columns: ColumnDefinition<TData>[] = [];
  private operatorDefinitions: Map<FilterOperator, FilterOperatorDefinition> = new Map();

  /**
   * Create a new filter manager instance.
   *
   * Initializes the filter manager with column definitions, initial filters,
   * and operator registry. The manager will validate all filter operations
   * against the provided column definitions and emit events for state changes.
   *
   * @param columns - Array of column definitions to validate filters against
   * @param initialFilters - Optional initial filter state: a flat array
   * (implicit AND) or a single {@link FilterGroupNode} tree
   *
   * @example
   * ```typescript
   * const filterManager = new FilterManager<User>(columns, [
   *   { columnId: 'status', operator: 'is', values: ['active'] },
   *   { columnId: 'age', operator: 'greaterThan', values: [18] }
   * ]);
   * ```
   */
  constructor(
    columns: ColumnDefinition<TData>[],
    initialFilters: FilterState[] | FilterGroupNode = []
  ) {
    super('filter manager');
    this.columns = columns;
    this.operatorDefinitions = createOperatorRegistry(getAllOperators());
    this.setFilterNode(initialFilters);
  }

  /**
   * Get the current filters as a flat, order-preserving leaf list.
   *
   * Legacy display-view accessor (plan 016 semantic contract rule 3): when
   * the real stored value is a flat array, this returns it unchanged (a
   * shallow copy). When the real stored value is a {@link FilterGroupNode}
   * tree, this returns the tree's flat LEAVES (depth-first) for
   * display/badge-count purposes -- the AND/OR structure is not represented.
   * Use {@link getFilterNode} to read the real (possibly tree-shaped) value.
   *
   * @returns Array of current filter states (leaves)
   *
   * @example
   * ```typescript
   * const filters = filterManager.getFilters();
   * console.log(`Active filters: ${filters.length}`);
   *
   * filters.forEach(filter => {
   *   console.log(`${filter.columnId}: ${filter.operator} ${filter.values}`);
   * });
   * ```
   */
  getFilters(): FilterState[] {
    return this.getFlatFilters();
  }

  /**
   * Set filters (replaces all existing filters).
   *
   * Legacy flat setter (plan 016 semantic contract rule 3): REPLACES the
   * whole stored value with the given flat array, even if a
   * {@link FilterGroupNode} tree was previously stored -- deterministic, no
   * silent merging into an existing group. Uses lenient validation to allow
   * incomplete filters with empty values for UI editing.
   */
  setFilters(filters: FilterState[]): void {
    const validFilters = filters.filter((filter) => {
      // Use lenient validation (strict = false) to allow incomplete filters in UI state
      const validation = this.validateFilter(filter, false);
      if (!validation.valid) {
        return false;
      }
      return true;
    });

    this.filterNode = validFilters;
    this.notify({ type: 'filters_replaced', filters: validFilters });
  }

  /**
   * Get the real stored filter state: a flat `FilterState[]` (implicit AND)
   * or a single {@link FilterGroupNode} tree (plan 016 semantic contract rule
   * 3). Unlike {@link getFilters}, this never flattens a stored tree.
   */
  getFilterNode(): FilterState[] | FilterGroupNode {
    return Array.isArray(this.filterNode) ? [...this.filterNode] : this.filterNode;
  }

  /**
   * Set the real stored filter state -- the tree-aware counterpart to
   * {@link setFilters} (plan 016 semantic contract rule 3).
   *
   * A flat array input is delegated to {@link setFilters} verbatim (today's
   * exact column-aware validation path, rule 1). A {@link FilterGroupNode}
   * input is normalized via {@link normalizeFilterNode} (design §1.4: fail
   * closed, drop invalid/unknown-logic/empty groups, unwrap single-child
   * groups, drop over-deep subtrees) -- reusing plan 015's normalize rules
   * rather than reimplementing them.
   */
  setFilterNode(node: FilterState[] | FilterGroupNode): void {
    if (Array.isArray(node)) {
      this.setFilters(node);
      return;
    }

    const normalized = normalizeFilterNode(node);
    const finalNode: FilterState[] | FilterGroupNode =
      normalized === null ? [] : isFilterGroupNode(normalized) ? normalized : [normalized];

    this.filterNode = finalNode;
    this.notify({ type: 'filters_replaced', filters: finalNode });
  }

  /**
   * Flat, order-preserving leaf view of the real stored value. Shared by
   * every legacy per-filter method below so they keep working (read as a
   * flat list, mutate, replace) regardless of whether the real stored value
   * is currently flat or a tree.
   */
  private getFlatFilters(): FilterState[] {
    return Array.isArray(this.filterNode)
      ? [...this.filterNode]
      : flattenFilterNode(this.filterNode);
  }

  /**
   * Add a new filter or update existing filter for the same column.
   *
   * Adds a new filter or updates an existing filter for the specified column.
   * Uses lenient validation to allow incomplete filters with empty values for UI editing.
   * Emits appropriate events based on whether the filter was added or updated.
   *
   * @param filter - The filter state to add or update
   * @throws {Error} If the filter is invalid
   *
   * @example
   * ```typescript
   * // Add new filter
   * filterManager.addFilter({
   *   columnId: 'name',
   *   operator: 'contains',
   *   values: ['John']
   * });
   *
   * // Update existing filter (replaces the previous filter for 'name')
   * filterManager.addFilter({
   *   columnId: 'name',
   *   operator: 'startsWith',
   *   values: ['J']
   * });
   * ```
   */
  addFilter(filter: FilterState): void {
    // Use lenient validation (strict = false) to allow incomplete filters in UI state
    const validation = this.validateFilter(filter, false);
    if (!validation.valid) {
      throw new Error(`Invalid filter for column ${filter.columnId}: ${validation.error}`);
    }

    // Per-filter edit: operate on the flat leaf view and replace the whole
    // stored value (rule 3's replace semantic) -- a no-op change in shape
    // when the stored value was already flat (rule 1), but collapses a tree
    // to flat if one was active.
    const currentFilters = this.getFlatFilters();
    const existingIndex = currentFilters.findIndex((f) => f.columnId === filter.columnId);

    if (existingIndex >= 0) {
      currentFilters[existingIndex] = filter;
      this.filterNode = currentFilters;
      this.notify({ type: 'filter_updated', columnId: filter.columnId, filter });
    } else {
      currentFilters.push(filter);
      this.filterNode = currentFilters;
      this.notify({ type: 'filter_added', filter });
    }
  }

  /**
   * Remove a filter by column ID
   */
  removeFilter(columnId: string): void {
    const currentFilters = this.getFlatFilters();
    const index = currentFilters.findIndex((f) => f.columnId === columnId);
    if (index >= 0) {
      currentFilters.splice(index, 1);
      this.filterNode = currentFilters;
      this.notify({ type: 'filter_removed', columnId });
    }
  }

  /**
   * Update filter values or operator
   * Uses lenient validation to allow incomplete filters with empty values for UI editing
   */
  updateFilter(columnId: string, updates: Partial<FilterState>): void {
    const currentFilters = this.getFlatFilters();
    const index = currentFilters.findIndex((f) => f.columnId === columnId);
    if (index >= 0) {
      const updatedFilter = { ...currentFilters[index], ...updates } as FilterState;
      // Use lenient validation (strict = false) to allow incomplete filters in UI state
      const validation = this.validateFilter(updatedFilter, false);

      if (!validation.valid) {
        throw new Error(`Invalid filter update for column ${columnId}: ${validation.error}`);
      }

      currentFilters[index] = updatedFilter;
      this.filterNode = currentFilters;
      this.notify({ type: 'filter_updated', columnId, filter: updatedFilter });
    }
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filterNode = [];
    this.notify({ type: 'filters_cleared' });
  }

  /**
   * Get filter for specific column (flat leaf view -- see {@link getFilters})
   */
  getFilter(columnId: string): FilterState | undefined {
    return this.getFlatFilters().find((f) => f.columnId === columnId);
  }

  /**
   * Check if column has active filter (flat leaf view -- see {@link getFilters})
   */
  hasFilter(columnId: string): boolean {
    return this.getFlatFilters().some((f) => f.columnId === columnId);
  }

  /**
   * Get all filtered column IDs (flat leaf view -- see {@link getFilters})
   */
  getFilteredColumnIds(): string[] {
    return this.getFlatFilters().map((f) => f.columnId);
  }

  /**
   * Get filters by column type (flat leaf view -- see {@link getFilters})
   */
  getFiltersByType(type: ColumnType): FilterState[] {
    return this.getFlatFilters().filter((f) => f.type === type);
  }

  /**
   * Validate a filter against column definitions and operator rules
   *
   * @param filter - Filter state to validate
   * @param strict - Whether to enforce strict validation (default: false)
   *                 When false, allows incomplete filters with empty values for UI editing
   *                 When true, enforces all validation rules for query execution
   */
  validateFilter(filter: FilterState, strict = false): FilterValidationResult {
    const column = this.columns.find((c) => c.id === filter.columnId);
    if (!column) {
      return { valid: false, error: `Column ${filter.columnId} not found` };
    }

    if (!column.filterable) {
      return { valid: false, error: `Column ${filter.columnId} is not filterable` };
    }

    if (filter.type !== column.type) {
      return {
        valid: false,
        error: `Filter type ${filter.type} doesn't match column type ${column.type}`,
      };
    }

    const operatorDef = this.operatorDefinitions.get(filter.operator);
    if (!operatorDef) {
      return { valid: false, error: `Unknown operator: ${filter.operator}` };
    }

    // Check if operator is allowed for this column
    if (column.filter?.operators && !column.filter.operators.includes(filter.operator)) {
      return {
        valid: false,
        error: `Operator ${filter.operator} not allowed for column ${filter.columnId}`,
      };
    }

    // Guard against malformed input (e.g. URL-derived filters) before
    // dereferencing `values` below - a missing/non-array `values` must be
    // reported as an invalid filter, not throw.
    if (!Array.isArray(filter.values)) {
      return {
        valid: false,
        error: `Filter for column ${filter.columnId} has invalid values (expected an array)`,
      };
    }

    // `includeNull: true` on an operator whose own condition already
    // expresses "null/empty" (isEmpty, isNull - see `supportsNull` on the
    // operator definition) is redundant/contradictory: reject it rather
    // than silently ignoring it (Option A, CORE-10).
    if (filter.includeNull && operatorDef.supportsNull) {
      return {
        valid: false,
        error: `includeNull cannot be combined with operator ${filter.operator}, which already matches null values`,
      };
    }

    // `includeNull: true` with empty `values` expresses "match null rows
    // only" and satisfies the value requirement below for operators that
    // otherwise need at least one value (Option A, CORE-10). This does not
    // apply to valueCount-0 operators (handled by the `supportsNull` check
    // above and the no-values check below), since includeNull only ever
    // adds meaning by substituting for missing values.
    const nullOnlyIntent = filter.includeNull === true && filter.values.length === 0;

    // Validate operator value requirements
    if (operatorDef.valueCount === 0 && filter.values.length > 0) {
      return { valid: false, error: `Operator ${filter.operator} requires no values` };
    }

    if (
      typeof operatorDef.valueCount === 'number' &&
      operatorDef.valueCount > 0 &&
      filter.values.length !== operatorDef.valueCount
    ) {
      if (nullOnlyIntent) {
        return { valid: true };
      }
      // In lenient mode, allow incomplete filters with fewer values for UI editing
      // but still reject filters with too many values
      if (!strict && filter.values.length < operatorDef.valueCount) {
        return {
          valid: true,
          warning: `Filter incomplete - needs ${operatorDef.valueCount} values`,
        };
      }
      return {
        valid: false,
        error: `Operator ${filter.operator} requires exactly ${operatorDef.valueCount} values`,
      };
    }

    if (operatorDef.valueCount === 'variable' && filter.values.length === 0) {
      if (nullOnlyIntent) {
        return { valid: true };
      }
      // In lenient mode, allow incomplete filters with empty values for UI editing
      if (!strict) {
        return { valid: true, warning: 'Filter incomplete - needs at least one value' };
      }
      return { valid: false, error: `Operator ${filter.operator} requires at least one value` };
    }

    // Run operator validation - only in strict mode
    // In lenient mode (UI), we allow invalid values (like min > max) to be persisted
    // so the user can correct them without the filter disappearing
    if (strict) {
      if (operatorDef.validate && !operatorDef.validate(filter.values)) {
        return { valid: false, error: `Invalid values for operator ${filter.operator}` };
      }
    }

    // Run column-specific validation - only in strict mode or if values are present
    if ((strict || filter.values.length > 0) && column.filter?.validation) {
      for (const value of filter.values) {
        const result = column.filter.validation(value);
        if (result !== true) {
          return { valid: false, error: typeof result === 'string' ? result : 'Invalid value' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Get available operators for a column
   */
  getAvailableOperators(columnId: string): FilterOperatorDefinition[] {
    const column = this.columns.find((c) => c.id === columnId);
    if (!column || !column.filterable) {
      return [];
    }

    const allowedOperators =
      column.filter?.operators || this.getDefaultOperatorsForType(column.type);
    return allowedOperators
      .map((op) => this.operatorDefinitions.get(op))
      .filter(Boolean) as FilterOperatorDefinition[];
  }

  /**
   * Get default operators for a column type
   */
  getDefaultOperatorsForType(type: ColumnType): FilterOperator[] {
    return getDefaultOperatorsForType(type);
  }

  /**
   * Get operator definition
   */
  getOperatorDefinition(operator: FilterOperator): FilterOperatorDefinition | undefined {
    return getOperatorDefinition(operator);
  }

  /**
   * Serialize filters to JSON (flat leaf view -- see {@link getFilters}; a
   * stored {@link FilterGroupNode} tree's AND/OR structure is not
   * represented in this format).
   */
  serialize(options: FilterSerializationOptions = {}): string {
    const data = {
      filters: this.getFlatFilters().map((filter) => ({
        columnId: filter.columnId,
        type: filter.type,
        operator: filter.operator,
        values: filter.values,
        ...(filter.includeNull && { includeNull: filter.includeNull }),
        ...(options.includeMeta && filter.meta && { meta: filter.meta }),
      })),
    };

    return JSON.stringify(data, null, options.compress ? 0 : 2);
  }

  /**
   * Deserialize filters from JSON
   */
  deserialize(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.filters && Array.isArray(data.filters)) {
        this.setFilters(data.filters);
      }
    } catch (error) {
      throw new Error(`Failed to deserialize filters: ${error}`);
    }
  }

  /**
   * Get statistics about current filters
   */
  getFilterStats(): {
    totalFilters: number;
    filtersByType: Record<ColumnType, number>;
    filtersByOperator: Record<FilterOperator, number>;
  } {
    const flatFilters = this.getFlatFilters();
    const stats = {
      totalFilters: flatFilters.length,
      filtersByType: {} as Record<ColumnType, number>,
      filtersByOperator: {} as Record<FilterOperator, number>,
    };

    flatFilters.forEach((filter) => {
      stats.filtersByType[filter.type] = (stats.filtersByType[filter.type] || 0) + 1;
      stats.filtersByOperator[filter.operator] =
        (stats.filtersByOperator[filter.operator] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clone the filter manager with the same configuration, preserving the
   * real stored value (a tree stays a tree -- unlike the other legacy
   * per-filter methods, cloning is not a flat-only operation).
   */
  clone(): FilterManager<TData> {
    return new FilterManager(this.columns, this.filterNode);
  }
}
