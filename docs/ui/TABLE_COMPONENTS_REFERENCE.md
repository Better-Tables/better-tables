# @better-tables/ui - Table Components Reference

## Overview

The Better Tables UI package provides high-performance table components for displaying and interacting with data. The table components are built on top of the core package and provide a complete solution for data visualization with advanced features like virtualization, filtering, sorting, and pagination.

## Table of Contents

- [Table Components Overview](#table-components-overview)
- [BetterTable](#bettertable)
- [VirtualizedTable](#virtualizedtable)
- [Table States](#table-states)
- [Styling and Theming](#styling-and-theming)
- [Performance Optimization](#performance-optimization)
- [Accessibility](#accessibility)
- [Usage Examples](#usage-examples)

## Table Components Overview

The table system consists of two main components:

- **BetterTable**: Full-featured table with filtering, pagination, and state management
- **VirtualizedTable**: High-performance table for large datasets with virtual scrolling

### Component Features

Both components provide:

- **Type Safety**: Full TypeScript support with generic data types
- **Responsive Design**: Mobile-optimized layouts and interactions
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support
- **Customization**: Extensive theming and styling options
- **Performance**: Optimized rendering and state management

## BetterTable

The main table component that provides a complete data table solution with filtering, pagination, and state management.

### Props

```typescript
interface BetterTableProps<TData = any> extends TableConfig<TData> {
  // Data props
  data: TData[];
  loading?: boolean;
  error?: Error | null;
  totalCount?: number;
  
  // State props
  filters?: FilterState[];
  onFiltersChange?: (filters: FilterState[]) => void;
  paginationState?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  selectedRows?: Set<string>;
  onRowSelectionChange?: (selected: Set<string>) => void;
  
  // UI props
  className?: string;
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
  onRetry?: () => void;
}
```

### Features

- **Complete Table Solution**: Includes filtering, pagination, and row selection
- **State Management**: Integrates with core managers for state handling
- **Loading States**: Built-in loading, error, and empty state handling
- **Row Selection**: Single and multiple row selection support
- **Custom Rendering**: Support for custom cell and row renderers
- **Responsive Design**: Mobile-optimized layout and interactions

### Usage Example

```typescript
import { BetterTable } from '@better-tables/ui';
import { FilterManager, PaginationManager } from '@better-tables/core';

function MyTable() {
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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  const columns = [
    cb.text()
      .id('name')
      .displayName('Name')
      .accessor(user => user.name)
      .searchable()
      .build(),
    cb.number()
      .id('age')
      .displayName('Age')
      .accessor(user => user.age)
      .range(18, 100)
      .build(),
  ];
  
  return (
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
      onPageSizeChange={(limit) => setPagination(prev => ({ ...prev, limit, page: 1 }))}
      selectedRows={selectedRows}
      onRowSelectionChange={setSelectedRows}
      features={{
        filtering: true,
        pagination: true,
        rowSelection: true,
      }}
      onRowClick={(user) => console.log('Clicked user:', user)}
    />
  );
}
```

### State Management Integration

BetterTable integrates with core managers for state management:

```typescript
import { FilterManager, PaginationManager, SelectionManager } from '@better-tables/core';

function TableWithManagers() {
  const filterManager = new FilterManager(columns);
  const paginationManager = new PaginationManager({ defaultPageSize: 20 });
  const selectionManager = new SelectionManager({ mode: 'multiple' }, data);
  
  // Subscribe to manager changes
  useEffect(() => {
    const unsubscribe = filterManager.subscribe((event) => {
      // Handle filter changes
      console.log('Filter event:', event);
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <BetterTable
      columns={columns}
      data={data}
      filters={filterManager.getFilters()}
      onFiltersChange={(filters) => filterManager.setFilters(filters)}
      paginationState={paginationManager.getPagination()}
      onPageChange={(page) => paginationManager.goToPage(page)}
      selectedRows={selectionManager.getSelectedIds()}
      onRowSelectionChange={(selected) => {
        // Update selection manager
        selected.forEach(id => selectionManager.selectRow(id));
      }}
    />
  );
}
```

## VirtualizedTable

High-performance table component for large datasets using virtual scrolling.

### Props

```typescript
interface VirtualizedTableProps<T = any> {
  data: T[];
  columns: ColumnDefinition<T>[];
  virtualization?: Partial<UseVirtualizationConfig>;
  renderRow?: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  renderCell?: (value: any, column: ColumnDefinition<T>, item: T, rowIndex: number) => React.ReactNode;
  rowHeight?: number;
  dynamicRowHeight?: boolean;
  height?: number | string;
  width?: number | string;
  className?: string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (item: T, index: number) => void;
  onScroll?: (scrollInfo: any) => void;
  onViewportChange?: (startIndex: number, endIndex: number) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
}
```

### Features

- **Virtual Scrolling**: Only renders visible rows for optimal performance
- **Dynamic Row Heights**: Support for variable row heights
- **Smooth Scrolling**: Optimized scroll behavior with overscan
- **Memory Efficient**: Minimal DOM nodes for large datasets
- **Custom Renderers**: Support for custom row and cell renderers
- **Performance Metrics**: Built-in performance monitoring

### Usage Example

```typescript
import { VirtualizedTable } from '@better-tables/ui';

function LargeDataTable() {
  const [data, setData] = useState<LargeItem[]>([]);
  
  const columns = [
    cb.text()
      .id('id')
      .displayName('ID')
      .accessor(item => item.id)
      .width(100)
      .build(),
    cb.text()
      .id('name')
      .displayName('Name')
      .accessor(item => item.name)
      .width(200)
      .build(),
    cb.text()
      .id('description')
      .displayName('Description')
      .accessor(item => item.description)
      .width(300)
      .build(),
  ];
  
  return (
    <VirtualizedTable
      data={data}
      columns={columns}
      height={600}
      rowHeight={52}
      dynamicRowHeight={false}
      virtualization={{
        overscan: 5,
        smoothScrolling: true,
      }}
      onRowClick={(item, index) => {
        console.log('Clicked row:', item, 'at index:', index);
      }}
      onViewportChange={(startIndex, endIndex) => {
        console.log('Viewport:', startIndex, 'to', endIndex);
      }}
      renderCell={(value, column, item, rowIndex) => {
        if (column.id === 'status') {
          return (
            <Badge variant={value === 'active' ? 'default' : 'secondary'}>
              {value}
            </Badge>
          );
        }
        return String(value || '');
      }}
    />
  );
}
```

### Virtualization Configuration

```typescript
interface UseVirtualizationConfig {
  containerHeight: number;
  defaultRowHeight: number;
  overscan?: number;
  smoothScrolling?: boolean;
  scrollBehavior?: 'auto' | 'smooth';
  dynamicRowHeight?: boolean;
  getRowHeight?: (index: number) => number;
  minRowHeight?: number;
  maxRowHeight?: number;
  horizontalVirtualization?: boolean;
  defaultColumnWidth?: number;
  containerWidth?: number;
}
```

### Performance Optimization

VirtualizedTable includes several performance optimizations:

```typescript
// Custom row renderer for complex content
const renderRow = (item: ComplexItem, index: number, style: React.CSSProperties) => {
  return (
    <TableRow style={style} className="hover:bg-muted/50">
      <TableCell>{item.id}</TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Avatar src={item.avatar} />
          <span>{item.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
          {item.status}
        </Badge>
      </TableCell>
    </TableRow>
  );
};

// Custom cell renderer for specific columns
const renderCell = (value: any, column: ColumnDefinition, item: ComplexItem, rowIndex: number) => {
  switch (column.id) {
    case 'avatar':
      return <Avatar src={value} size="sm" />;
    case 'status':
      return (
        <Badge variant={value === 'active' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      );
    case 'actions':
      return (
        <div className="flex space-x-1">
          <Button size="sm" variant="ghost">Edit</Button>
          <Button size="sm" variant="ghost">Delete</Button>
        </div>
      );
    default:
      return String(value || '');
  }
};
```

## Table States

### Loading State

Both components support loading states with skeleton placeholders:

```typescript
<BetterTable
  data={data}
  loading={isLoading}
  loadingState={{
    message: 'Loading users...',
    component: <CustomLoadingSpinner />,
  }}
/>
```

### Error State

Error handling with retry functionality:

```typescript
<BetterTable
  data={data}
  error={error}
  errorState={{
    title: 'Failed to load data',
    component: <CustomErrorComponent />,
    onRetry: () => refetchData(),
  }}
  onRetry={() => {
    setError(null);
    refetchData();
  }}
/>
```

### Empty State

Customizable empty state when no data is available:

```typescript
<BetterTable
  data={[]}
  emptyState={{
    title: 'No users found',
    description: 'Try adjusting your filters or add a new user.',
    icon: <UsersIcon className="h-12 w-12" />,
    component: <CustomEmptyState />,
  }}
  emptyMessage="No data available"
/>
```

## Styling and Theming

### CSS Classes

Components use consistent CSS class naming:

```css
/* BetterTable */
.better-table-container { }
.better-table-header { }
.better-table-body { }
.better-table-row { }
.better-table-cell { }

/* VirtualizedTable */
.virtualized-table-container { }
.virtualized-table-viewport { }
.virtualized-table-row { }
.virtualized-table-cell { }

/* States */
.table-loading-skeleton { }
.table-error-state { }
.table-empty-state { }
```

### Theme Customization

Components support theme customization through CSS custom properties:

```css
:root {
  --table-border: hsl(var(--border));
  --table-background: hsl(var(--background));
  --table-foreground: hsl(var(--foreground));
  --table-muted: hsl(var(--muted));
  --table-muted-foreground: hsl(var(--muted-foreground));
  --table-primary: hsl(var(--primary));
  --table-primary-foreground: hsl(var(--primary-foreground));
}
```

### Responsive Design

Components are fully responsive with mobile-first design:

```typescript
// Mobile-optimized table
<BetterTable
  className="
    block sm:table
    w-full
    overflow-x-auto
    sm:overflow-x-visible
  "
  features={{
    filtering: true,
    pagination: true,
    rowSelection: false, // Disable on mobile
  }}
/>
```

## Performance Optimization

### Memoization

Components use React.memo and useMemo for optimal performance:

```typescript
// Memoized cell renderer
const MemoizedCellRenderer = React.memo(({ value, column, item, rowIndex }) => {
  return (
    <TableCell>
      {column.cellRenderer ? 
        column.cellRenderer({ value, column, item, rowIndex }) : 
        String(value || '')
      }
    </TableCell>
  );
});

// Memoized row renderer
const MemoizedRowRenderer = React.memo(({ item, index, columns }) => {
  return (
    <TableRow>
      {columns.map(column => (
        <MemoizedCellRenderer
          key={column.id}
          value={item[column.id]}
          column={column}
          item={item}
          rowIndex={index}
        />
      ))}
    </TableRow>
  );
});
```

### Virtual Scrolling Performance

VirtualizedTable optimizes performance through:

- **Overscan**: Renders extra rows outside viewport for smooth scrolling
- **Dynamic Heights**: Measures and caches row heights
- **Scroll Throttling**: Throttles scroll events for better performance
- **Memory Management**: Cleans up unused DOM nodes

```typescript
// Performance monitoring
const virtualizationConfig = {
  containerHeight: 600,
  defaultRowHeight: 52,
  overscan: 5, // Render 5 extra rows
  smoothScrolling: true,
  dynamicRowHeight: true,
  onPerformanceUpdate: (metrics) => {
    console.log('Performance metrics:', metrics);
  },
};
```

## Accessibility

### Keyboard Navigation

Both components support full keyboard navigation:

- **Tab**: Navigate between interactive elements
- **Arrow Keys**: Navigate table cells
- **Enter/Space**: Activate buttons and select rows
- **Escape**: Close dropdowns and cancel operations

### Screen Reader Support

Components include proper ARIA attributes:

```typescript
<BetterTable
  aria-label="Users table"
  aria-describedby="table-description"
  role="table"
>
  <TableHeader role="rowgroup">
    <TableRow role="row">
      <TableHead role="columnheader" aria-sort="ascending">
        Name
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody role="rowgroup">
    {data.map((item, index) => (
      <TableRow 
        key={item.id}
        role="row"
        aria-rowindex={index + 1}
        tabIndex={0}
      >
        <TableCell role="gridcell">
          {item.name}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</BetterTable>
```

### Focus Management

Proper focus management ensures good UX:

```typescript
// Focus management for row selection
const handleRowClick = (row: TData, index: number) => {
  // Focus the row for keyboard users
  const rowElement = document.querySelector(`[data-row-index="${index}"]`);
  if (rowElement) {
    (rowElement as HTMLElement).focus();
  }
  
  // Handle row click
  onRowClick?.(row);
};
```

## Usage Examples

### Complete Table Implementation

```typescript
import React, { useState, useEffect } from 'react';
import { BetterTable } from '@better-tables/ui';
import { FilterManager, PaginationManager, SelectionManager } from '@better-tables/core';

function CompleteTable() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize managers
  const filterManager = new FilterManager(columns);
  const paginationManager = new PaginationManager({ defaultPageSize: 20 });
  const selectionManager = new SelectionManager({ mode: 'multiple' }, data);
  
  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchUsers({
          filters: filterManager.getFilters(),
          pagination: paginationManager.getPaginationParams(),
        });
        
        setData(result.data);
        paginationManager.setTotal(result.total);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Handle filter changes
  const handleFiltersChange = (filters: FilterState[]) => {
    filterManager.setFilters(filters);
    paginationManager.goToPage(1); // Reset to first page
    // Reload data with new filters
  };
  
  // Handle pagination changes
  const handlePageChange = (page: number) => {
    paginationManager.goToPage(page);
    // Reload data with new page
  };
  
  return (
    <div className="space-y-4">
      <BetterTable
        id="users-table"
        name="Users"
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        filters={filterManager.getFilters()}
        onFiltersChange={handleFiltersChange}
        paginationState={paginationManager.getPagination()}
        onPageChange={handlePageChange}
        onPageSizeChange={(size) => {
          paginationManager.setPageSize(size);
          // Reload data with new page size
        }}
        selectedRows={selectionManager.getSelectedIds()}
        onRowSelectionChange={(selected) => {
          // Update selection manager
          selected.forEach(id => selectionManager.selectRow(id));
        }}
        features={{
          filtering: true,
          pagination: true,
          rowSelection: true,
        }}
        onRowClick={(user) => {
          console.log('Selected user:', user);
        }}
        onRetry={() => {
          setError(null);
          // Retry loading data
        }}
      />
    </div>
  );
}
```

### Virtualized Table with Custom Rendering

```typescript
import { VirtualizedTable } from '@better-tables/ui';

function CustomVirtualizedTable() {
  const [data, setData] = useState<ComplexItem[]>([]);
  
  const columns = [
    cb.text().id('id').displayName('ID').width(80).build(),
    cb.text().id('name').displayName('Name').width(200).build(),
    cb.text().id('status').displayName('Status').width(120).build(),
    cb.text().id('actions').displayName('Actions').width(150).build(),
  ];
  
  const renderCell = (value: any, column: ColumnDefinition, item: ComplexItem, rowIndex: number) => {
    switch (column.id) {
      case 'status':
        return (
          <Badge 
            variant={value === 'active' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {value}
          </Badge>
        );
      
      case 'actions':
        return (
          <div className="flex space-x-1">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(item);
              }}
            >
              Edit
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item);
              }}
            >
              Delete
            </Button>
          </div>
        );
      
      default:
        return String(value || '');
    }
  };
  
  return (
    <VirtualizedTable
      data={data}
      columns={columns}
      height={600}
      rowHeight={60}
      dynamicRowHeight={true}
      renderCell={renderCell}
      onRowClick={(item, index) => {
        console.log('Clicked item:', item, 'at index:', index);
      }}
      onViewportChange={(startIndex, endIndex) => {
        console.log('Viewport changed:', startIndex, 'to', endIndex);
      }}
      virtualization={{
        overscan: 10,
        smoothScrolling: true,
      }}
      className="border rounded-lg"
    />
  );
}
```

### Mobile-Responsive Table

```typescript
function MobileResponsiveTable() {
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
      columns={columns}
      data={data}
      features={{
        filtering: true,
        pagination: true,
        rowSelection: !isMobile, // Disable on mobile
      }}
      className={cn(
        "w-full",
        isMobile && "overflow-x-auto",
        !isMobile && "table-fixed"
      )}
      onRowClick={(row) => {
        if (isMobile) {
          // Show mobile detail view
          showMobileDetail(row);
        } else {
          // Handle desktop row click
          handleRowClick(row);
        }
      }}
    />
  );
}
```

## Related Documentation

- [Core Types API Reference](../core/TYPES_API_REFERENCE.md)
- [Core Managers API Reference](../core/MANAGERS_API_REFERENCE.md)
- [Filter Components Reference](./FILTER_COMPONENTS_REFERENCE.md)
- [Hooks Reference](./HOOKS_REFERENCE.md)
- [Styling Guide](./STYLING_GUIDE.md)
