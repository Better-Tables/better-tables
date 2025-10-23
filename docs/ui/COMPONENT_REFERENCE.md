# @better-tables/ui - Component Reference

## Overview

This document provides a comprehensive reference for all UI components in the Better Tables package. Each component includes props, examples, and usage patterns.

## Table of Contents

- [Filter Components](#filter-components)
- [Table Components](#table-components)
- [Utility Components](#utility-components)
- [Component Props](#component-props)
- [Usage Examples](#usage-examples)

## Filter Components

### FilterBar

Main container component for table filtering functionality.

#### Props

```typescript
interface FilterBarProps<TData = any> {
  /** Column definitions */
  columns: ColumnDefinition<TData>[];
  /** Current filter states */
  filters: FilterState[];
  /** Callback when filters change */
  onFiltersChange: (filters: FilterState[]) => void;
  /** Optional filter groups */
  groups?: FilterGroup[];
  /** Theme configuration */
  theme?: FilterBarTheme;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Maximum number of filters allowed */
  maxFilters?: number;
  /** Whether to show add filter button */
  showAddFilter?: boolean;
  /** Whether to show clear all button */
  showClearAll?: boolean;
  /** Whether to show filter groups */
  showGroups?: boolean;
  /** Whether to enable search functionality */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom filter components */
  customFilters?: React.ReactNode[];
  /** Custom add filter button label */
  addFilterLabel?: string;
  /** Function to determine if filter is protected */
  isFilterProtected?: (filter: FilterState) => boolean;
}
```

#### Example

```tsx
import { FilterBar } from '@better-tables/ui';

function MyTable() {
  const [filters, setFilters] = useState<FilterState[]>([]);
  
  return (
    <FilterBar
      columns={columns}
      filters={filters}
      onFiltersChange={setFilters}
      searchable={true}
      maxFilters={5}
      className="mb-4"
    />
  );
}
```

### ActiveFilters

Displays currently active filters as interactive badges.

#### Props

```typescript
interface ActiveFiltersProps<TData = any> {
  /** Column definitions */
  columns: ColumnDefinition<TData>[];
  /** Current filter states */
  filters: FilterState[];
  /** Callback when filter is updated */
  onUpdateFilter: (columnId: string, updates: Partial<FilterState>) => void;
  /** Callback when filter is removed */
  onRemoveFilter: (columnId: string) => void;
  /** Function to determine if filter is protected */
  isFilterProtected?: (filter: FilterState) => boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}
```

#### Example

```tsx
import { ActiveFilters } from '@better-tables/ui';

function MyTable() {
  const [filters, setFilters] = useState<FilterState[]>([]);
  
  const handleUpdateFilter = (columnId: string, updates: Partial<FilterState>) => {
    setFilters(prev => prev.map(f => 
      f.columnId === columnId ? { ...f, ...updates } : f
    ));
  };
  
  const handleRemoveFilter = (columnId: string) => {
    setFilters(prev => prev.filter(f => f.columnId !== columnId));
  };
  
  return (
    <ActiveFilters
      columns={columns}
      filters={filters}
      onUpdateFilter={handleUpdateFilter}
      onRemoveFilter={handleRemoveFilter}
    />
  );
}
```

### FilterDropdown

Dropdown component for selecting columns to filter.

#### Props

```typescript
interface FilterDropdownProps<TData = any> {
  /** Column definitions */
  columns: ColumnDefinition<TData>[];
  /** Optional filter groups */
  groups?: FilterGroup[];
  /** Callback when column is selected */
  onSelect: (columnId: string) => void;
  /** Whether dropdown is open */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Trigger element */
  children: React.ReactNode;
  /** Whether to enable search */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Current search term */
  searchTerm?: string;
  /** Callback when search term changes */
  onSearchChange?: (search: string) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Message when no columns available */
  emptyMessage?: string;
}
```

#### Example

```tsx
import { FilterDropdown } from '@better-tables/ui';

function MyFilterButton() {
  const [open, setOpen] = useState(false);
  
  return (
    <FilterDropdown
      columns={columns}
      onSelect={(columnId) => {
        console.log('Selected column:', columnId);
        setOpen(false);
      }}
      open={open}
      onOpenChange={setOpen}
      searchable={true}
    >
      <Button>Add Filter</Button>
    </FilterDropdown>
  );
}
```

## Filter Input Components

### TextFilterInput

Input component for text-based filters.

#### Props

```typescript
interface TextFilterInputProps<TData = any> {
  /** Current filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Callback when values change */
  onChange: (values: any[]) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}
```

#### Example

```tsx
import { TextFilterInput } from '@better-tables/ui';

function MyTextFilter() {
  const [filter, setFilter] = useState<FilterState>({
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: [''],
  });
  
  return (
    <TextFilterInput
      filter={filter}
      column={nameColumn}
      onChange={(values) => setFilter(prev => ({ ...prev, values }))}
    />
  );
}
```

### NumberFilterInput

Input component for number-based filters.

#### Props

```typescript
interface NumberFilterInputProps<TData = any> {
  /** Current filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Callback when values change */
  onChange: (values: any[]) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}
```

#### Example

```tsx
import { NumberFilterInput } from '@better-tables/ui';

function MyNumberFilter() {
  const [filter, setFilter] = useState<FilterState>({
    columnId: 'age',
    type: 'number',
    operator: 'gte',
    values: [25],
  });
  
  return (
    <NumberFilterInput
      filter={filter}
      column={ageColumn}
      onChange={(values) => setFilter(prev => ({ ...prev, values }))}
    />
  );
}
```

### DateFilterInput

Input component for date-based filters.

#### Props

```typescript
interface DateFilterInputProps<TData = any> {
  /** Current filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Callback when values change */
  onChange: (values: any[]) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}
```

#### Example

```tsx
import { DateFilterInput } from '@better-tables/ui';

function MyDateFilter() {
  const [filter, setFilter] = useState<FilterState>({
    columnId: 'createdAt',
    type: 'date',
    operator: 'after',
    values: [new Date()],
  });
  
  return (
    <DateFilterInput
      filter={filter}
      column={dateColumn}
      onChange={(values) => setFilter(prev => ({ ...prev, values }))}
    />
  );
}
```

## Table Components

### BetterTable

Full-featured table component with filtering, pagination, and state management.

#### Props

```typescript
interface BetterTableProps<TData = any> extends TableConfig<TData> {
  /** Table data */
  data: TData[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: Error | null;
  /** Total count of items */
  totalCount?: number;
  /** Current filters */
  filters?: FilterState[];
  /** Callback when filters change */
  onFiltersChange?: (filters: FilterState[]) => void;
  /** Current pagination state */
  paginationState?: PaginationState;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Currently selected rows */
  selectedRows?: Set<string>;
  /** Callback when row selection changes */
  onRowSelectionChange?: (selected: Set<string>) => void;
  /** Additional CSS classes */
  className?: string;
  /** Callback when row is clicked */
  onRowClick?: (row: TData) => void;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Callback for retry action */
  onRetry?: () => void;
}
```

#### Example

```tsx
import { BetterTable } from '@better-tables/ui';

function MyTable() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  
  return (
    <BetterTable
      id="users-table"
      name="Users"
      columns={columns}
      data={data}
      loading={loading}
      filters={filters}
      onFiltersChange={setFilters}
      paginationState={pagination}
      onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
      features={{
        filtering: true,
        pagination: true,
        rowSelection: true,
      }}
      adapter={myAdapter}
    />
  );
}
```

### VirtualizedTable

High-performance table component for large datasets with virtual scrolling.

#### Props

```typescript
interface VirtualizedTableProps<T = any> {
  /** Table data */
  data: T[];
  /** Column definitions */
  columns: ColumnDefinition<T>[];
  /** Virtualization configuration */
  virtualization?: Partial<UseVirtualizationConfig>;
  /** Custom row renderer */
  renderRow?: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  /** Custom cell renderer */
  renderCell?: (value: any, column: ColumnDefinition<T>, item: T, rowIndex: number) => React.ReactNode;
  /** Row height in pixels */
  rowHeight?: number;
  /** Whether to use dynamic row heights */
  dynamicRowHeight?: boolean;
  /** Container height */
  height?: number | string;
  /** Container width */
  width?: number | string;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Custom empty state */
  emptyState?: React.ReactNode;
  /** Callback when row is clicked */
  onRowClick?: (item: T, index: number) => void;
  /** Callback when scroll position changes */
  onScroll?: (scrollInfo: any) => void;
  /** Callback when viewport changes */
  onViewportChange?: (startIndex: number, endIndex: number) => void;
  /** ARIA label */
  'aria-label'?: string;
  /** ARIA described by */
  'aria-describedby'?: string;
}
```

#### Example

```tsx
import { VirtualizedTable } from '@better-tables/ui';

function MyVirtualizedTable() {
  const [data, setData] = useState<LargeItem[]>([]);
  
  const renderCell = (value: any, column: ColumnDefinition, item: LargeItem, rowIndex: number) => {
    if (column.id === 'status') {
      return (
        <Badge variant={value === 'active' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      );
    }
    return String(value || '');
  };
  
  return (
    <VirtualizedTable
      data={data}
      columns={columns}
      height={600}
      rowHeight={52}
      renderCell={renderCell}
      virtualization={{
        overscan: 5,
        smoothScrolling: true,
      }}
      onRowClick={(item, index) => {
        console.log('Clicked item:', item, 'at index:', index);
      }}
    />
  );
}
```

## Utility Components

### LoadingSpinner

Loading indicator component.

#### Props

```typescript
interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}
```

#### Example

```tsx
import { LoadingSpinner } from '@better-tables/ui';

function MyLoadingState() {
  return (
    <div className="flex items-center justify-center p-8">
      <LoadingSpinner size="lg" />
    </div>
  );
}
```

### EmptyState

Empty state component for when no data is available.

#### Props

```typescript
interface EmptyStateProps {
  /** Empty state title */
  title?: string;
  /** Empty state description */
  description?: string;
  /** Empty state icon */
  icon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}
```

#### Example

```tsx
import { EmptyState } from '@better-tables/ui';

function MyEmptyState() {
  return (
    <EmptyState
      title="No data available"
      description="Try adjusting your filters or add new data."
      icon={<DatabaseIcon className="h-12 w-12" />}
    />
  );
}
```

### ErrorState

Error state component for displaying errors.

#### Props

```typescript
interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error description */
  description?: string;
  /** Error icon */
  icon?: React.ReactNode;
  /** Retry button text */
  retryText?: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}
```

#### Example

```tsx
import { ErrorState } from '@better-tables/ui';

function MyErrorState() {
  return (
    <ErrorState
      title="Failed to load data"
      description="Something went wrong while loading the data."
      retryText="Try again"
      onRetry={() => window.location.reload()}
    />
  );
}
```

## Component Props

### Common Props

All components share these common props:

```typescript
interface CommonProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Theme configuration */
  theme?: Record<string, string>;
}
```

### Theme Props

Components accept theme configuration:

```typescript
interface ThemeProps {
  theme?: {
    container?: string;
    header?: string;
    body?: string;
    footer?: string;
    row?: string;
    cell?: string;
    button?: string;
    input?: string;
    error?: string;
    success?: string;
    warning?: string;
    info?: string;
  };
}
```

## Usage Examples

### Complete Table Implementation

```tsx
import { BetterTable, FilterBar, ActiveFilters } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';

function CompleteTable() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  
  const columns = [
    createColumnBuilder<User>()
      .text()
      .id('name')
      .displayName('Name')
      .accessor(user => user.name)
      .searchable()
      .build(),
    createColumnBuilder<User>()
      .number()
      .id('age')
      .displayName('Age')
      .accessor(user => user.age)
      .range(18, 100)
      .build(),
  ];
  
  const handleUpdateFilter = (columnId: string, updates: Partial<FilterState>) => {
    setFilters(prev => prev.map(f => 
      f.columnId === columnId ? { ...f, ...updates } : f
    ));
  };
  
  const handleRemoveFilter = (columnId: string) => {
    setFilters(prev => prev.filter(f => f.columnId !== columnId));
  };
  
  return (
    <div className="space-y-4">
      <FilterBar
        columns={columns}
        filters={filters}
        onFiltersChange={setFilters}
        searchable={true}
        maxFilters={5}
      />
      
      {filters.length > 0 && (
        <ActiveFilters
          columns={columns}
          filters={filters}
          onUpdateFilter={handleUpdateFilter}
          onRemoveFilter={handleRemoveFilter}
        />
      )}
      
      <BetterTable
        id="users-table"
        name="Users"
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        filters={filters}
        onFiltersChange={setFilters}
        paginationState={pagination}
        onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
        features={{
          filtering: true,
          pagination: true,
          rowSelection: true,
        }}
        adapter={myAdapter}
      />
    </div>
  );
}
```

### Custom Styling Example

```tsx
import { BetterTable } from '@better-tables/ui';

function CustomStyledTable() {
  return (
    <BetterTable
      data={data}
      columns={columns}
      className="border-2 border-primary rounded-xl shadow-lg"
      theme={{
        container: 'bg-gradient-to-br from-background to-muted',
        header: 'bg-primary text-primary-foreground font-bold',
        row: 'hover:bg-primary/10 transition-colors',
        cell: 'px-6 py-4',
      }}
    />
  );
}
```

### Responsive Table Example

```tsx
import { BetterTable } from '@better-tables/ui';

function ResponsiveTable() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return (
    <BetterTable
      data={data}
      columns={columns}
      className={cn(
        "w-full",
        isMobile && "overflow-x-auto",
        !isMobile && "table-fixed"
      )}
      features={{
        filtering: true,
        pagination: true,
        rowSelection: !isMobile, // Disable on mobile
      }}
    />
  );
}
```

## Related Documentation

- [Styling Guide](./STYLING_GUIDE.md)
- [Hooks Reference](./HOOKS_REFERENCE.md)
- [Filter Components Reference](./FILTER_COMPONENTS_REFERENCE.md)
- [Table Components Reference](./TABLE_COMPONENTS_REFERENCE.md)
- [Getting Started Guide](../GETTING_STARTED.md)
