# @better-tables/ui - Hooks Reference

## Overview

The Better Tables UI package provides a comprehensive set of React hooks for managing table state, virtualization, filtering, and data fetching. These hooks are designed to work seamlessly with the table components and provide a clean, type-safe API for common table operations.

## Table of Contents

- [Hooks Overview](#hooks-overview)
- [useDebounce](#usedebounce)
- [useFilterValidation](#usefiltervalidation)
- [useKeyboardNavigation](#usekeyboardnavigation)
- [useVirtualization](#usevirtualization)
- [useTableData](#usetabledata)
- [Hook Composition Patterns](#hook-composition-patterns)
- [Performance Considerations](#performance-considerations)
- [Usage Examples](#usage-examples)

## Hooks Overview

The hooks are organized by functionality:

- **State Management**: `useTableData` for data fetching and state management
- **Performance**: `useDebounce` for input debouncing, `useVirtualization` for virtual scrolling
- **Validation**: `useFilterValidation` for filter value validation
- **Accessibility**: `useKeyboardNavigation` for keyboard interaction management

### Hook Dependencies

```typescript
// Core package dependencies
import {
  FilterState,
  PaginationState,
  TableAdapter,
  VirtualizationManager,
  validateOperatorValues,
} from '@better-tables/core';

// React dependencies
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
```

## useDebounce

A utility hook for debouncing values, commonly used for search inputs and filter values.

### Signature

```typescript
function useDebounce<T>(value: T, delay: number): T;
```

### Parameters

- `value`: The value to debounce
- `delay`: The debounce delay in milliseconds

### Returns

The debounced value

### Usage Example

```typescript
import { useDebounce } from '@better-tables/ui';

function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm) {
      // Perform search with debounced value
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <Input
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### Advanced Usage

```typescript
// Debouncing filter values
function FilterInput() {
  const [filterValue, setFilterValue] = useState('');
  const debouncedValue = useDebounce(filterValue, 500);

  const { isValid, error } = useFilterValidation({
    filter: { ...filter, values: [debouncedValue] },
    column,
    values: [debouncedValue],
  });

  useEffect(() => {
    if (isValid && debouncedValue) {
      onFilterChange(debouncedValue);
    }
  }, [debouncedValue, isValid]);

  return (
    <div>
      <Input
        value={filterValue}
        onChange={e => setFilterValue(e.target.value)}
        placeholder="Enter filter value..."
      />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
```

## useFilterValidation

A hook for validating filter values against operator requirements and column constraints.

### Signature

```typescript
function useFilterValidation({
  filter,
  column,
  values,
  immediate = true,
}: UseFilterValidationOptions): ValidationResult;
```

### Parameters

```typescript
interface UseFilterValidationOptions {
  /** Current filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition;
  /** Values to validate */
  values: any[];
  /** Whether to validate immediately */
  immediate?: boolean;
}
```

### Returns

```typescript
interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}
```

### Usage Example

```typescript
import { useFilterValidation } from '@better-tables/ui';

function NumberFilterInput({ filter, column, onChange }) {
  const [value, setValue] = useState(filter.values[0] || '');

  const { isValid, error } = useFilterValidation({
    filter: { ...filter, values: [value] },
    column,
    values: [value],
  });

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (isValid) {
      onChange([newValue]);
    }
  };

  return (
    <div>
      <Input
        type="number"
        value={value}
        onChange={e => handleChange(e.target.value)}
        className={!isValid ? 'border-red-500' : ''}
      />
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
}
```

### Validation Types

The hook validates against multiple criteria:

1. **Operator Requirements**: Ensures values match operator expectations
2. **Column Constraints**: Validates against min/max values for numeric columns
3. **Option Validation**: Ensures values are valid options for option columns
4. **Custom Validation**: Runs custom validation functions if provided

```typescript
// Example with custom validation
const column = cb
  .number()
  .id('age')
  .displayName('Age')
  .accessor(user => user.age)
  .filter({
    min: 18,
    max: 100,
    validation: value => {
      if (value < 0) return 'Age cannot be negative';
      if (value > 150) return 'Age seems unrealistic';
      return true;
    },
  })
  .build();

// The hook will validate against all these constraints
const { isValid, error } = useFilterValidation({
  filter: { columnId: 'age', operator: 'gte', values: [25] },
  column,
  values: [25],
});
```

## useKeyboardNavigation

A comprehensive hook for managing keyboard navigation and accessibility in table components.

### Signature

```typescript
function useKeyboardNavigation(config: KeyboardNavigationConfig = {}): KeyboardNavigationResult;
```

### Parameters

```typescript
interface KeyboardNavigationConfig {
  /** Whether to enable keyboard shortcuts */
  enableShortcuts?: boolean;
  /** Whether to enable escape key handling */
  enableEscapeKey?: boolean;
  /** Whether to enable arrow key navigation */
  enableArrowKeys?: boolean;
  /** Whether to enable tab navigation */
  enableTabNavigation?: boolean;
  /** Custom keyboard shortcuts */
  shortcuts?: Record<string, () => void>;
  /** Handler for escape key */
  onEscape?: () => void;
  /** Handler for enter key */
  onEnter?: () => void;
  /** Handler for tab key */
  onTab?: (event: KeyboardEvent) => void;
}
```

### Returns

```typescript
interface KeyboardNavigationResult {
  /** Keyboard event handler */
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** ARIA attributes for accessibility */
  ariaAttributes: {
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean;
    'aria-haspopup'?: boolean;
    role?: string;
  };
  /** Focus management utilities */
  focusUtils: {
    focus: () => void;
    blur: () => void;
    setFocusRef: (ref: HTMLElement | null) => void;
  };
}
```

### Usage Example

```typescript
import { useKeyboardNavigation } from '@better-tables/ui';

function FilterDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  const { onKeyDown, ariaAttributes, focusUtils } = useKeyboardNavigation({
    enableEscapeKey: true,
    enableArrowKeys: true,
    shortcuts: {
      'Ctrl+k': () => setIsOpen(true),
      Escape: () => setIsOpen(false),
    },
    onEscape: () => setIsOpen(false),
    onEnter: () => {
      if (isOpen) {
        selectCurrentItem();
      } else {
        setIsOpen(true);
      }
    },
  });

  return (
    <div onKeyDown={onKeyDown} {...ariaAttributes} ref={focusUtils.setFocusRef}>
      <Button onClick={() => setIsOpen(!isOpen)}>Add Filter</Button>
      {isOpen && <div className="dropdown-content">{/* Dropdown content */}</div>}
    </div>
  );
}
```

### Specialized Hooks

The package also provides specialized navigation hooks:

#### useFilterDropdownNavigation

```typescript
function useFilterDropdownNavigation(
  isOpen: boolean,
  onToggle: () => void,
  onClose: () => void,
  onSelectItem?: (index: number) => void,
) {
  // Returns handleKeyDown, focusedIndex, setFocusedIndex
}
```

#### useFocusManagement

```typescript
function useFocusManagement(containerRef: React.RefObject<HTMLElement>) {
  // Returns focusFirst, focusLast, focusNext, focusPrevious
}
```

### Keyboard Shortcuts

Common shortcuts are provided as constants:

```typescript
import { FILTER_SHORTCUTS } from '@better-tables/ui';

const shortcuts = {
  [FILTER_SHORTCUTS.CLEAR]: () => clearFilters(),
  [FILTER_SHORTCUTS.APPLY]: () => applyFilters(),
  [FILTER_SHORTCUTS.FOCUS_SEARCH]: () => focusSearchInput(),
};
```

## useVirtualization

A powerful hook for implementing virtual scrolling in large tables.

### Signature

```typescript
function useVirtualization(config: UseVirtualizationConfig): UseVirtualizationReturn;
```

### Parameters

```typescript
interface UseVirtualizationConfig extends Partial<VirtualizationConfig> {
  /** Total number of rows in the dataset */
  totalRows: number;
  /** Total number of columns (optional, for horizontal virtualization) */
  totalColumns?: number;
  /** Whether virtualization is enabled */
  enabled?: boolean;
  /** Callback when scroll position changes */
  onScroll?: (scrollInfo: ScrollInfo) => void;
  /** Callback when visible range changes */
  onViewportChange?: (startIndex: number, endIndex: number) => void;
  /** Callback when a row is measured */
  onRowMeasured?: (rowIndex: number, height: number) => void;
}
```

### Returns

```typescript
interface UseVirtualizationReturn {
  /** Current virtualization state */
  state: VirtualizationState;
  /** Virtual rows to render */
  virtualRows: VirtualRowItem[];
  /** Virtual columns to render */
  virtualColumns: VirtualColumnItem[];
  /** Performance metrics */
  metrics: VirtualizationMetrics;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Ref to attach to the content wrapper */
  contentRef: React.RefObject<HTMLDivElement>;
  /** Current scroll information */
  scrollInfo: ScrollInfo;
  /** Methods for programmatic control */
  actions: {
    updateScroll: (scrollInfo: Partial<ScrollInfo>) => void;
    scrollTo: (options: ScrollToOptions) => void;
    measureRow: (rowIndex: number, height: number) => void;
    updateItemCounts: (totalRows: number, totalColumns?: number) => void;
    reset: () => void;
    setEnabled: (enabled: boolean) => void;
    updateConfig: (config: Partial<VirtualizationConfig>) => void;
    observeElement: (element: HTMLElement, rowIndex: number) => void;
    unobserveElement: (element: HTMLElement) => void;
  };
  /** Styling properties */
  styles: {
    container: React.CSSProperties;
    content: React.CSSProperties;
    getRowStyle: (virtualRow: VirtualRowItem) => React.CSSProperties;
    getColumnStyle: (virtualColumn: VirtualColumnItem) => React.CSSProperties;
  };
  /** Utility functions */
  utils: {
    isRowVisible: (rowIndex: number) => boolean;
    isColumnVisible: (columnIndex: number) => boolean;
    getRowMeasurement: (rowIndex: number) => { start: number; height: number; end: number } | null;
    getTotalHeight: () => number;
    getTotalWidth: () => number;
  };
}
```

### Usage Example

```typescript
import { useVirtualization } from '@better-tables/ui';

function VirtualizedTable({ data, columns }) {
  const { virtualRows, containerRef, contentRef, styles, actions, utils } = useVirtualization({
    totalRows: data.length,
    totalColumns: columns.length,
    containerHeight: 600,
    defaultRowHeight: 52,
    overscan: 5,
    onViewportChange: (startIndex, endIndex) => {
      console.log(`Rendering rows ${startIndex} to ${endIndex}`);
    },
    onScroll: scrollInfo => {
      // Handle scroll events
    },
  });

  return (
    <div ref={containerRef} style={styles.container} className="overflow-auto">
      <div ref={contentRef} style={styles.content}>
        {virtualRows.map(virtualRow => {
          const item = data[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={styles.getRowStyle(virtualRow)}
              className="flex items-center border-b"
            >
              {columns.map((column, colIndex) => (
                <div key={column.id} className="px-4 py-2">
                  {item[column.id]}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Advanced Virtualization

```typescript
// Dynamic row heights
function DynamicHeightTable({ data }) {
  const { actions, styles, virtualRows } = useVirtualization({
    totalRows: data.length,
    defaultRowHeight: 40,
    dynamicRowHeight: true,
    onRowMeasured: (rowIndex, height) => {
      actions.measureRow(rowIndex, height);
    },
  });

  return (
    <div ref={containerRef} style={styles.container}>
      <div ref={contentRef} style={styles.content}>
        {virtualRows.map(virtualRow => {
          const item = data[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={styles.getRowStyle(virtualRow)}
              ref={el => {
                if (el) {
                  // Measure actual height
                  const height = el.getBoundingClientRect().height;
                  actions.measureRow(virtualRow.index, height);
                }
              }}
            >
              <ComplexRowContent item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Programmatic scrolling
function ScrollableTable() {
  const { actions, utils } = useVirtualization({
    totalRows: 10000,
    onScroll: scrollInfo => {
      // Update URL with scroll position
      updateURL({ scrollTop: scrollInfo.scrollTop });
    },
  });

  const scrollToRow = (rowIndex: number) => {
    actions.scrollTo({
      rowIndex,
      behavior: 'smooth',
    });
  };

  return (
    <div>
      <Button onClick={() => scrollToRow(5000)}>Scroll to Row 5000</Button>
      {/* Table content */}
    </div>
  );
}
```

## useTableData

A hook for fetching and managing table data with proper error handling and loading states.

### Signature

```typescript
function useTableData<TData = any>({
  adapter,
  filters = [],
  pagination,
  params = {},
  enabled = true,
}: UseTableDataOptions<TData>): UseTableDataResult<TData>;
```

### Parameters

```typescript
interface UseTableDataOptions<TData = any> {
  /** Table adapter for data fetching */
  adapter: TableAdapter<TData>;
  /** Current filters */
  filters?: FilterState[];
  /** Current pagination state */
  pagination?: PaginationState;
  /** Additional fetch parameters */
  params?: Record<string, any>;
  /** Whether to fetch data automatically */
  enabled?: boolean;
}
```

### Returns

```typescript
interface UseTableDataResult<TData = any> {
  /** Table data */
  data: TData[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count of items */
  totalCount: number;
  /** Pagination information */
  paginationInfo: FetchDataResult<TData>['pagination'] | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}
```

### Usage Example

```typescript
import { useTableData } from '@better-tables/ui';

function DataTable() {
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const { data, loading, error, totalCount, refetch, clearError } = useTableData({
    adapter: myAdapter,
    filters,
    pagination,
    params: {
      sortBy: 'name',
      sortOrder: 'asc',
    },
  });

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleFiltersChange = (newFilters: FilterState[]) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  return (
    <BetterTable
      data={data}
      loading={loading}
      error={error}
      totalCount={totalCount}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      paginationState={pagination}
      onPageChange={handlePageChange}
      onRetry={refetch}
    />
  );
}
```

### Integration with React Query

```typescript
// Example with React Query integration
import { useQuery } from '@tanstack/react-query';

function useTableDataWithQuery<TData = any>({
  adapter,
  filters = [],
  pagination,
  params = {},
}: UseTableDataOptions<TData>) {
  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['table-data', adapter.meta.name, filters, pagination, params],
    queryFn: () =>
      adapter.fetchData({
        filters,
        pagination: pagination
          ? {
              page: pagination.page,
              limit: pagination.limit,
            }
          : undefined,
        ...params,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: result?.data ?? [],
    loading: isLoading,
    error: error as Error | null,
    totalCount: result?.total ?? 0,
    paginationInfo: result?.pagination ?? null,
    refetch: () => refetch(),
    clearError: () => {}, // React Query handles this
  };
}
```

## Hook Composition Patterns

### Complete Table Implementation

```typescript
function CompleteTable() {
  // Data management
  const { data, loading, error, totalCount, refetch } = useTableData({
    adapter: myAdapter,
    filters,
    pagination,
  });

  // Filter validation
  const { isValid, error: validationError } = useFilterValidation({
    filter: currentFilter,
    column: selectedColumn,
    values: filterValues,
  });

  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Keyboard navigation
  const { onKeyDown, ariaAttributes } = useKeyboardNavigation({
    enableEscapeKey: true,
    shortcuts: {
      'Ctrl+k': () => focusSearch(),
      Escape: () => clearFilters(),
    },
  });

  // Virtualization for large datasets
  const { virtualRows, containerRef, styles } = useVirtualization({
    totalRows: data.length,
    enabled: data.length > 1000,
    containerHeight: 600,
  });

  return (
    <div onKeyDown={onKeyDown} {...ariaAttributes}>
      <BetterTable
        data={data}
        loading={loading}
        error={error}
        totalCount={totalCount}
        filters={filters}
        onFiltersChange={setFilters}
        paginationState={pagination}
        onPageChange={handlePageChange}
        onRetry={refetch}
      />
    </div>
  );
}
```

### Custom Filter Component

```typescript
function CustomFilterInput({ filter, column, onChange }) {
  const [value, setValue] = useState(filter.values[0] || '');
  const debouncedValue = useDebounce(value, 500);

  const { isValid, error } = useFilterValidation({
    filter: { ...filter, values: [debouncedValue] },
    column,
    values: [debouncedValue],
  });

  const { onKeyDown, focusUtils } = useKeyboardNavigation({
    enableEscapeKey: true,
    onEscape: () => onChange([]),
    onEnter: () => {
      if (isValid) {
        onChange([debouncedValue]);
      }
    },
  });

  useEffect(() => {
    if (isValid && debouncedValue) {
      onChange([debouncedValue]);
    }
  }, [debouncedValue, isValid]);

  return (
    <div>
      <Input
        ref={focusUtils.setFocusRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        className={!isValid ? 'border-red-500' : ''}
        placeholder={`Filter by ${column.displayName}...`}
      />
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
}
```

## Performance Considerations

### Memoization

Hooks use React's built-in memoization where appropriate:

```typescript
// useFilterValidation uses useMemo for expensive calculations
const isNumericType = useMemo(
  () => column.type === 'number' || column.type === 'currency' || column.type === 'percentage',
  [column.type],
);

// useVirtualization memoizes styles and utilities
const styles = useMemo(
  () => ({
    container: { overflow: 'auto', height: '100%' },
    content: { position: 'relative', height: state.totalHeight },
  }),
  [state.totalHeight],
);
```

### Debouncing Strategy

Use appropriate debounce delays for different use cases:

```typescript
// Search input - fast response
const debouncedSearch = useDebounce(searchTerm, 150);

// Filter values - moderate delay
const debouncedFilter = useDebounce(filterValue, 300);

// Expensive operations - longer delay
const debouncedExpensiveOp = useDebounce(value, 1000);
```

### Virtualization Best Practices

```typescript
// Only enable virtualization for large datasets
const shouldVirtualize = data.length > 1000;

const { virtualRows } = useVirtualization({
  totalRows: data.length,
  enabled: shouldVirtualize,
  overscan: shouldVirtualize ? 10 : 0, // More overscan for large datasets
});
```

## Usage Examples

### Search and Filter Integration

```typescript
function SearchableTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState[]>([]);
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Convert search term to filter
  useEffect(() => {
    if (debouncedSearch) {
      const searchFilter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: [debouncedSearch],
      };

      setFilters(prev => {
        const filtered = prev.filter(f => f.columnId !== 'name');
        return [...filtered, searchFilter];
      });
    } else {
      setFilters(prev => prev.filter(f => f.columnId !== 'name'));
    }
  }, [debouncedSearch]);

  const { data, loading } = useTableData({
    adapter: myAdapter,
    filters,
  });

  return (
    <div>
      <Input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <BetterTable data={data} loading={loading} filters={filters} onFiltersChange={setFilters} />
    </div>
  );
}
```

### Real-time Data Updates

```typescript
function RealTimeTable() {
  const { data, refetch } = useTableData({
    adapter: myAdapter,
    filters,
    pagination,
  });

  // Set up real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  // Subscribe to adapter events if available
  useEffect(() => {
    if (myAdapter.subscribe) {
      const unsubscribe = myAdapter.subscribe(event => {
        if (event.type === 'data_changed') {
          refetch();
        }
      });

      return unsubscribe;
    }
  }, [myAdapter, refetch]);

  return (
    <BetterTable
      data={data}
      filters={filters}
      onFiltersChange={setFilters}
      paginationState={pagination}
      onPageChange={setPagination}
    />
  );
}
```

### Custom Virtualization Implementation

```typescript
function CustomVirtualizedTable({ data, columns }) {
  const { virtualRows, containerRef, contentRef, styles, actions, utils } = useVirtualization({
    totalRows: data.length,
    totalColumns: columns.length,
    containerHeight: 600,
    defaultRowHeight: 60,
    dynamicRowHeight: true,
    onViewportChange: (startIndex, endIndex) => {
      // Load additional data if needed
      if (endIndex >= data.length - 10) {
        loadMoreData();
      }
    },
  });

  const renderRow = (virtualRow: VirtualRowItem) => {
    const item = data[virtualRow.index];

    return (
      <div
        key={virtualRow.index}
        style={styles.getRowStyle(virtualRow)}
        className="flex items-center border-b hover:bg-muted/50"
        ref={el => {
          if (el) {
            const height = el.getBoundingClientRect().height;
            actions.measureRow(virtualRow.index, height);
          }
        }}
      >
        {columns.map((column, colIndex) => (
          <div key={column.id} className="px-4 py-2 flex-1">
            {column.cellRenderer
              ? column.cellRenderer({
                  value: item[column.id],
                  column,
                  item,
                  rowIndex: virtualRow.index,
                })
              : String(item[column.id] || '')}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="border rounded-lg">
      <div ref={containerRef} style={styles.container} className="h-[600px] overflow-auto">
        <div ref={contentRef} style={styles.content}>
          {virtualRows.map(renderRow)}
        </div>
      </div>

      <div className="p-4 border-t bg-muted/50">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Showing {utils.isRowVisible(0) ? virtualRows[0]?.index + 1 : 1} to{' '}
            {utils.isRowVisible(data.length - 1)
              ? virtualRows[virtualRows.length - 1]?.index + 1
              : data.length}{' '}
            of {data.length} rows
          </span>

          <div className="flex space-x-2">
            <Button size="sm" onClick={() => actions.scrollTo({ rowIndex: 0 })}>
              Top
            </Button>
            <Button size="sm" onClick={() => actions.scrollTo({ rowIndex: data.length - 1 })}>
              Bottom
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Related Documentation

- [Core Types API Reference](../core/TYPES_API_REFERENCE.md)
- [Core Managers API Reference](../core/MANAGERS_API_REFERENCE.md)
- [Filter Components Reference](./FILTER_COMPONENTS_REFERENCE.md)
- [Table Components Reference](./TABLE_COMPONENTS_REFERENCE.md)
- [Styling Guide](./STYLING_GUIDE.md)
