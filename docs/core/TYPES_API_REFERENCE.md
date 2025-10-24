# @better-tables/core - Type System API Reference

## Overview

The Better Tables core package provides a comprehensive type system designed for type-safe table configuration, data management, and UI integration. All types are designed to work together seamlessly with full TypeScript support.

## Table of Contents

- [Core Types](#core-types)
- [Column Types](#column-types)
- [Filter Types](#filter-types)
- [Manager Types](#manager-types)
- [Adapter Types](#adapter-types)
- [Utility Types](#utility-types)

## Core Types

### TableConfig<TData>

The main configuration interface for table instances.

```typescript
interface TableConfig<TData = any> {
  id: string; // Unique table identifier
  name: string; // Display name
  columns: ColumnDefinition<TData>[]; // Column definitions
  groups?: FilterGroup[]; // Filter groups
  defaultFilters?: FilterState[]; // Initial filters
  pagination?: PaginationConfig; // Pagination settings
  sorting?: SortingConfig; // Sorting settings
  bulkActions?: BulkActionDefinition[]; // Bulk operations
  exportOptions?: ExportConfig; // Export settings
  adapter: TableAdapter<TData>; // Data adapter
  theme?: TableTheme; // UI theme
  features?: TableFeatures; // Feature flags
  rowConfig?: RowConfig<TData>; // Row behavior
  emptyState?: EmptyStateConfig; // Empty state
  loadingState?: LoadingStateConfig; // Loading state
  errorState?: ErrorStateConfig; // Error state
}
```

**Key Features:**

- Generic type parameter for row data type safety
- Comprehensive configuration options
- Extensible through adapter pattern
- Built-in state management

### TableFeatures

Controls which table features are enabled.

```typescript
interface TableFeatures {
  filtering?: boolean; // Enable filtering
  sorting?: boolean; // Enable sorting
  pagination?: boolean; // Enable pagination
  bulkActions?: boolean; // Enable bulk actions
  export?: boolean; // Enable export
  columnResizing?: boolean; // Enable column resizing
  columnReordering?: boolean; // Enable column reordering
  rowSelection?: boolean; // Enable row selection
  virtualScrolling?: boolean; // Enable virtualization
  realTimeUpdates?: boolean; // Enable real-time updates
  columnVisibility?: boolean; // Enable column visibility toggle
  rowExpansion?: boolean; // Enable row expansion
}
```

## Column Types

### ColumnDefinition<TData, TValue>

Defines how a column behaves and renders data.

```typescript
interface ColumnDefinition<TData = unknown, TValue = unknown> {
  id: string; // Unique column identifier
  displayName: string; // Display name
  icon?: IconComponent; // Optional icon
  accessor: (data: TData) => TValue; // Data accessor function
  type: ColumnType; // Column type
  sortable?: boolean; // Whether sortable
  filterable?: boolean; // Whether filterable
  resizable?: boolean; // Whether resizable
  width?: number; // Default width
  minWidth?: number; // Minimum width
  maxWidth?: number; // Maximum width
  align?: "left" | "center" | "right"; // Text alignment
  cellRenderer?: (props: CellRendererProps<TData, TValue>) => ReactNode;
  headerRenderer?: (props: HeaderRendererProps<TData>) => ReactNode;
  filter?: FilterConfig<TValue>; // Filter configuration
  validation?: ValidationRule<TValue>[]; // Validation rules
  nullable?: boolean; // Supports null values
  meta?: Record<string, any>; // Additional metadata
}
```

### ColumnType

Supported column types with built-in formatting and filtering.

```typescript
type ColumnType =
  | "text" // Plain text
  | "number" // Numeric values
  | "date" // Date/time values
  | "boolean" // True/false values
  | "option" // Single selection
  | "multiOption" // Multiple selection
  | "currency" // Currency formatting
  | "percentage" // Percentage formatting
  | "url" // URL formatting
  | "email" // Email formatting
  | "phone" // Phone formatting
  | "json" // JSON data
  | "custom"; // Custom type
```

### CellRendererProps<TData, TValue>

Props for custom cell renderers.

```typescript
interface CellRendererProps<TData = any, TValue = any> {
  row: TData; // Current row data
  value: TValue; // Current cell value
  column: ColumnDefinition<TData, TValue>; // Column definition
  rowIndex: number; // Row index
  isSelected?: boolean; // Whether row is selected
  isExpanded?: boolean; // Whether row is expanded
  table?: any; // Table instance
}
```

## Filter Types

### FilterState

Represents an active filter condition.

```typescript
interface FilterState {
  columnId: string; // Column being filtered
  type: ColumnType; // Column type
  operator: FilterOperator; // Filter operator
  values: unknown[]; // Filter values
  includeNull?: boolean; // Include null values
  meta?: Record<string, any>; // Additional metadata
}
```

### FilterOperator

Available filter operators (auto-generated from centralized definitions).

```typescript
type FilterOperator =
  // Text operators
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  // Number operators
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "between"
  | "notBetween"
  // Date operators
  | "is"
  | "isNot"
  | "before"
  | "after"
  | "isToday"
  | "isYesterday"
  | "isThisWeek"
  | "isThisMonth"
  | "isThisYear"
  // Option operators
  | "isAnyOf"
  | "isNoneOf"
  // Multi-option operators
  | "includes"
  | "excludes"
  | "includesAny"
  | "includesAll"
  | "excludesAny"
  | "excludesAll"
  // Boolean operators
  | "isTrue"
  | "isFalse"
  // Universal operators
  | "isNull"
  | "isNotNull";
```

### FilterOperatorDefinition

Defines operator behavior and validation.

```typescript
interface FilterOperatorDefinition<TOperator extends string = FilterOperator> {
  key: TOperator; // Operator key
  label: string; // Display label
  description?: string; // Description
  valueCount: number | "variable"; // Required value count
  supportsNull?: boolean; // Supports null values
  validate?: (values: any[]) => boolean | string; // Validation function
  inputComponent?: ComponentType<FilterInputProps>; // Custom input component
}
```

### FilterConfig<TValue>

Column-specific filter configuration.

```typescript
interface FilterConfig<TValue = any> {
  operators?: FilterOperator[]; // Allowed operators
  options?: FilterOption[]; // Options for select filters
  min?: number; // Minimum value
  max?: number; // Maximum value
  customComponent?: ComponentType<FilterComponentProps<TValue>>; // Custom component
  includeNull?: boolean; // Include null values
  debounce?: number; // Debounce delay
  validation?: (value: TValue) => boolean | string; // Value validation
}
```

## Manager Types

### PaginationState

Current pagination state.

```typescript
interface PaginationState {
  page: number; // Current page (1-indexed)
  limit: number; // Items per page
  totalPages: number; // Total pages
  hasNext: boolean; // Has next page
  hasPrev: boolean; // Has previous page
}
```

### SortingState

Current sorting state (array of column sorts).

```typescript
type SortingState = SortingParams[];

interface SortingParams {
  columnId: string; // Column to sort
  direction: "asc" | "desc"; // Sort direction
}
```

### SelectionState

Current row selection state.

```typescript
interface SelectionState {
  selectedIds: Set<string>; // Selected row IDs
  allSelected: boolean; // All rows selected
  someSelected: boolean; // Some rows selected
  mode: "single" | "multiple" | "none"; // Selection mode
}
```

### VirtualizationState

Current virtualization state.

```typescript
interface VirtualizationState {
  virtualRows: VirtualRowItem[]; // Currently rendered rows
  virtualColumns: VirtualColumnItem[]; // Currently rendered columns
  startIndex: number; // First visible row index
  endIndex: number; // Last visible row index
  startColumnIndex: number; // First visible column index
  endColumnIndex: number; // Last visible column index
  totalHeight: number; // Total content height
  totalWidth: number; // Total content width
  scrollInfo: ScrollInfo; // Current scroll position
  enabled: boolean; // Whether virtualization is active
}
```

## Adapter Types

### TableAdapter<TData>

Interface for data adapters.

```typescript
interface TableAdapter<TData = unknown> {
  fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>>;
  getFilterOptions(columnId: string): Promise<FilterOption[]>;
  getFacetedValues(columnId: string): Promise<Map<string, number>>;
  getMinMaxValues(columnId: string): Promise<[number, number]>;
  createRecord?(data: Partial<TData>): Promise<TData>;
  updateRecord?(id: string, data: Partial<TData>): Promise<TData>;
  deleteRecord?(id: string): Promise<void>;
  bulkUpdate?(ids: string[], data: Partial<TData>): Promise<TData[]>;
  bulkDelete?(ids: string[]): Promise<void>;
  exportData?(params: ExportParams): Promise<ExportResult>;
  subscribe?(callback: (event: DataEvent<TData>) => void): () => void;
  meta: AdapterMeta;
}
```

### FetchDataParams

Parameters for data fetching.

```typescript
interface FetchDataParams {
  pagination?: PaginationParams; // Pagination settings
  sorting?: SortingParams[]; // Sorting settings
  filters?: FilterState[]; // Active filters
  search?: string; // Search query
  columns?: string[]; // Columns to include
  params?: Record<string, any>; // Additional parameters
}
```

### FetchDataResult<TData>

Result from data fetching.

```typescript
interface FetchDataResult<TData = any> {
  data: TData[]; // Data items
  total: number; // Total count
  pagination: {
    // Pagination info
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  faceted?: Record<string, Map<string, number>>; // Faceted values
  meta?: Record<string, any>; // Additional metadata
}
```

## Utility Types

### TableTheme

Theme configuration for styling.

```typescript
interface TableTheme {
  name?: string; // Theme name
  className?: string; // CSS class
  colors?: {
    // Color definitions
    primary?: string;
    secondary?: string;
    success?: string;
    warning?: string;
    error?: string;
    [key: string]: string | undefined;
  };
  components?: {
    // Component overrides
    table?: Record<string, any>;
    filter?: Record<string, any>;
    pagination?: Record<string, any>;
    [key: string]: Record<string, any> | undefined;
  };
}
```

### RenderProps<TData, TValue, TColumn>

Base props for render functions.

```typescript
interface RenderProps<TData = any, TValue = any, TColumn = any> {
  row: TData; // Current row data
  value: TValue; // Current cell value
  column: TColumn; // Column definition
  rowIndex: number; // Row index
  table?: any; // Table instance
}
```

### EventHandler<T>

Generic event handler type.

```typescript
type EventHandler<T = void> = (event: T) => void | Promise<void>;
```

### DataEvent<TData>

Real-time data update events.

```typescript
interface DataEvent<TData = any> {
  type: "insert" | "update" | "delete"; // Event type
  data: TData | TData[]; // Affected data
  meta?: Record<string, any>; // Event metadata
}
```

## Type Safety Features

### Generic Type Parameters

All types use generic parameters for maximum type safety:

- `TData`: The type of row data
- `TValue`: The type of cell values
- `TColumn`: The type of column definitions

### Type Guards

Built-in type guards for runtime type checking:

```typescript
// Example usage
function isTextColumn(
  column: ColumnDefinition
): column is ColumnDefinition<any, string> {
  return column.type === "text";
}
```

### Const Assertions

Types use const assertions where appropriate for literal type inference:

```typescript
const columnTypes = ["text", "number", "date"] as const;
type ColumnType = (typeof columnTypes)[number]; // 'text' | 'number' | 'date'
```

## Best Practices

### Type Definitions

1. **Use Generic Parameters**: Always specify generic types for better inference
2. **Prefer Interfaces**: Use interfaces for object shapes, types for unions
3. **Document Complex Types**: Add JSDoc comments for complex type definitions
4. **Use Utility Types**: Leverage TypeScript utility types (`Partial`, `Pick`, `Omit`)

### Column Definitions

```typescript
// Good: Fully typed column definition
const nameColumn: ColumnDefinition<User, string> = {
  id: "name",
  displayName: "Full Name",
  type: "text",
  accessor: (user: User) => `${user.firstName} ${user.lastName}`,
  sortable: true,
  filterable: true,
};

// Avoid: Untyped column definition
const nameColumn = {
  id: "name",
  displayName: "Full Name",
  type: "text",
  accessor: (user) => `${user.firstName} ${user.lastName}`,
};
```

### Filter Configuration

```typescript
// Good: Type-safe filter configuration
const statusFilter: FilterConfig<string> = {
  operators: ["is", "isNot", "isAnyOf"],
  options: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  includeNull: true,
};

// Avoid: Untyped filter configuration
const statusFilter = {
  operators: ["is", "isNot"],
  options: [{ value: "active", label: "Active" }],
};
```

## Migration Guide

### Breaking Changes

When updating types, consider these migration patterns:

1. **Interface Extensions**: New optional properties are backward compatible
2. **Generic Constraints**: Adding constraints may require type updates
3. **Union Types**: Adding to union types is backward compatible
4. **Required Properties**: Making optional properties required is breaking

### Version Compatibility

- **v0.1.x**: Core type system established
- **v0.2.x**: Enhanced filter operators
- **v0.3.x**: Manager state types
- **v1.0.x**: Stable API (planned)

## Testing Types

The type system includes comprehensive tests to ensure:

1. **Type Consistency**: All types work together correctly
2. **Generic Inference**: Generic types infer correctly
3. **Operator Synchronization**: Filter operators stay in sync
4. **Adapter Compliance**: Adapter implementations match interface

Run type tests:

```bash
pnpm test -- --grep "types"
```

## Related Documentation

- [Column Builders Guide](./COLUMN_BUILDERS_GUIDE.md)
- [Manager APIs](./MANAGERS_API_REFERENCE.md)
- [Adapter Development](../adapters/ADAPTERS_ARCHITECTURE.md)
- [UI Integration](../ui/COMPONENT_REFERENCE.md)
