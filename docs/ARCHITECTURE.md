# Better Tables Architecture Guide

## Overview

Better Tables is designed as a modular, type-safe React table library with a clear separation of concerns. This document explains the architecture, design decisions, and how the different packages work together.

## Table of Contents

- [Package Architecture](#package-architecture)
- [Core Package Design](#core-package-design)
- [UI Package Design](#ui-package-design)
- [Adapter Pattern](#adapter-pattern)
- [State Management](#state-management)
- [Type System](#type-system)
- [Performance Architecture](#performance-architecture)
- [Extensibility](#extensibility)

## Package Architecture

### Package Structure

```
better-tables/
├── packages/
│   ├── core/           # Core functionality & types
│   ├── ui/             # React components & hooks
│   └── adapters/       # Data source adapters
│       ├── drizzle/    # Drizzle ORM adapter
│       ├── memory/     # In-memory adapter
│       └── rest/       # REST API adapter
├── apps/               # Demo applications
├── docs/               # Documentation
└── examples/           # Code examples
```

### Package Dependencies

```mermaid
graph TD
    A[@better-tables/core] --> B[@better-tables/ui]
    A --> C[@better-tables/adapters-drizzle]
    A --> D[@better-tables/adapters-memory]
    A --> E[@better-tables/adapters-rest]
    B --> F[React]
    B --> G[Tailwind CSS]
    C --> H[Drizzle ORM]
    E --> I[Fetch API]
```

### Package Responsibilities

| Package | Responsibility | Dependencies |
|---------|---------------|--------------|
| `@better-tables/core` | Types, builders, managers, utilities | React (peer), Zustand, date-fns |
| `@better-tables/ui` | React components, hooks, styling | `@better-tables/core`, Radix UI, Tailwind |
| `@better-tables/adapters-*` | Data source integration | `@better-tables/core`, specific libraries |

## Core Package Design

### Type System

The core package provides a comprehensive type system that ensures type safety throughout the application:

```typescript
// Base types
interface ColumnDefinition<TData = any> {
  id: string;
  displayName: string;
  accessor: (data: TData) => any;
  type: ColumnType;
  // ... other properties
}

// Specialized types
interface TextColumnDefinition<TData> extends ColumnDefinition<TData> {
  type: 'text';
  searchable?: boolean;
  // ... text-specific properties
}

// Union types for type safety
type ColumnDefinition<TData> = 
  | TextColumnDefinition<TData>
  | NumberColumnDefinition<TData>
  | DateColumnDefinition<TData>
  | OptionColumnDefinition<TData>
  | MultiOptionColumnDefinition<TData>
  | BooleanColumnDefinition<TData>;
```

### Builder Pattern

The fluent API uses the builder pattern for type-safe column creation:

```typescript
// Builder base class
abstract class ColumnBuilder<TData, TColumn extends ColumnDefinition<TData>> {
  protected config: Partial<TColumn> = {};
  
  id(id: string): this {
    this.config.id = id;
    return this;
  }
  
  displayName(name: string): this {
    this.config.displayName = name;
    return this;
  }
  
  abstract build(): TColumn;
}

// Specialized builders
class TextColumnBuilder<TData> extends ColumnBuilder<TData, TextColumnDefinition<TData>> {
  searchable(): this {
    this.config.searchable = true;
    return this;
  }
  
  build(): TextColumnDefinition<TData> {
    return { ...this.config } as TextColumnDefinition<TData>;
  }
}
```

### Manager Pattern

State management is handled by specialized manager classes:

```typescript
// Base manager interface
interface Manager<TState, TActions> {
  getState(): TState;
  subscribe(listener: (state: TState) => void): () => void;
  actions: TActions;
}

// Filter manager implementation
class FilterManager implements Manager<FilterState[], FilterActions> {
  private store = create<FilterStore>((set, get) => ({
    filters: [],
    addFilter: (filter) => set(state => ({ filters: [...state.filters, filter] })),
    removeFilter: (columnId) => set(state => ({ 
      filters: state.filters.filter(f => f.columnId !== columnId) 
    })),
    // ... other actions
  }));
  
  getState() {
    return this.store.getState().filters;
  }
  
  subscribe(listener) {
    return this.store.subscribe(listener);
  }
  
  get actions() {
    return this.store.getState();
  }
}
```

## UI Package Design

### Component Architecture

The UI package follows a component composition pattern:

```typescript
// Main table component
export function BetterTable<TData>(props: BetterTableProps<TData>) {
  const {
    filtering = true,
    sorting = true,
    pagination = true,
    rowSelection = false,
  } = props.features;

  return (
    <div className="space-y-4">
      {filtering && <FilterBar {...filterProps} />}
      <TableContainer>
        <Table>
          <TableHeader>
            {columns.map(column => (
              <SortableHeader 
                key={column.id} 
                column={column}
                sorting={sorting}
              />
            ))}
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={getRowId(row, index)}>
                {columns.map(column => (
                  <TableCell key={column.id}>
                    <CellRenderer 
                      value={column.accessor(row)}
                      column={column}
                      row={row}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {pagination && <TablePagination {...paginationProps} />}
    </div>
  );
}
```

### Hook Architecture

Custom hooks provide reusable logic:

```typescript
// Data fetching hook
export function useTableData<TData>(config: UseTableDataConfig<TData>) {
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await config.adapter.fetchData({
        filters: config.filters,
        pagination: config.pagination,
        sorting: config.sorting,
      });
      
      setData(result.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [config.adapter, config.filters, config.pagination, config.sorting]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return { data, loading, error, refetch: fetchData };
}

// Virtualization hook
export function useVirtualization<TData>(config: UseVirtualizationConfig<TData>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / config.rowHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / config.rowHeight),
      config.data.length
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, config.rowHeight, config.data.length]);
  
  const visibleData = useMemo(() => {
    return config.data.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [config.data, visibleRange]);
  
  return {
    visibleData,
    visibleRange,
    scrollTop,
    setScrollTop,
    containerHeight,
    setContainerHeight,
  };
}
```

### Styling Architecture

The UI package uses Tailwind CSS with a design system approach:

```typescript
// Design tokens
const designTokens = {
  colors: {
    primary: 'blue',
    secondary: 'gray',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
  },
};

// Component variants
const tableVariants = cva(
  'w-full border-collapse',
  {
    variants: {
      variant: {
        default: 'border border-gray-200',
        striped: 'border border-gray-200 [&_tbody_tr:nth-child(even)]:bg-gray-50',
        bordered: 'border border-gray-200 [&_td]:border [&_td]:border-gray-200',
      },
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);
```

## Adapter Pattern

### Adapter Interface

All adapters implement a common interface:

```typescript
interface TableAdapter<TData = any> {
  // Data operations
  fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>>;
  create?(data: Partial<TData>): Promise<TData>;
  update?(id: string, data: Partial<TData>): Promise<TData>;
  delete?(id: string): Promise<void>;
  
  // Metadata
  getMetadata?(): Promise<AdapterMetadata>;
  
  // Configuration
  configure?(config: AdapterConfig): void;
}
```

### REST Adapter Implementation

```typescript
class RestAdapter<TData> implements TableAdapter<TData> {
  constructor(private config: RestAdapterConfig) {}
  
  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    const url = new URL(this.config.baseUrl + this.config.endpoints.list);
    
    // Add query parameters
    if (params.pagination) {
      url.searchParams.set('page', params.pagination.page.toString());
      url.searchParams.set('limit', params.pagination.limit.toString());
    }
    
    if (params.filters) {
      params.filters.forEach(filter => {
        url.searchParams.set(`filter_${filter.columnId}`, JSON.stringify(filter));
      });
    }
    
    if (params.sorting) {
      url.searchParams.set('sort', JSON.stringify(params.sorting));
    }
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    return {
      data: data.items,
      totalCount: data.total,
      hasNext: data.hasNext,
      hasPrev: data.hasPrev,
    };
  }
}
```

### Drizzle Adapter Implementation

```typescript
class DrizzleAdapter<TData> implements TableAdapter<TData> {
  constructor(private db: DrizzleDatabase, private table: Table) {}
  
  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    let query = this.db.select().from(this.table);
    
    // Apply filters
    if (params.filters) {
      params.filters.forEach(filter => {
        query = this.applyFilter(query, filter);
      });
    }
    
    // Apply sorting
    if (params.sorting) {
      params.sorting.forEach(sort => {
        query = query.orderBy(this.table[sort.columnId], sort.direction === 'desc' ? desc : asc);
      });
    }
    
    // Apply pagination
    if (params.pagination) {
      const offset = (params.pagination.page - 1) * params.pagination.limit;
      query = query.limit(params.pagination.limit).offset(offset);
    }
    
    const [data, totalCount] = await Promise.all([
      query.execute(),
      this.db.select({ count: count() }).from(this.table).execute(),
    ]);
    
    return {
      data: data as TData[],
      totalCount: totalCount[0].count,
      hasNext: offset + params.pagination.limit < totalCount[0].count,
      hasPrev: params.pagination.page > 1,
    };
  }
  
  private applyFilter(query: any, filter: FilterState) {
    const column = this.table[filter.columnId];
    
    switch (filter.operator) {
      case 'contains':
        return query.where(like(column, `%${filter.values[0]}%`));
      case 'equals':
        return query.where(eq(column, filter.values[0]));
      case 'greaterThan':
        return query.where(gt(column, filter.values[0]));
      // ... other operators
    }
  }
}
```

## State Management

### Zustand Integration

Better Tables uses Zustand for state management:

```typescript
// Store definition
interface TableStore<TData> {
  // Data
  data: TData[];
  loading: boolean;
  error: Error | null;
  
  // Features
  filters: FilterState[];
  sorting: SortingState;
  pagination: PaginationState;
  selection: SelectionState;
  
  // Actions
  setData: (data: TData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  addFilter: (filter: FilterState) => void;
  removeFilter: (columnId: string) => void;
  setSorting: (sorting: SortingState) => void;
  setPagination: (pagination: PaginationState) => void;
  setSelection: (selection: SelectionState) => void;
}

// Store creation
const createTableStore = <TData>() => 
  create<TableStore<TData>>((set, get) => ({
    // Initial state
    data: [],
    loading: false,
    error: null,
    filters: [],
    sorting: [],
    pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
    selection: { mode: 'none', selectedRows: new Set() },
    
    // Actions
    setData: (data) => set({ data }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    addFilter: (filter) => set(state => ({ 
      filters: [...state.filters, filter] 
    })),
    removeFilter: (columnId) => set(state => ({ 
      filters: state.filters.filter(f => f.columnId !== columnId) 
    })),
    setSorting: (sorting) => set({ sorting }),
    setPagination: (pagination) => set({ pagination }),
    setSelection: (selection) => set({ selection }),
  }));
```

### State Synchronization

State is synchronized across components using subscriptions:

```typescript
// Hook for subscribing to store changes
export function useTableStore<TData>(store: TableStore<TData>) {
  const filters = store(state => state.filters);
  const sorting = store(state => state.sorting);
  const pagination = store(state => state.pagination);
  const selection = store(state => state.selection);
  
  return {
    filters,
    sorting,
    pagination,
    selection,
    actions: {
      addFilter: store.getState().addFilter,
      removeFilter: store.getState().removeFilter,
      setSorting: store.getState().setSorting,
      setPagination: store.getState().setPagination,
      setSelection: store.getState().setSelection,
    },
  };
}
```

## Type System

### Generic Type Safety

The type system ensures type safety across all operations:

```typescript
// Generic column builder
class ColumnBuilder<TData, TColumn extends ColumnDefinition<TData>> {
  accessor<TReturn>(accessor: (data: TData) => TReturn): ColumnBuilder<TData, TColumn & { accessor: (data: TData) => TReturn }> {
    this.config.accessor = accessor;
    return this as any;
  }
}

// Type-safe usage
interface User {
  id: string;
  name: string;
  age: number;
}

const column = createColumnBuilder<User>()
  .text()
  .id('name')
  .accessor(user => user.name)  // Type-safe: user is User
  .build();

// Type-safe filter operations
const filter: FilterState = {
  columnId: 'name',
  type: 'text',
  operator: 'contains',
  values: ['John'],  // Type-safe values
};
```

### Type Guards

Type guards ensure runtime type safety:

```typescript
function isTextColumn<TData>(column: ColumnDefinition<TData>): column is TextColumnDefinition<TData> {
  return column.type === 'text';
}

function isNumberColumn<TData>(column: ColumnDefinition<TData>): column is NumberColumnDefinition<TData> {
  return column.type === 'number';
}

// Usage in components
function CellRenderer<TData>({ column, value }: CellRendererProps<TData>) {
  if (isTextColumn(column)) {
    return <TextCell value={value} column={column} />;
  }
  
  if (isNumberColumn(column)) {
    return <NumberCell value={value} column={column} />;
  }
  
  return <DefaultCell value={value} column={column} />;
}
```

## Performance Architecture

### Virtualization Strategy

Virtual scrolling is implemented using a windowing technique:

```typescript
// Virtualization calculation
function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  rowHeight: number,
  totalRows: number
) {
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / rowHeight),
    totalRows
  );
  
  return { startIndex, endIndex };
}

// Render only visible rows
function VirtualizedTable<TData>({ data, rowHeight, height }: VirtualizedTableProps<TData>) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => 
    calculateVisibleRange(scrollTop, height, rowHeight, data.length),
    [scrollTop, height, rowHeight, data.length]
  );
  
  const visibleData = useMemo(() => 
    data.slice(visibleRange.startIndex, visibleRange.endIndex),
    [data, visibleRange]
  );
  
  return (
    <div 
      style={{ height, overflow: 'auto' }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: data.length * rowHeight, position: 'relative' }}>
        {visibleData.map((item, index) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              top: (visibleRange.startIndex + index) * rowHeight,
              height: rowHeight,
              width: '100%',
            }}
          >
            <TableRow data={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Memoization Strategy

Components are memoized to prevent unnecessary re-renders:

```typescript
// Memoized cell renderer
const CellRenderer = memo(<TData>({ value, column, row }: CellRendererProps<TData>) => {
  return (
    <div className="table-cell">
      {column.render ? column.render(value, row) : String(value)}
    </div>
  );
});

// Memoized table row
const TableRow = memo(<TData>({ data, columns }: TableRowProps<TData>) => {
  return (
    <tr>
      {columns.map(column => (
        <CellRenderer
          key={column.id}
          value={column.accessor(data)}
          column={column}
          row={data}
        />
      ))}
    </tr>
  );
});
```

### Debouncing Strategy

User input is debounced to prevent excessive operations:

```typescript
// Debounced filter input
function FilterInput({ onFilterChange }: FilterInputProps) {
  const [value, setValue] = useState('');
  const debouncedValue = useDebounce(value, 300);
  
  useEffect(() => {
    onFilterChange(debouncedValue);
  }, [debouncedValue, onFilterChange]);
  
  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

## Extensibility

### Custom Column Types

New column types can be added by extending the base types:

```typescript
// Custom column type
interface CustomColumnDefinition<TData> extends ColumnDefinition<TData> {
  type: 'custom';
  customProperty: string;
  customRenderer: (value: any, data: TData) => React.ReactNode;
}

// Custom column builder
class CustomColumnBuilder<TData> extends ColumnBuilder<TData, CustomColumnDefinition<TData>> {
  customProperty(value: string): this {
    this.config.customProperty = value;
    return this;
  }
  
  customRenderer(renderer: (value: any, data: TData) => React.ReactNode): this {
    this.config.customRenderer = renderer;
    return this;
  }
  
  build(): CustomColumnDefinition<TData> {
    return { ...this.config } as CustomColumnDefinition<TData>;
  }
}
```

### Custom Adapters

New data sources can be integrated by implementing the adapter interface:

```typescript
// GraphQL adapter
class GraphQLAdapter<TData> implements TableAdapter<TData> {
  constructor(private client: ApolloClient<any>, private query: DocumentNode) {}
  
  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    const variables = {
      filters: params.filters,
      pagination: params.pagination,
      sorting: params.sorting,
    };
    
    const { data } = await this.client.query({
      query: this.query,
      variables,
    });
    
    return {
      data: data.items,
      totalCount: data.totalCount,
      hasNext: data.hasNext,
      hasPrev: data.hasPrev,
    };
  }
}
```

### Custom Components

UI components can be customized through render props and composition:

```typescript
// Custom table with render props
interface CustomTableProps<TData> {
  data: TData[];
  columns: ColumnDefinition<TData>[];
  renderHeader?: (column: ColumnDefinition<TData>) => React.ReactNode;
  renderCell?: (value: any, column: ColumnDefinition<TData>, row: TData) => React.ReactNode;
  renderRow?: (row: TData, index: number) => React.ReactNode;
}

function CustomTable<TData>({ 
  data, 
  columns, 
  renderHeader, 
  renderCell, 
  renderRow 
}: CustomTableProps<TData>) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={column.id}>
              {renderHeader ? renderHeader(column) : column.displayName}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {renderRow ? renderRow(row, index) : (
              columns.map(column => (
                <td key={column.id}>
                  {renderCell ? 
                    renderCell(column.accessor(row), column, row) : 
                    String(column.accessor(row))
                  }
                </td>
              ))
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Conclusion

Better Tables is designed with:

- **Modularity**: Clear separation between core logic, UI components, and data adapters
- **Type Safety**: Comprehensive TypeScript support throughout
- **Performance**: Virtualization, memoization, and debouncing strategies
- **Extensibility**: Easy to add custom column types, adapters, and components
- **Developer Experience**: Fluent API, comprehensive documentation, and examples

This architecture enables developers to build powerful, performant data tables while maintaining flexibility and ease of use.

## Related Documentation

- [Getting Started Guide](./GETTING_STARTED.md)
- [Performance Benchmarks](./PERFORMANCE_BENCHMARKS.md)
- [Component Reference](./ui/COMPONENT_REFERENCE.md)
- [API Reference](./core/TYPES_API_REFERENCE.md)
