# @better-tables/core - User Guide

## Overview

The Better Tables core package provides a comprehensive, type-safe foundation for building advanced data tables. It offers a fluent API for column configuration, powerful state management, and robust utilities for common operations.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Column Configuration](#column-configuration)
- [State Management](#state-management)
- [Data Adapters](#data-adapters)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Installation

```bash
npm install @better-tables/core
# or
yarn add @better-tables/core
# or
pnpm add @better-tables/core
# or
bun add @better-tables/core
```

### Basic Usage

```typescript
import { 
  createColumnBuilder, 
  FilterManager, 
  SortingManager, 
  PaginationManager 
} from '@better-tables/core';

// Define your data type
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
}

// Create column definitions
const cb = createColumnBuilder<User>();

const columns = [
  cb.text()
    .id('name')
    .displayName('Name')
    .accessor(user => user.name)
    .searchable()
    .build(),
    
  cb.text()
    .id('email')
    .displayName('Email')
    .accessor(user => user.email)
    .asEmail()
    .build(),
    
  cb.number()
    .id('age')
    .displayName('Age')
    .accessor(user => user.age)
    .range(18, 100)
    .build(),
    
  cb.option()
    .id('status')
    .displayName('Status')
    .accessor(user => user.status)
    .options([
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'inactive', label: 'Inactive', color: 'red' },
    ])
    .build(),
];

// Create managers
const filterManager = new FilterManager(columns);
const sortingManager = new SortingManager(columns, { multiSort: true });
const paginationManager = new PaginationManager({ defaultPageSize: 20 });

// Use in your application
const tableState = {
  filters: filterManager.getFilters(),
  sorting: sortingManager.getSorting(),
  pagination: paginationManager.getPagination(),
};
```

## Core Concepts

### Type Safety

Better Tables is built with TypeScript-first design, providing full type safety throughout your application:

```typescript
// Type-safe column builder
const cb = createColumnBuilder<User>();

// TypeScript knows the data type
cb.text()
  .id('name')
  .accessor(user => user.name) // user is typed as User
  .build();

// Type-safe managers
const filterManager = new FilterManager<User>(columns);
const sortingManager = new SortingManager<User>(columns);
```

### Fluent API

The column builder uses a fluent API for intuitive configuration:

```typescript
const column = cb.text()
  .id('description')
  .displayName('Description')
  .accessor(item => item.description)
  .searchable({ debounce: 300 })
  .width(300, 100, 500)
  .align('left')
  .sortable(true)
  .filterable(true)
  .nullable(true)
  .build();
```

### Event-Driven Architecture

All managers use an event-driven architecture for reactive updates:

```typescript
// Subscribe to filter changes
const unsubscribe = filterManager.subscribe((event) => {
  switch (event.type) {
    case 'filter_added':
      console.log('New filter:', event.filter);
      break;
    case 'filters_cleared':
      console.log('All filters cleared');
      break;
  }
});

// Don't forget to unsubscribe
unsubscribe();
```

## Column Configuration

### Column Types

Better Tables supports various column types with built-in formatting and filtering:

#### Text Columns

```typescript
cb.text()
  .id('name')
  .displayName('Name')
  .accessor(user => user.name)
  .searchable({ debounce: 300 })
  .truncate({ maxLength: 100, showTooltip: true })
  .transform('capitalize')
  .build();
```

#### Number Columns

```typescript
cb.number()
  .id('price')
  .displayName('Price')
  .accessor(item => item.price)
  .currency({ currency: 'USD', locale: 'en-US' })
  .range(0, 10000, { step: 0.01 })
  .precision(2)
  .build();
```

#### Date Columns

```typescript
cb.date()
  .id('createdAt')
  .displayName('Created At')
  .accessor(item => item.createdAt)
  .format('yyyy-MM-dd', { locale: 'en-US' })
  .relative({ style: 'short' })
  .dateRange({ includeNull: false })
  .build();
```

#### Option Columns

```typescript
cb.option()
  .id('status')
  .displayName('Status')
  .accessor(item => item.status)
  .options([
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'red' },
  ], { searchable: true })
  .showBadges({ variant: 'default', showColors: true })
  .build();
```

#### Multi-Option Columns

```typescript
cb.multiOption()
  .id('tags')
  .displayName('Tags')
  .accessor(item => item.tags)
  .tags([
    { value: 'frontend', label: 'Frontend', color: 'blue' },
    { value: 'backend', label: 'Backend', color: 'green' },
  ], { allowCreate: true, maxTags: 10 })
  .displayFormat({ type: 'chips', maxVisible: 3 })
  .build();
```

#### Boolean Columns

```typescript
cb.boolean()
  .id('isActive')
  .displayName('Active')
  .accessor(item => item.isActive)
  .activeInactive({ showBadges: true })
  .build();
```

### Custom Renderers

You can provide custom cell and header renderers:

```typescript
cb.text()
  .id('avatar')
  .displayName('User')
  .accessor(user => user.name)
  .cellRenderer(({ value, row }) => (
    <div className="flex items-center gap-2">
      <img src={row.avatar} alt={value} className="w-8 h-8 rounded-full" />
      <span>{value}</span>
    </div>
  ))
  .headerRenderer(({ column, isSorted, sortDirection, onSort }) => (
    <div className="flex items-center gap-1">
      <span>{column.displayName}</span>
      <button onClick={onSort} aria-label={`Sort by ${column.displayName}`}>
        {isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </button>
    </div>
  ))
  .build();
```

### Validation Rules

Add validation rules for data integrity:

```typescript
cb.text()
  .id('email')
  .displayName('Email')
  .accessor(user => user.email)
  .validation([
    {
      id: 'email-format',
      validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: 'Invalid email format'
    },
    {
      id: 'required',
      validate: (value) => value && value.length > 0,
      message: 'Email is required'
    }
  ])
  .build();
```

## State Management

### Filter Manager

The FilterManager handles all filtering operations with validation and serialization:

```typescript
const filterManager = new FilterManager(columns);

// Add filters
filterManager.addFilter({
  columnId: 'name',
  type: 'text',
  operator: 'contains',
  values: ['john'],
});

filterManager.addFilter({
  columnId: 'age',
  type: 'number',
  operator: 'greaterThan',
  values: [18],
});

// Get current filters
const filters = filterManager.getFilters();

// Update filter
filterManager.updateFilter('name', {
  operator: 'equals',
  values: ['John Doe'],
});

// Remove filter
filterManager.removeFilter('age');

// Clear all filters
filterManager.clearFilters();
```

### Sorting Manager

The SortingManager supports both single and multi-column sorting:

```typescript
const sortingManager = new SortingManager(columns, {
  enabled: true,
  multiSort: true,
  maxSortColumns: 3,
  resetOnClick: false,
});

// Add sorts
sortingManager.addSort('name', 'asc');
sortingManager.addSort('age', 'desc');

// Toggle sort
sortingManager.toggleSort('name'); // asc -> desc -> remove

// Get current sorting
const sorting = sortingManager.getSorting();

// Clear sorting
sortingManager.clearSorting();
```

### Pagination Manager

The PaginationManager handles pagination state and navigation:

```typescript
const paginationManager = new PaginationManager({
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  maxPageSize: 1000,
});

// Set total items
paginationManager.setTotal(1000);

// Navigation
paginationManager.nextPage();
paginationManager.prevPage();
paginationManager.goToPage(5);
paginationManager.firstPage();
paginationManager.lastPage();

// Change page size
paginationManager.changePageSize(50);

// Get pagination state
const pagination = paginationManager.getPagination();
```

### Selection Manager

The SelectionManager handles row selection with various modes:

```typescript
const selectionManager = new SelectionManager({
  mode: 'multiple',
  maxSelections: 100,
  preserveSelection: false,
  showSelectAll: true,
  getRowId: (row) => row.id,
  isSelectable: (row) => !row.disabled,
}, initialRows);

// Selection operations
selectionManager.selectRow('row-1');
selectionManager.selectRows(['row-2', 'row-3']);
selectionManager.selectAll();
selectionManager.deselectAll();

// Get selection state
const selection = selectionManager.getSelection();
const selectedIds = selectionManager.getSelectedIds();
const selectedRows = selectionManager.getSelectedRows();
```

### Virtualization Manager

The VirtualizationManager optimizes rendering for large datasets:

```typescript
const virtualizationManager = new VirtualizationManager({
  containerHeight: 400,
  defaultRowHeight: 50,
  overscan: 5,
  smoothScrolling: true,
  dynamicRowHeight: false,
}, 10000, 20); // 10k rows, 20 columns

// Update scroll position
virtualizationManager.updateScroll({
  scrollTop: 1000,
  scrollLeft: 200,
  clientHeight: 400,
  clientWidth: 800,
});

// Get virtual items to render
const virtualRows = virtualizationManager.getVirtualRows();
const virtualColumns = virtualizationManager.getVirtualColumns();

// Navigation
virtualizationManager.scrollToRow(5000, 'center');
virtualizationManager.scrollToColumn(10, 'start');
```

## Data Adapters

### Adapter Interface

Better Tables uses an adapter pattern for data access. Create your own adapter by implementing the `TableAdapter` interface:

```typescript
import { TableAdapter, FetchDataParams, FetchDataResult } from '@better-tables/core';

class MyDataAdapter implements TableAdapter<User> {
  async fetchData(params: FetchDataParams): Promise<FetchDataResult<User>> {
    const { pagination, sorting, filters, search } = params;
    
    // Build your API request
    const queryParams = new URLSearchParams();
    
    if (pagination) {
      queryParams.set('page', pagination.page.toString());
      queryParams.set('limit', pagination.limit.toString());
    }
    
    if (sorting && sorting.length > 0) {
      queryParams.set('sort', JSON.stringify(sorting));
    }
    
    if (filters && filters.length > 0) {
      queryParams.set('filters', JSON.stringify(filters));
    }
    
    if (search) {
      queryParams.set('search', search);
    }
    
    // Make API call
    const response = await fetch(`/api/users?${queryParams}`);
    const data = await response.json();
    
    return {
      data: data.items,
      total: data.total,
      pagination: {
        page: pagination?.page || 1,
        limit: pagination?.limit || 20,
        totalPages: Math.ceil(data.total / (pagination?.limit || 20)),
        hasNext: (pagination?.page || 1) < Math.ceil(data.total / (pagination?.limit || 20)),
        hasPrev: (pagination?.page || 1) > 1,
      },
    };
  }

  async getFilterOptions(columnId: string): Promise<FilterOption[]> {
    const response = await fetch(`/api/users/filter-options/${columnId}`);
    return response.json();
  }

  async getFacetedValues(columnId: string): Promise<Map<string, number>> {
    const response = await fetch(`/api/users/faceted/${columnId}`);
    const data = await response.json();
    return new Map(Object.entries(data));
  }

  async getMinMaxValues(columnId: string): Promise<[number, number]> {
    const response = await fetch(`/api/users/min-max/${columnId}`);
    const data = await response.json();
    return [data.min, data.max];
  }

  meta = {
    name: 'MyDataAdapter',
    version: '1.0.0',
    features: {
      create: true,
      read: true,
      update: true,
      delete: true,
      bulkOperations: true,
      realTimeUpdates: false,
      export: true,
      transactions: false,
    },
    supportedColumnTypes: ['text', 'number', 'date', 'boolean', 'option', 'multiOption'],
    supportedOperators: {
      text: ['contains', 'equals', 'startsWith', 'endsWith'],
      number: ['equals', 'greaterThan', 'lessThan', 'between'],
      date: ['is', 'before', 'after', 'between'],
      boolean: ['isTrue', 'isFalse'],
      option: ['is', 'isNot', 'isAnyOf'],
      multiOption: ['includes', 'excludes', 'includesAny'],
    },
  };
}
```

### Using Adapters

```typescript
// Create table configuration with adapter
const tableConfig: TableConfig<User> = {
  id: 'users-table',
  name: 'Users',
  columns,
  adapter: new MyDataAdapter(),
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
  sorting: {
    enabled: true,
    multiSort: true,
  },
  features: {
    filtering: true,
    sorting: true,
    pagination: true,
    rowSelection: true,
    export: true,
  },
};
```

## Advanced Features

### URL State Persistence

Persist table state in the URL for sharing and bookmarking:

```typescript
import { FilterURLSerializer } from '@better-tables/core';

// Serialize filters to URL
const filters = filterManager.getFilters();
const serialized = FilterURLSerializer.serialize(filters);
const url = `?filters=${encodeURIComponent(serialized)}`;

// Deserialize from URL
const urlParams = new URLSearchParams(window.location.search);
const filtersParam = urlParams.get('filters');
if (filtersParam) {
  const filters = FilterURLSerializer.deserialize(filtersParam);
  filterManager.setFilters(filters);
}

// Create shareable URL
const shareableURL = FilterURLSerializer.createShareableURL(filters);
```

### Manager Coordination

Coordinate multiple managers for complex table behavior:

```typescript
class TableManager {
  private filterManager: FilterManager;
  private sortingManager: SortingManager;
  private paginationManager: PaginationManager;
  private selectionManager: SelectionManager;

  constructor(columns: ColumnDefinition[], data: any[]) {
    this.filterManager = new FilterManager(columns);
    this.sortingManager = new SortingManager(columns, { multiSort: true });
    this.paginationManager = new PaginationManager({ defaultPageSize: 20 });
    this.selectionManager = new SelectionManager({ mode: 'multiple' }, data);

    this.setupCoordination();
  }

  private setupCoordination() {
    // Reset pagination when filters change
    this.filterManager.subscribe((event) => {
      if (event.type === 'filter_added' || event.type === 'filter_removed') {
        this.paginationManager.goToPage(1);
      }
    });

    // Clear selection when data changes
    this.paginationManager.subscribe((event) => {
      if (event.type === 'page_changed') {
        this.selectionManager.clearSelection();
      }
    });
  }

  resetAll() {
    this.filterManager.clearFilters();
    this.sortingManager.clearSorting();
    this.paginationManager.goToPage(1);
    this.selectionManager.clearSelection();
  }

  getTableState() {
    return {
      filters: this.filterManager.getFilters(),
      sorting: this.sortingManager.getSorting(),
      pagination: this.paginationManager.getPagination(),
      selection: this.selectionManager.getSelection(),
    };
  }
}
```

### Custom Filter Operators

Extend the filter system with custom operators:

```typescript
import { createOperatorRegistry } from '@better-tables/core';

// Define custom operators
const customOperators = [
  {
    key: 'containsCaseInsensitive',
    label: 'Contains (case insensitive)',
    description: 'Contains text ignoring case',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => values.length === 1 && typeof values[0] === 'string',
  },
  {
    key: 'regex',
    label: 'Matches regex',
    description: 'Matches regular expression',
    valueCount: 1,
    supportsNull: false,
    validate: (values) => {
      if (values.length !== 1 || typeof values[0] !== 'string') return false;
      try {
        new RegExp(values[0]);
        return true;
      } catch {
        return false;
      }
    },
  },
];

// Create custom registry
const customRegistry = createOperatorRegistry(customOperators);

// Use in filter manager
const filterManager = new FilterManager(columns);
// Extend with custom operators...
```

## Best Practices

### 1. Type Safety

Always use typed column builders and managers:

```typescript
// Good: Type-safe
const cb = createColumnBuilder<User>();
const filterManager = new FilterManager<User>(columns);

// Avoid: Untyped
const cb = createColumnBuilder();
const filterManager = new FilterManager(columns);
```

### 2. Performance Optimization

Use debouncing for frequent updates:

```typescript
import { debounce } from 'lodash';

const debouncedUpdate = debounce((filters: FilterState[]) => {
  // Update table or make API call
  updateTable(filters);
}, 300);

filterManager.subscribe(() => {
  const filters = filterManager.getFilters();
  debouncedUpdate(filters);
});
```

### 3. Error Handling

Always handle errors gracefully:

```typescript
try {
  filterManager.addFilter(filter);
} catch (error) {
  console.error('Failed to add filter:', error.message);
  // Show user-friendly error message
  showError('Invalid filter configuration');
}
```

### 4. Memory Management

Clean up subscriptions to prevent memory leaks:

```typescript
class TableComponent {
  private unsubscribers: (() => void)[] = [];

  componentDidMount() {
    this.unsubscribers = [
      this.filterManager.subscribe(this.handleFilterChange),
      this.sortingManager.subscribe(this.handleSortingChange),
      this.paginationManager.subscribe(this.handlePaginationChange),
    ];
  }

  componentWillUnmount() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
  }
}
```

### 5. URL State Management

Use URL state for better user experience:

```typescript
// Load initial state from URL
const urlFilters = FilterURLSerializer.getFromURL();
if (urlFilters.length > 0) {
  filterManager.setFilters(urlFilters);
}

// Update URL when state changes
filterManager.subscribe(() => {
  const filters = filterManager.getFilters();
  FilterURLSerializer.setInURL(filters);
});
```

## Troubleshooting

### Common Issues

#### 1. Type Errors

**Problem**: TypeScript errors with column builders

**Solution**: Ensure you're using typed column builders:

```typescript
// Correct
const cb = createColumnBuilder<User>();
const column = cb.text().accessor(user => user.name).build();

// Incorrect
const cb = createColumnBuilder();
const column = cb.text().accessor(user => user.name).build(); // user is any
```

#### 2. Filter Validation Errors

**Problem**: Filters are being rejected with validation errors

**Solution**: Check filter structure and operator compatibility:

```typescript
// Ensure filter has required fields
const filter: FilterState = {
  columnId: 'name',        // Required
  type: 'text',           // Required
  operator: 'contains',   // Required
  values: ['john'],       // Required array
};

// Check operator compatibility
const operators = filterManager.getOperatorsForColumn('name');
console.log('Available operators:', operators);
```

#### 3. Performance Issues

**Problem**: Slow rendering with large datasets

**Solution**: Use virtualization and optimize updates:

```typescript
// Enable virtualization
const virtualizationManager = new VirtualizationManager({
  containerHeight: 400,
  defaultRowHeight: 50,
  overscan: 5,
}, totalRows, totalColumns);

// Debounce updates
const debouncedUpdate = debounce(updateTable, 300);
```

#### 4. URL State Issues

**Problem**: URL state not persisting or loading correctly

**Solution**: Check serialization and handle errors:

```typescript
// Safe URL loading
try {
  const filters = FilterURLSerializer.deserialize(urlString);
  filterManager.setFilters(filters);
} catch (error) {
  console.warn('Failed to load filters from URL:', error);
  // Use default filters
}
```

### Debugging Tips

1. **Enable Console Logging**: Use browser dev tools to monitor manager events
2. **Validate State**: Check manager state with `getState()` methods
3. **Test Serialization**: Use `FilterURLSerializer.validate()` to test URL strings
4. **Monitor Performance**: Use virtualization metrics to identify bottlenecks

### Getting Help

- Check the [API Reference](./TYPES_API_REFERENCE.md) for detailed documentation
- Review the [Column Builders Guide](./COLUMN_BUILDERS_GUIDE.md) for configuration examples
- See the [Managers API Reference](./MANAGERS_API_REFERENCE.md) for state management
- Consult the [Utilities API Reference](./UTILITIES_API_REFERENCE.md) for helper functions

## Related Documentation

- [Types API Reference](./TYPES_API_REFERENCE.md)
- [Column Builders Guide](./COLUMN_BUILDERS_GUIDE.md)
- [Managers API Reference](./MANAGERS_API_REFERENCE.md)
- [Utilities API Reference](./UTILITIES_API_REFERENCE.md)
- [Architecture Guide](./ARCHITECTURE.md)
