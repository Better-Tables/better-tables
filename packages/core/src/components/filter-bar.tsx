import React, { useState, useCallback, useMemo } from 'react';
import type { ColumnDefinition } from '../types/column';
import type { FilterState, FilterGroup } from '../types/filter';
import type { FilterInputComponents } from './filter-inputs/types';
import { FilterManager } from '../managers/filter-manager';
import {
  TextFilterInput,
  NumberFilterInput,
  DateFilterInput,
  OptionFilterInput,
  MultiOptionFilterInput,
  BooleanFilterInput,
  type FilterInputTheme,
} from './filter-inputs';

/**
 * Props for the FilterBar component
 */
export interface FilterBarProps<TData = any> {
  /** Column definitions */
  columns: ColumnDefinition<TData>[];
  
  /** Current filters */
  filters: FilterState[];
  
  /** Filter change handler */
  onFiltersChange: (filters: FilterState[]) => void;
  
  /** Filter groups for organization */
  groups?: FilterGroup[];
  
  /** Custom filter input components */
  filterComponents?: Partial<FilterInputComponents>;
  
  /** Theme configuration */
  theme?: FilterBarTheme;
  
  /** Whether the filter bar is disabled */
  disabled?: boolean;
  
  /** Maximum number of filters to show */
  maxFilters?: number;
  
  /** Whether to show the add filter button */
  showAddFilter?: boolean;
  
  /** Whether to show the clear all button */
  showClearAll?: boolean;
  
  /** Whether to show filter groups */
  showGroups?: boolean;
  
  /** Whether to allow searching columns */
  searchable?: boolean;
  
  /** Placeholder text for column search */
  searchPlaceholder?: string;
  
  /** Custom class name */
  className?: string;
  
  /** Additional props */
  [key: string]: any;
}

/**
 * Theme configuration for FilterBar
 */
export interface FilterBarTheme {
  /** Container styling */
  container?: string;
  
  /** Header styling */
  header?: string;
  
  /** Add filter button styling */
  addButton?: string;
  
  /** Clear all button styling */
  clearButton?: string;
  
  /** Search input styling */
  searchInput?: string;
  
  /** Group styling */
  group?: string;
  
  /** Group header styling */
  groupHeader?: string;
  
  /** Column list styling */
  columnList?: string;
  
  /** Column item styling */
  columnItem?: string;
  
  /** Active filters styling */
  activeFilters?: string;
  
  /** Filter input theme */
  filterInput?: FilterInputTheme;
}

/**
 * Main FilterBar component for managing table filters
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  columns,
  filters,
  onFiltersChange,
  groups,
  filterComponents,
  theme,
  disabled = false,
  maxFilters,
  showAddFilter = true,
  showClearAll = true,
  showGroups = true,
  searchable = true,
  searchPlaceholder = 'Search columns...',
  className = '',
  ...props
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Create filter manager
  const filterManager = useMemo(() => {
    return new FilterManager(columns, filters);
  }, [columns, filters]);

  // Get filterable columns
  const filterableColumns = useMemo(() => {
    return columns.filter(column => column.filterable);
  }, [columns]);

  // Get columns already being filtered
  const filteredColumnIds = useMemo(() => {
    return new Set(filters.map(f => f.columnId));
  }, [filters]);

  // Get available columns (not already filtered)
  const availableColumns = useMemo(() => {
    return filterableColumns.filter(column => !filteredColumnIds.has(column.id));
  }, [filterableColumns, filteredColumnIds]);

  // Filter columns by search term
  const searchedColumns = useMemo(() => {
    if (!searchTerm) return availableColumns;
    
    return availableColumns.filter(column =>
      column.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      column.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableColumns, searchTerm]);

  // Group columns if groups are provided
  const groupedColumns = useMemo(() => {
    if (!groups || !showGroups) {
      return { ungrouped: searchedColumns };
    }

    const grouped: Record<string, ColumnDefinition[]> = {};
    const ungrouped: ColumnDefinition[] = [];

    searchedColumns.forEach(column => {
      const group = groups.find(g => g.columns.includes(column.id));
      if (group) {
        if (!grouped[group.id]) {
          grouped[group.id] = [];
        }
        grouped[group.id].push(column);
      } else {
        ungrouped.push(column);
      }
    });

    if (ungrouped.length > 0) {
      grouped.ungrouped = ungrouped;
    }

    return grouped;
  }, [searchedColumns, groups, showGroups]);

  // Default filter input components
  const defaultComponents: FilterInputComponents = {
    text: TextFilterInput,
    number: NumberFilterInput,
    date: DateFilterInput,
    option: OptionFilterInput,
    multiOption: MultiOptionFilterInput,
    boolean: BooleanFilterInput,
  };

  const components = { ...defaultComponents, ...filterComponents };

  // Event handlers
  const handleAddFilter = useCallback((columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const operators = filterManager.getAvailableOperators(columnId);
    if (operators.length === 0) return;

    const newFilter: FilterState = {
      columnId,
      type: column.type,
      operator: operators[0].key,
      values: [],
    };

    const updatedFilters = [...filters, newFilter];
    onFiltersChange(updatedFilters);
    setShowAddMenu(false);
  }, [columns, filters, onFiltersChange, filterManager]);

  const handleFilterChange = useCallback((index: number, updates: Partial<FilterState>) => {
    const updatedFilters = filters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    );
    onFiltersChange(updatedFilters);
  }, [filters, onFiltersChange]);

  const handleFilterRemove = useCallback((index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    onFiltersChange(updatedFilters);
  }, [filters, onFiltersChange]);

  const handleClearAll = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  const handleGroupToggle = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Render filter input
  const renderFilterInput = useCallback((filter: FilterState, index: number) => {
    const column = columns.find(c => c.id === filter.columnId);
    if (!column) return null;

    const operators = filterManager.getAvailableOperators(filter.columnId);
    const FilterComponent = components[column.type as keyof FilterInputComponents];

    if (!FilterComponent) {
      console.warn(`No filter component found for column type: ${column.type}`);
      return null;
    }

    const commonProps = {
      filter,
      column,
      operators,
      operator: filter.operator,
      values: filter.values,
      onOperatorChange: (operator: any) => handleFilterChange(index, { operator }),
      onValuesChange: (values: any[]) => handleFilterChange(index, { values }),
      onRemove: () => handleFilterRemove(index),
      disabled,
      theme: theme?.filterInput,
    };

    // Type-specific props
    const typeSpecificProps: any = {};
    
    if (column.type === 'option' || column.type === 'multiOption') {
      typeSpecificProps.options = column.filter?.options || [];
    }

    return (
      <FilterComponent
        key={`${filter.columnId}-${index}`}
        {...commonProps}
        {...typeSpecificProps}
      />
    );
  }, [columns, filterManager, components, handleFilterChange, handleFilterRemove, disabled, theme]);

  // Base classes with theme overrides
  const containerClass = `filter-bar ${theme?.container || ''} ${className}`.trim();
  const headerClass = `filter-bar__header ${theme?.header || ''}`.trim();
  const addButtonClass = `filter-bar__add-button ${theme?.addButton || ''}`.trim();
  const clearButtonClass = `filter-bar__clear-button ${theme?.clearButton || ''}`.trim();
  const searchInputClass = `filter-bar__search ${theme?.searchInput || ''}`.trim();
  const activeFiltersClass = `filter-bar__active-filters ${theme?.activeFilters || ''}`.trim();

  // Check if we've reached max filters
  const hasReachedMaxFilters = maxFilters && filters.length >= maxFilters;

  return (
    <div className={containerClass} {...props}>
      {/* Header */}
      <div className={headerClass}>
        <div className="filter-bar__title">
          <span>Filters</span>
          {filters.length > 0 && (
            <span className="filter-bar__count">({filters.length})</span>
          )}
        </div>

        <div className="filter-bar__actions">
          {/* Add Filter Button */}
          {showAddFilter && !hasReachedMaxFilters && availableColumns.length > 0 && (
            <div className="filter-bar__add-filter">
              <button
                type="button"
                className={addButtonClass}
                onClick={() => setShowAddMenu(!showAddMenu)}
                disabled={disabled}
                aria-label="Add filter"
              >
                Add Filter
              </button>

              {/* Add Filter Menu */}
              {showAddMenu && (
                <div className="filter-bar__add-menu">
                  {/* Search */}
                  {searchable && (
                    <input
                      type="text"
                      className={searchInputClass}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={searchPlaceholder}
                      aria-label="Search columns"
                    />
                  )}

                  {/* Grouped Columns */}
                  {Object.entries(groupedColumns).map(([groupId, groupColumns]) => {
                    if (groupColumns.length === 0) return null;

                    const group = groups?.find(g => g.id === groupId);
                    const isExpanded = expandedGroups.has(groupId);
                    const isUngrouped = groupId === 'ungrouped';

                    return (
                      <div key={groupId} className={`filter-bar__group ${theme?.group || ''}`}>
                        {!isUngrouped && group && (
                          <button
                            type="button"
                            className={`filter-bar__group-header ${theme?.groupHeader || ''}`}
                            onClick={() => handleGroupToggle(groupId)}
                            aria-expanded={isExpanded}
                          >
                            {group.icon && <span className="filter-bar__group-icon">{typeof group.icon === 'function' ? <group.icon /> : group.icon}</span>}
                            <span>{group.label}</span>
                            <span className="filter-bar__group-toggle">
                              {isExpanded ? '−' : '+'}
                            </span>
                          </button>
                        )}

                        {(isUngrouped || isExpanded) && (
                          <div className={`filter-bar__column-list ${theme?.columnList || ''}`}>
                            {groupColumns.map(column => (
                              <button
                                key={column.id}
                                type="button"
                                className={`filter-bar__column-item ${theme?.columnItem || ''}`}
                                onClick={() => handleAddFilter(column.id)}
                                disabled={disabled}
                              >
                                {column.icon && (
                                  <span className="filter-bar__column-icon">{typeof column.icon === 'function' ? <column.icon /> : column.icon}</span>
                                )}
                                <span className="filter-bar__column-name">{column.displayName}</span>
                                <span className="filter-bar__column-type">{column.type}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* No columns available */}
                  {Object.values(groupedColumns).every(cols => cols.length === 0) && (
                    <div className="filter-bar__no-columns">
                      {searchTerm ? 'No columns found' : 'All columns are already filtered'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Clear All Button */}
          {showClearAll && filters.length > 0 && (
            <button
              type="button"
              className={clearButtonClass}
              onClick={handleClearAll}
              disabled={disabled}
              aria-label="Clear all filters"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className={activeFiltersClass}>
          {filters.map((filter, index) => renderFilterInput(filter, index))}
        </div>
      )}

      {/* Empty State */}
      {filters.length === 0 && (
        <div className="filter-bar__empty">
          <p>No filters applied</p>
          {showAddFilter && availableColumns.length > 0 && (
            <p>Click &quot;Add Filter&quot; to start filtering your data</p>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBar; 