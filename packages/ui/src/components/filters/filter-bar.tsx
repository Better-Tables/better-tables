'use client';

import * as React from 'react';
import type { ColumnDefinition, FilterState, FilterGroup, FilterOperator, ColumnType } from '@better-tables/core';
import { cn } from '@/lib/utils';
import { FilterButton } from './filter-button';
import { FilterDropdown } from './filter-dropdown';
import { ActiveFilters } from './active-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search } from 'lucide-react';

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
}

export interface FilterBarProps<TData = any> {
  /** Column definitions from Better Tables */
  columns: ColumnDefinition<TData>[];
  /** Current filter state */
  filters: FilterState[];
  /** Callback when filters change */
  onFiltersChange: (filters: FilterState[]) => void;
  /** Optional filter groups for organization */
  groups?: FilterGroup[];
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
  /** Additional CSS classes */
  className?: string;
  /** Custom filter components to show before the filter selector */
  customFilters?: React.ReactNode[];
  /** Custom label for the add filter button */
  addFilterLabel?: string;
  /** Callback to check if a filter is protected (can't be removed) */
  isFilterProtected?: (filter: FilterState) => boolean;
}

export function FilterBar<TData = any>({
  columns,
  filters,
  onFiltersChange,
  groups,
  theme,
  disabled = false,
  maxFilters,
  showAddFilter = true,
  showClearAll = true,
  showGroups = true,
  searchable = true,
  searchPlaceholder = 'Search columns...',
  className,
  customFilters = [],
  addFilterLabel = 'Add filter',
  isFilterProtected,
}: FilterBarProps<TData>) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  // Get filterable columns
  const filterableColumns = React.useMemo(
    () => columns.filter(col => col.filterable !== false),
    [columns],
  );

  // Get columns that don't already have a filter
  const availableColumns = React.useMemo(() => {
    const filtered = filterableColumns.filter(col => !filters.find(f => f.columnId === col.id));
    
    // Apply search filter if searchable
    if (!searchable || !searchTerm) return filtered;
    
    return filtered.filter(column =>
      column.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      column.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filterableColumns, filters, searchable, searchTerm]);

  // Check if we've reached max filters
  const hasReachedMaxFilters = maxFilters !== undefined && filters.length >= maxFilters;

  const handleAddFilter = React.useCallback((columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column || hasReachedMaxFilters) return;

    const newFilter: FilterState = {
      columnId,
      type: column.type,
      operator: getDefaultOperator(column.type),
      values: [],
    };

    onFiltersChange([...filters, newFilter]);
    setIsDropdownOpen(false);
  }, [columns, hasReachedMaxFilters, filters, onFiltersChange]);

  const handleRemoveFilter = React.useCallback((columnId: string) => {
    onFiltersChange(filters.filter(f => f.columnId !== columnId));
  }, [filters, onFiltersChange]);

  const handleUpdateFilter = React.useCallback((columnId: string, updates: Partial<FilterState>) => {
    onFiltersChange(filters.map(f => (f.columnId === columnId ? { ...f, ...updates } : f)));
  }, [filters, onFiltersChange]);

  const handleClearAll = React.useCallback(() => {
    // Only clear non-protected filters
    const protectedFilters = isFilterProtected ? filters.filter(isFilterProtected) : [];
    onFiltersChange(protectedFilters);
  }, [filters, isFilterProtected, onFiltersChange]);

  const hasFilters = React.useMemo(() => filters.length > 0, [filters.length]);
  
  const hasRemovableFilters = React.useMemo(() => 
    isFilterProtected ? filters.some(f => !isFilterProtected(f)) : hasFilters,
    [filters, isFilterProtected, hasFilters]
  );

  const isAddFilterDisabled = React.useMemo(() => 
    disabled || availableColumns.length === 0 || hasReachedMaxFilters,
    [disabled, availableColumns.length, hasReachedMaxFilters]
  );

  return (
    <div className={cn('w-full space-y-2', theme?.container, className)}>
      {/* Search Input for large column sets */}
      {searchable && availableColumns.length > 10 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {/* Custom Filters */}
      {customFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-2">
          {customFilters.map((filter, index) => (
            <div key={index} className="w-full sm:w-auto sm:max-w-md">
              {filter}
            </div>
          ))}
        </div>
      )}

      {/* Main Filter Controls */}
      <div className="flex w-full flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        {/* Mobile: Stack vertically, Desktop: Horizontal layout */}
        <div className="flex w-full flex-1 flex-col sm:flex-row gap-2">
          {/* Add Filter Button & Dropdown */}
          {showAddFilter && (
            <div className="shrink-0">
              <FilterDropdown
                columns={availableColumns}
                groups={showGroups ? groups : undefined}
                onSelect={handleAddFilter}
                open={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
                searchable={searchable}
                searchPlaceholder={searchPlaceholder}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                disabled={disabled}
              >
                <FilterButton
                  hasFilters={hasFilters}
                  disabled={isAddFilterDisabled}
                  label={addFilterLabel}
                  className={cn("w-full sm:w-auto", theme?.addButton)}
                />
              </FilterDropdown>
            </div>
          )}

          {/* Active Filters with horizontal scrolling on mobile */}
          <div className="flex-1 min-w-0">
            <ActiveFilters
              columns={columns}
              filters={filters}
              onUpdateFilter={handleUpdateFilter}
              onRemoveFilter={handleRemoveFilter}
              isFilterProtected={isFilterProtected}
              disabled={disabled}
              className={theme?.activeFilters}
            />
          </div>
        </div>

        {/* Clear All Button */}
        {showClearAll && hasRemovableFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            disabled={disabled}
            className={cn("h-8 px-2 lg:px-3 w-full sm:w-auto", theme?.clearButton)}
          >
            <X className="mr-1 h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}

function getDefaultOperator(columnType: ColumnType): FilterOperator {
  switch (columnType) {
    case 'text':
      return 'contains';
    case 'number':
    case 'currency':
    case 'percentage':
      return 'equals';
    case 'date':
      return 'is';
    case 'boolean':
      return 'isTrue';
    case 'option':
      return 'is';
    case 'multiOption':
      return 'includes';
    default:
      return 'equals';
  }
}
