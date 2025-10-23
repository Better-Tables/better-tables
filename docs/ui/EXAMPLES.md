# @better-tables/ui - Examples & Usage Patterns

## Overview

This document provides comprehensive examples and usage patterns for the Better Tables UI package. It covers common scenarios, advanced use cases, and best practices.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Integration Examples](#integration-examples)
- [Customization Examples](#customization-examples)
- [Performance Optimization](#performance-optimization)
- [Accessibility Examples](#accessibility-examples)
- [Error Handling](#error-handling)
- [Testing Examples](#testing-examples)

## Basic Usage

### Simple Table

```tsx
import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
}

function SimpleTable() {
  const [data, setData] = useState<User[]>([]);
  
  const columns = [
    createColumnBuilder<User>()
      .text()
      .id('name')
      .displayName('Name')
      .accessor(user => user.name)
      .searchable()
      .build(),
    createColumnBuilder<User>()
      .text()
      .id('email')
      .displayName('Email')
      .accessor(user => user.email)
      .searchable()
      .build(),
    createColumnBuilder<User>()
      .number()
      .id('age')
      .displayName('Age')
      .accessor(user => user.age)
      .range(18, 100)
      .build(),
    createColumnBuilder<User>()
      .option()
      .id('status')
      .displayName('Status')
      .accessor(user => user.status)
      .options([
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ])
      .build(),
  ];
  
  return (
    <BetterTable
      id="users-table"
      name="Users"
      columns={columns}
      data={data}
      features={{
        filtering: true,
        pagination: true,
      }}
    />
  );
}
```

### Table with Filtering

```tsx
import { BetterTable, FilterBar, ActiveFilters } from '@better-tables/ui';

function FilteredTable() {
  const [data, setData] = useState<User[]>([]);
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
        columns={columns}
        data={data}
        filters={filters}
        onFiltersChange={setFilters}
        features={{
          filtering: true,
          pagination: true,
        }}
      />
    </div>
  );
}
```

### Virtualized Table for Large Datasets

```tsx
import { VirtualizedTable } from '@better-tables/ui';

function LargeDataTable() {
  const [data, setData] = useState<LargeItem[]>([]);
  
  const renderCell = (value: any, column: ColumnDefinition, item: LargeItem, rowIndex: number) => {
    if (column.id === 'status') {
      return (
        <Badge variant={value === 'active' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      );
    }
    
    if (column.id === 'actions') {
      return (
        <div className="flex gap-2">
          <Button size="sm" variant="outline">Edit</Button>
          <Button size="sm" variant="destructive">Delete</Button>
        </div>
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

## Advanced Features

### Custom Cell Renderers

```tsx
import { BetterTable } from '@better-tables/ui';

function CustomCellTable() {
  const columns = [
    createColumnBuilder<User>()
      .text()
      .id('avatar')
      .displayName('Avatar')
      .accessor(user => user.avatar)
      .render((value, user) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={value} alt={user.name} />
            <AvatarFallback>{user.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      ))
      .build(),
    createColumnBuilder<User>()
      .text()
      .id('status')
      .displayName('Status')
      .accessor(user => user.status)
      .render((value) => (
        <Badge 
          variant={value === 'active' ? 'default' : 'secondary'}
          className="capitalize"
        >
          {value}
        </Badge>
      ))
      .build(),
    createColumnBuilder<User>()
      .text()
      .id('actions')
      .displayName('Actions')
      .accessor(() => null)
      .render((_, user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>View</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))
      .build(),
  ];
  
  return (
    <BetterTable
      columns={columns}
      data={data}
      features={{
        filtering: true,
        pagination: true,
        rowSelection: true,
      }}
    />
  );
}
```

### Row Selection with Actions

```tsx
import { BetterTable } from '@better-tables/ui';

function SelectableTable() {
  const [data, setData] = useState<User[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  const handleBulkDelete = () => {
    const selectedUsers = data.filter(user => selectedRows.has(user.id));
    // Perform bulk delete operation
    console.log('Deleting users:', selectedUsers);
  };
  
  const handleBulkExport = () => {
    const selectedUsers = data.filter(user => selectedRows.has(user.id));
    // Perform bulk export operation
    console.log('Exporting users:', selectedUsers);
  };
  
  return (
    <div className="space-y-4">
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
          </span>
          <Button size="sm" variant="outline" onClick={handleBulkExport}>
            Export Selected
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            Delete Selected
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setSelectedRows(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}
      
      <BetterTable
        columns={columns}
        data={data}
        selectedRows={selectedRows}
        onRowSelectionChange={setSelectedRows}
        features={{
          filtering: true,
          pagination: true,
          rowSelection: true,
        }}
      />
    </div>
  );
}
```

### Advanced Filtering with Groups

```tsx
import { FilterBar } from '@better-tables/ui';

function GroupedFilterTable() {
  const [filters, setFilters] = useState<FilterState[]>([]);
  
  const filterGroups: FilterGroup[] = [
    {
      id: 'personal',
      label: 'Personal Information',
      columns: ['name', 'email', 'age'],
    },
    {
      id: 'status',
      label: 'Status & Permissions',
      columns: ['status', 'role', 'permissions'],
    },
    {
      id: 'dates',
      label: 'Date Information',
      columns: ['createdAt', 'lastLogin', 'updatedAt'],
    },
  ];
  
  return (
    <FilterBar
      columns={columns}
      filters={filters}
      onFiltersChange={setFilters}
      groups={filterGroups}
      showGroups={true}
      searchable={true}
      maxFilters={10}
    />
  );
}
```

## Integration Examples

### Next.js Integration

```tsx
// app/users/page.tsx
'use client';

import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';
import { useSearchParams } from 'next/navigation';

export default function UsersPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Sync filters with URL
  const [filters, setFilters] = useState<FilterState[]>(() => {
    const urlFilters = searchParams.get('filters');
    return urlFilters ? JSON.parse(urlFilters) : [];
  });
  
  useEffect(() => {
    const url = new URLSearchParams();
    if (filters.length > 0) {
      url.set('filters', JSON.stringify(filters));
    }
    window.history.replaceState({}, '', `?${url.toString()}`);
  }, [filters]);
  
  const columns = [
    createColumnBuilder<User>()
      .text()
      .id('name')
      .displayName('Name')
      .accessor(user => user.name)
      .searchable()
      .build(),
    // ... more columns
  ];
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Users</h1>
      
      <BetterTable
        id="users-table"
        name="Users"
        columns={columns}
        data={data}
        loading={loading}
        filters={filters}
        onFiltersChange={setFilters}
        features={{
          filtering: true,
          pagination: true,
          rowSelection: true,
        }}
      />
    </div>
  );
}
```

### React Query Integration

```tsx
import { useQuery } from '@tanstack/react-query';
import { BetterTable } from '@better-tables/ui';

function QueryTable() {
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', filters, pagination],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add filters to query params
      filters.forEach(filter => {
        params.append(`filter_${filter.columnId}`, JSON.stringify(filter));
      });
      
      // Add pagination
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      
      const response = await fetch(`/api/users?${params.toString()}`);
      return response.json();
    },
  });
  
  return (
    <BetterTable
      columns={columns}
      data={data?.items || []}
      loading={isLoading}
      error={error}
      filters={filters}
      onFiltersChange={setFilters}
      paginationState={pagination}
      onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
      features={{
        filtering: true,
        pagination: true,
      }}
    />
  );
}
```

### Zustand State Management

```tsx
// stores/tableStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface TableState {
  data: User[];
  filters: FilterState[];
  pagination: PaginationState;
  selectedRows: Set<string>;
  loading: boolean;
  error: Error | null;
  
  // Actions
  setData: (data: User[]) => void;
  setFilters: (filters: FilterState[]) => void;
  setPagination: (pagination: PaginationState) => void;
  setSelectedRows: (selected: Set<string>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useTableStore = create<TableState>()(
  devtools(
    (set) => ({
      data: [],
      filters: [],
      pagination: {
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
      selectedRows: new Set(),
      loading: false,
      error: null,
      
      setData: (data) => set({ data }),
      setFilters: (filters) => set({ filters }),
      setPagination: (pagination) => set({ pagination }),
      setSelectedRows: (selectedRows) => set({ selectedRows }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    { name: 'table-store' }
  )
);

// components/TableWithStore.tsx
function TableWithStore() {
  const {
    data,
    filters,
    pagination,
    selectedRows,
    loading,
    error,
    setFilters,
    setPagination,
    setSelectedRows,
  } = useTableStore();
  
  return (
    <BetterTable
      columns={columns}
      data={data}
      loading={loading}
      error={error}
      filters={filters}
      onFiltersChange={setFilters}
      paginationState={pagination}
      onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
      selectedRows={selectedRows}
      onRowSelectionChange={setSelectedRows}
      features={{
        filtering: true,
        pagination: true,
        rowSelection: true,
      }}
    />
  );
}
```

## Customization Examples

### Custom Theme

```tsx
import { BetterTable } from '@better-tables/ui';

function CustomThemedTable() {
  return (
    <BetterTable
      columns={columns}
      data={data}
      className="border-2 border-primary rounded-xl shadow-lg"
      theme={{
        container: 'bg-gradient-to-br from-background to-muted',
        header: 'bg-primary text-primary-foreground font-bold',
        row: 'hover:bg-primary/10 transition-colors',
        cell: 'px-6 py-4',
        button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
        input: 'border-primary focus:ring-primary',
      }}
    />
  );
}
```

### Custom Filter Components

```tsx
import { FilterBar } from '@better-tables/ui';

function CustomFilterTable() {
  const [filters, setFilters] = useState<FilterState[]>([]);
  
  const customFilters = [
    <div key="custom-filter" className="flex items-center gap-2">
      <Label>Custom Filter:</Label>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ];
  
  return (
    <FilterBar
      columns={columns}
      filters={filters}
      onFiltersChange={setFilters}
      customFilters={customFilters}
      searchable={true}
    />
  );
}
```

### Responsive Design

```tsx
import { BetterTable } from '@better-tables/ui';
import { useMediaQuery } from '@/hooks/use-media-query';

function ResponsiveTable() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const mobileColumns = columns.filter(col => 
    ['name', 'status', 'actions'].includes(col.id)
  );
  
  const tabletColumns = columns.filter(col => 
    !['description', 'tags'].includes(col.id)
  );
  
  const displayColumns = isMobile ? mobileColumns : 
                        isTablet ? tabletColumns : 
                        columns;
  
  return (
    <BetterTable
      columns={displayColumns}
      data={data}
      className={cn(
        "w-full",
        isMobile && "overflow-x-auto",
        !isMobile && "table-fixed"
      )}
      features={{
        filtering: !isMobile,
        pagination: true,
        rowSelection: !isMobile,
      }}
    />
  );
}
```

## Performance Optimization

### Memoized Components

```tsx
import { memo, useMemo } from 'react';
import { BetterTable } from '@better-tables/ui';

const MemoizedTable = memo(BetterTable);

function OptimizedTable() {
  const [data, setData] = useState<User[]>([]);
  const [filters, setFilters] = useState<FilterState[]>([]);
  
  const memoizedColumns = useMemo(() => columns, []);
  
  const memoizedData = useMemo(() => data, [data]);
  
  const memoizedFilters = useMemo(() => filters, [filters]);
  
  return (
    <MemoizedTable
      columns={memoizedColumns}
      data={memoizedData}
      filters={memoizedFilters}
      onFiltersChange={setFilters}
      features={{
        filtering: true,
        pagination: true,
      }}
    />
  );
}
```

### Virtual Scrolling for Large Datasets

```tsx
import { VirtualizedTable } from '@better-tables/ui';

function LargeDatasetTable() {
  const [data, setData] = useState<LargeItem[]>([]);
  
  const renderRow = useCallback((item: LargeItem, index: number, style: React.CSSProperties) => {
    return (
      <div key={item.id} style={style} className="flex items-center p-4 border-b">
        <div className="flex-1">{item.name}</div>
        <div className="flex-1">{item.email}</div>
        <div className="flex-1">{item.status}</div>
        <div className="w-32">
          <Button size="sm" variant="outline">Actions</Button>
        </div>
      </div>
    );
  }, []);
  
  return (
    <VirtualizedTable
      data={data}
      columns={columns}
      height={600}
      rowHeight={60}
      renderRow={renderRow}
      virtualization={{
        overscan: 10,
        smoothScrolling: true,
        dynamicRowHeight: false,
      }}
    />
  );
}
```

## Accessibility Examples

### Accessible Table

```tsx
import { BetterTable } from '@better-tables/ui';

function AccessibleTable() {
  return (
    <BetterTable
      columns={columns}
      data={data}
      className="w-full"
      features={{
        filtering: true,
        pagination: true,
        rowSelection: true,
      }}
      // ARIA attributes are automatically added
      aria-label="Users table with filtering and pagination"
      aria-describedby="table-description"
    />
  );
}
```

### Keyboard Navigation

```tsx
import { useKeyboardNavigation } from '@better-tables/ui';

function KeyboardNavigableTable() {
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  
  const { handleKeyDown } = useKeyboardNavigation({
    onRowFocus: setFocusedRow,
    onRowSelect: (index) => {
      // Handle row selection
    },
    onRowActivate: (index) => {
      // Handle row activation (e.g., open details)
    },
  });
  
  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <BetterTable
        columns={columns}
        data={data}
        features={{
          filtering: true,
          pagination: true,
          rowSelection: true,
        }}
      />
    </div>
  );
}
```

## Error Handling

### Error Boundaries

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { BetterTable } from '@better-tables/ui';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

function TableWithErrorBoundary() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Table error:', error, errorInfo);
      }}
    >
      <BetterTable
        columns={columns}
        data={data}
        error={error}
        onRetry={() => {
          // Retry logic
        }}
      />
    </ErrorBoundary>
  );
}
```

### Loading States

```tsx
import { BetterTable, LoadingSpinner } from '@better-tables/ui';

function TableWithLoading() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<User[]>([]);
  
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const newData = await fetchUsers();
      setData(newData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return (
    <BetterTable
      columns={columns}
      data={data}
      loading={loading}
      onRetry={handleRefresh}
      features={{
        filtering: true,
        pagination: true,
      }}
    />
  );
}
```

## Testing Examples

### Component Testing

```tsx
// __tests__/BetterTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BetterTable } from '@better-tables/ui';

describe('BetterTable', () => {
  const mockData = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ];
  
  const mockColumns = [
    createColumnBuilder<User>()
      .text()
      .id('name')
      .displayName('Name')
      .accessor(user => user.name)
      .build(),
    createColumnBuilder<User>()
      .text()
      .id('email')
      .displayName('Email')
      .accessor(user => user.email)
      .build(),
  ];
  
  it('renders table with data', () => {
    render(
      <BetterTable
        columns={mockColumns}
        data={mockData}
        features={{ filtering: true, pagination: true }}
      />
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });
  
  it('handles row selection', () => {
    const onRowSelectionChange = jest.fn();
    
    render(
      <BetterTable
        columns={mockColumns}
        data={mockData}
        onRowSelectionChange={onRowSelectionChange}
        features={{ rowSelection: true }}
      />
    );
    
    const checkbox = screen.getByRole('checkbox', { name: /select row/i });
    fireEvent.click(checkbox);
    
    expect(onRowSelectionChange).toHaveBeenCalledWith(new Set(['1']));
  });
});
```

### Hook Testing

```tsx
// __tests__/useTableData.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useTableData } from '@better-tables/ui';

describe('useTableData', () => {
  it('fetches data successfully', async () => {
    const mockAdapter = {
      fetchData: jest.fn().mockResolvedValue({
        data: [{ id: '1', name: 'John' }],
        totalCount: 1,
      }),
    };
    
    const { result } = renderHook(() =>
      useTableData({
        adapter: mockAdapter,
        filters: [],
        pagination: { page: 1, limit: 20 },
      })
    );
    
    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: '1', name: 'John' }]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
```

## Related Documentation

- [Component Reference](./COMPONENT_REFERENCE.md)
- [Styling Guide](./STYLING_GUIDE.md)
- [Hooks Reference](./HOOKS_REFERENCE.md)
- [Filter Components Reference](./FILTER_COMPONENTS_REFERENCE.md)
- [Table Components Reference](./TABLE_COMPONENTS_REFERENCE.md)
- [Getting Started Guide](../GETTING_STARTED.md)
