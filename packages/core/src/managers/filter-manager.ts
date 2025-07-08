import type { 
  FilterState, 
  FilterOperator, 
  FilterOperatorDefinition,
  FilterConfig,
  FilterOption 
} from '../types/filter';
import type { ColumnDefinition, ColumnType } from '../types/column';

/**
 * Event types for filter manager
 */
export type FilterManagerEvent = 
  | { type: 'filter_added'; filter: FilterState }
  | { type: 'filter_updated'; columnId: string; filter: FilterState }
  | { type: 'filter_removed'; columnId: string }
  | { type: 'filters_cleared' }
  | { type: 'filters_replaced'; filters: FilterState[] };

/**
 * Filter manager subscriber function type
 */
export type FilterManagerSubscriber = (event: FilterManagerEvent) => void;

/**
 * Filter validation result
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
 * Filter serialization options
 */
export interface FilterSerializationOptions {
  /** Whether to include metadata */
  includeMeta?: boolean;
  /** Whether to compress the output */
  compress?: boolean;
}

/**
 * Core filter manager class for managing filter state and operations
 */
export class FilterManager<TData = any> {
  private filters: FilterState[] = [];
  private columns: ColumnDefinition<TData>[] = [];
  private subscribers: FilterManagerSubscriber[] = [];
  private operatorDefinitions: Map<FilterOperator, FilterOperatorDefinition> = new Map();

  constructor(
    columns: ColumnDefinition<TData>[],
    initialFilters: FilterState[] = []
  ) {
    this.columns = columns;
    this.initializeOperatorDefinitions();
    this.setFilters(initialFilters);
  }

  /**
   * Initialize default operator definitions
   */
  private initializeOperatorDefinitions(): void {
    // Text operators
    this.operatorDefinitions.set('contains', {
      key: 'contains',
      label: 'Contains',
      description: 'Contains the specified text',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'string'
    });

    this.operatorDefinitions.set('equals', {
      key: 'equals',
      label: 'Equals',
      description: 'Exactly matches the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && values[0] != null
    });

    this.operatorDefinitions.set('startsWith', {
      key: 'startsWith',
      label: 'Starts with',
      description: 'Starts with the specified text',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'string'
    });

    this.operatorDefinitions.set('endsWith', {
      key: 'endsWith',
      label: 'Ends with',
      description: 'Ends with the specified text',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'string'
    });

    this.operatorDefinitions.set('isEmpty', {
      key: 'isEmpty',
      label: 'Is empty',
      description: 'Is empty or null',
      valueCount: 0,
      supportsNull: true,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isNotEmpty', {
      key: 'isNotEmpty',
      label: 'Is not empty',
      description: 'Is not empty and not null',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    // Number operators
    this.operatorDefinitions.set('notEquals', {
      key: 'notEquals',
      label: 'Not equals',
      description: 'Does not equal the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'number'
    });

    this.operatorDefinitions.set('greaterThan', {
      key: 'greaterThan',
      label: 'Greater than',
      description: 'Greater than the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'number'
    });

    this.operatorDefinitions.set('greaterThanOrEqual', {
      key: 'greaterThanOrEqual',
      label: 'Greater than or equal',
      description: 'Greater than or equal to the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'number'
    });

    this.operatorDefinitions.set('lessThan', {
      key: 'lessThan',
      label: 'Less than',
      description: 'Less than the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'number'
    });

    this.operatorDefinitions.set('lessThanOrEqual', {
      key: 'lessThanOrEqual',
      label: 'Less than or equal',
      description: 'Less than or equal to the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && typeof values[0] === 'number'
    });

    this.operatorDefinitions.set('between', {
      key: 'between',
      label: 'Between',
      description: 'Between two values (inclusive)',
      valueCount: 2,
      supportsNull: false,
      validate: (values) => values.length === 2 && values.every(v => typeof v === 'number')
    });

    this.operatorDefinitions.set('notBetween', {
      key: 'notBetween',
      label: 'Not between',
      description: 'Not between two values',
      valueCount: 2,
      supportsNull: false,
      validate: (values) => values.length === 2 && values.every(v => typeof v === 'number')
    });

    // Date operators
    this.operatorDefinitions.set('is', {
      key: 'is',
      label: 'Is',
      description: 'Is the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && values[0] != null
    });

    this.operatorDefinitions.set('isNot', {
      key: 'isNot',
      label: 'Is not',
      description: 'Is not the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && values[0] != null
    });

    this.operatorDefinitions.set('before', {
      key: 'before',
      label: 'Before',
      description: 'Before the specified date',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && values[0] instanceof Date
    });

    this.operatorDefinitions.set('after', {
      key: 'after',
      label: 'After',
      description: 'After the specified date',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1 && values[0] instanceof Date
    });

    // Date preset operators
    this.operatorDefinitions.set('isToday', {
      key: 'isToday',
      label: 'Is today',
      description: 'Is today',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isYesterday', {
      key: 'isYesterday',
      label: 'Is yesterday',
      description: 'Is yesterday',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isThisWeek', {
      key: 'isThisWeek',
      label: 'Is this week',
      description: 'Is this week',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isThisMonth', {
      key: 'isThisMonth',
      label: 'Is this month',
      description: 'Is this month',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isThisYear', {
      key: 'isThisYear',
      label: 'Is this year',
      description: 'Is this year',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    // Option operators
    this.operatorDefinitions.set('isAnyOf', {
      key: 'isAnyOf',
      label: 'Is any of',
      description: 'Is any of the specified values',
      valueCount: 'variable',
      supportsNull: false,
      validate: (values) => values.length >= 1
    });

    this.operatorDefinitions.set('isNoneOf', {
      key: 'isNoneOf',
      label: 'Is none of',
      description: 'Is none of the specified values',
      valueCount: 'variable',
      supportsNull: false,
      validate: (values) => values.length >= 1
    });

    // Multi-option operators
    this.operatorDefinitions.set('includes', {
      key: 'includes',
      label: 'Includes',
      description: 'Includes the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1
    });

    this.operatorDefinitions.set('excludes', {
      key: 'excludes',
      label: 'Excludes',
      description: 'Excludes the specified value',
      valueCount: 1,
      supportsNull: false,
      validate: (values) => values.length === 1
    });

    this.operatorDefinitions.set('includesAny', {
      key: 'includesAny',
      label: 'Includes any',
      description: 'Includes any of the specified values',
      valueCount: 'variable',
      supportsNull: false,
      validate: (values) => values.length >= 1
    });

    this.operatorDefinitions.set('includesAll', {
      key: 'includesAll',
      label: 'Includes all',
      description: 'Includes all of the specified values',
      valueCount: 'variable',
      supportsNull: false,
      validate: (values) => values.length >= 1
    });

    this.operatorDefinitions.set('excludesAny', {
      key: 'excludesAny',
      label: 'Excludes any',
      description: 'Excludes any of the specified values',
      valueCount: 'variable',
      supportsNull: false,
      validate: (values) => values.length >= 1
    });

    this.operatorDefinitions.set('excludesAll', {
      key: 'excludesAll',
      label: 'Excludes all',
      description: 'Excludes all of the specified values',
      valueCount: 'variable',
      supportsNull: false,
      validate: (values) => values.length >= 1
    });

    // Boolean operators
    this.operatorDefinitions.set('isTrue', {
      key: 'isTrue',
      label: 'Is true',
      description: 'Is true',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isFalse', {
      key: 'isFalse',
      label: 'Is false',
      description: 'Is false',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isNull', {
      key: 'isNull',
      label: 'Is null',
      description: 'Is null or undefined',
      valueCount: 0,
      supportsNull: true,
      validate: (values) => values.length === 0
    });

    this.operatorDefinitions.set('isNotNull', {
      key: 'isNotNull',
      label: 'Is not null',
      description: 'Is not null or undefined',
      valueCount: 0,
      supportsNull: false,
      validate: (values) => values.length === 0
    });
  }

  /**
   * Get current filters
   */
  getFilters(): FilterState[] {
    return [...this.filters];
  }

  /**
   * Set filters (replaces all existing filters)
   */
  setFilters(filters: FilterState[]): void {
    const validFilters = filters.filter(filter => {
      const validation = this.validateFilter(filter);
      if (!validation.valid) {
        console.warn(`Invalid filter for column ${filter.columnId}: ${validation.error}`);
        return false;
      }
      return true;
    });

    this.filters = validFilters;
    this.notifySubscribers({ type: 'filters_replaced', filters: validFilters });
  }

  /**
   * Add a new filter or update existing filter for the same column
   */
  addFilter(filter: FilterState): void {
    const validation = this.validateFilter(filter);
    if (!validation.valid) {
      throw new Error(`Invalid filter for column ${filter.columnId}: ${validation.error}`);
    }

    const existingIndex = this.filters.findIndex(f => f.columnId === filter.columnId);
    
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
    const index = this.filters.findIndex(f => f.columnId === columnId);
    if (index >= 0) {
      this.filters.splice(index, 1);
      this.notifySubscribers({ type: 'filter_removed', columnId });
    }
  }

  /**
   * Update filter values or operator
   */
  updateFilter(columnId: string, updates: Partial<FilterState>): void {
    const index = this.filters.findIndex(f => f.columnId === columnId);
    if (index >= 0) {
      const updatedFilter = { ...this.filters[index], ...updates };
      const validation = this.validateFilter(updatedFilter);
      
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
    return this.filters.find(f => f.columnId === columnId);
  }

  /**
   * Check if column has active filter
   */
  hasFilter(columnId: string): boolean {
    return this.filters.some(f => f.columnId === columnId);
  }

  /**
   * Get all filtered column IDs
   */
  getFilteredColumnIds(): string[] {
    return this.filters.map(f => f.columnId);
  }

  /**
   * Get filters by column type
   */
  getFiltersByType(type: ColumnType): FilterState[] {
    return this.filters.filter(f => f.type === type);
  }

  /**
   * Validate a filter against column definitions and operator rules
   */
  validateFilter(filter: FilterState): FilterValidationResult {
    const column = this.columns.find(c => c.id === filter.columnId);
    if (!column) {
      return { valid: false, error: `Column ${filter.columnId} not found` };
    }

    if (!column.filterable) {
      return { valid: false, error: `Column ${filter.columnId} is not filterable` };
    }

    if (filter.type !== column.type) {
      return { valid: false, error: `Filter type ${filter.type} doesn't match column type ${column.type}` };
    }

    const operatorDef = this.operatorDefinitions.get(filter.operator);
    if (!operatorDef) {
      return { valid: false, error: `Unknown operator: ${filter.operator}` };
    }

    // Check if operator is allowed for this column
    if (column.filter?.operators && !column.filter.operators.includes(filter.operator)) {
      return { valid: false, error: `Operator ${filter.operator} not allowed for column ${filter.columnId}` };
    }

    // Validate operator value requirements
    if (operatorDef.valueCount === 0 && filter.values.length > 0) {
      return { valid: false, error: `Operator ${filter.operator} requires no values` };
    }

    if (typeof operatorDef.valueCount === 'number' && filter.values.length !== operatorDef.valueCount) {
      return { valid: false, error: `Operator ${filter.operator} requires exactly ${operatorDef.valueCount} values` };
    }

    if (operatorDef.valueCount === 'variable' && filter.values.length === 0) {
      return { valid: false, error: `Operator ${filter.operator} requires at least one value` };
    }

    // Run operator validation
    if (operatorDef.validate && !operatorDef.validate(filter.values)) {
      return { valid: false, error: `Invalid values for operator ${filter.operator}` };
    }

    // Run column-specific validation
    if (column.filter?.validation) {
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
    const column = this.columns.find(c => c.id === columnId);
    if (!column || !column.filterable) {
      return [];
    }

    const allowedOperators = column.filter?.operators || this.getDefaultOperatorsForType(column.type);
    return allowedOperators
      .map(op => this.operatorDefinitions.get(op))
      .filter(Boolean) as FilterOperatorDefinition[];
  }

  /**
   * Get default operators for a column type
   */
  getDefaultOperatorsForType(type: ColumnType): FilterOperator[] {
    switch (type) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
      
      case 'number':
      case 'currency':
      case 'percentage':
        return ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'notBetween'];
      
      case 'date':
        return ['is', 'isNot', 'before', 'after', 'isToday', 'isYesterday', 'isThisWeek', 'isThisMonth', 'isThisYear'];
      
      case 'boolean':
        return ['isTrue', 'isFalse', 'isNull', 'isNotNull'];
      
      case 'option':
        return ['is', 'isNot', 'isAnyOf', 'isNoneOf'];
      
      case 'multiOption':
        return ['includes', 'excludes', 'includesAny', 'includesAll', 'excludesAny', 'excludesAll'];
      
      default:
        return ['equals', 'notEquals', 'isNull', 'isNotNull'];
    }
  }

  /**
   * Get operator definition
   */
  getOperatorDefinition(operator: FilterOperator): FilterOperatorDefinition | undefined {
    return this.operatorDefinitions.get(operator);
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
    this.subscribers.forEach(callback => {
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
      filters: this.filters.map(filter => ({
        columnId: filter.columnId,
        type: filter.type,
        operator: filter.operator,
        values: filter.values,
        ...(filter.includeNull && { includeNull: filter.includeNull }),
        ...(options.includeMeta && filter.meta && { meta: filter.meta })
      }))
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
      filtersByOperator: {} as Record<FilterOperator, number>
    };

    this.filters.forEach(filter => {
      stats.filtersByType[filter.type] = (stats.filtersByType[filter.type] || 0) + 1;
      stats.filtersByOperator[filter.operator] = (stats.filtersByOperator[filter.operator] || 0) + 1;
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