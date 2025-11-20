/**
 * @fileoverview Filter manager for handling table filter state and operations.
 *
 * This module provides comprehensive filter management including validation, operator support,
 * event-based subscriptions, and serialization for table column filtering operations.
 *
 * @module managers/filter-manager
 */

import type { ColumnDefinition, ColumnType } from '../types/column';
import type { FilterOperator, FilterOperatorDefinition, FilterState } from '../types/filter';
import {
  createOperatorRegistry,
  getAllOperators,
  getDefaultOperatorsForType,
  getOperatorDefinition,
} from '../types/filter-operators';

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
  | { type: 'filters_replaced'; filters: FilterState[] };

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
export class FilterManager<TData = unknown> {
  private filters: FilterState[] = [];
  private columns: ColumnDefinition<TData>[] = [];
  private subscribers: FilterManagerSubscriber[] = [];
  private operatorDefinitions: Map<FilterOperator, FilterOperatorDefinition> = new Map();

  /**
   * Create a new filter manager instance.
   *
   * Initializes the filter manager with column definitions, initial filters,
   * and operator registry. The manager will validate all filter operations
   * against the provided column definitions and emit events for state changes.
   *
   * @param columns - Array of column definitions to validate filters against
   * @param initialFilters - Optional initial filter states
   *
   * @example
   * ```typescript
   * const filterManager = new FilterManager<User>(columns, [
   *   { columnId: 'status', operator: 'is', values: ['active'] },
   *   { columnId: 'age', operator: 'greaterThan', values: [18] }
   * ]);
   * ```
   */
  constructor(columns: ColumnDefinition<TData>[], initialFilters: FilterState[] = []) {
    this.columns = columns;
    this.operatorDefinitions = createOperatorRegistry(getAllOperators());
    this.setFilters(initialFilters);
  }

  /**
   * Get current filters.
   *
   * Returns a copy of the current filter states. The returned array is a shallow
   * copy to prevent external mutations while allowing safe iteration and inspection.
   *
   * @returns Array of current filter states
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
    return [...this.filters];
  }

  /**
   * Set filters (replaces all existing filters)
   * Uses lenient validation to allow incomplete filters with empty values for UI editing
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

    this.filters = validFilters;
    this.notifySubscribers({ type: 'filters_replaced', filters: validFilters });
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

    const existingIndex = this.filters.findIndex((f) => f.columnId === filter.columnId);

    if (existingIndex >= 0) {
      this.filters[existingIndex] = filter;
      this.notifySubscribers({ type: 'filter_updated', columnId: filter.columnId, filter });
    } else {
      this.filters.push(filter);
      this.notifySubscribers({ type: 'filter_added', filter });
    }
  }

  /**
   * Remove a filter by column ID
   */
  removeFilter(columnId: string): void {
    const index = this.filters.findIndex((f) => f.columnId === columnId);
    if (index >= 0) {
      this.filters.splice(index, 1);
      this.notifySubscribers({ type: 'filter_removed', columnId });
    }
  }

  /**
   * Update filter values or operator
   * Uses lenient validation to allow incomplete filters with empty values for UI editing
   */
  updateFilter(columnId: string, updates: Partial<FilterState>): void {
    const index = this.filters.findIndex((f) => f.columnId === columnId);
    if (index >= 0) {
      const updatedFilter = { ...this.filters[index], ...updates } as FilterState;
      // Use lenient validation (strict = false) to allow incomplete filters in UI state
      const validation = this.validateFilter(updatedFilter, false);

      if (!validation.valid) {
        throw new Error(`Invalid filter update for column ${columnId}: ${validation.error}`);
      }

      this.filters[index] = updatedFilter;
      this.notifySubscribers({ type: 'filter_updated', columnId, filter: updatedFilter });
    }
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = [];
    this.notifySubscribers({ type: 'filters_cleared' });
  }

  /**
   * Get filter for specific column
   */
  getFilter(columnId: string): FilterState | undefined {
    return this.filters.find((f) => f.columnId === columnId);
  }

  /**
   * Check if column has active filter
   */
  hasFilter(columnId: string): boolean {
    return this.filters.some((f) => f.columnId === columnId);
  }

  /**
   * Get all filtered column IDs
   */
  getFilteredColumnIds(): string[] {
    return this.filters.map((f) => f.columnId);
  }

  /**
   * Get filters by column type
   */
  getFiltersByType(type: ColumnType): FilterState[] {
    return this.filters.filter((f) => f.type === type);
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

    // Validate operator value requirements
    if (operatorDef.valueCount === 0 && filter.values.length > 0) {
      return { valid: false, error: `Operator ${filter.operator} requires no values` };
    }

    if (
      typeof operatorDef.valueCount === 'number' &&
      filter.values.length !== operatorDef.valueCount
    ) {
      // In lenient mode, allow incomplete filters with missing values for UI editing
      if (!strict) {
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
   * Subscribe to filter changes
   */
  subscribe(callback: FilterManagerSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of filter changes
   */
  private notifySubscribers(event: FilterManagerEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in filter manager subscriber:', error);
      }
    });
  }

  /**
   * Serialize filters to JSON
   */
  serialize(options: FilterSerializationOptions = {}): string {
    const data = {
      filters: this.filters.map((filter) => ({
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
    const stats = {
      totalFilters: this.filters.length,
      filtersByType: {} as Record<ColumnType, number>,
      filtersByOperator: {} as Record<FilterOperator, number>,
    };

    this.filters.forEach((filter) => {
      stats.filtersByType[filter.type] = (stats.filtersByType[filter.type] || 0) + 1;
      stats.filtersByOperator[filter.operator] =
        (stats.filtersByOperator[filter.operator] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clone the filter manager with the same configuration
   */
  clone(): FilterManager<TData> {
    return new FilterManager(this.columns, this.filters);
  }
}
