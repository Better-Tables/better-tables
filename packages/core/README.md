# @better-tables/core

The foundational package for Better Tables - a comprehensive, type-safe React table library. This core package provides the essential building blocks: column builders, state managers, type definitions, and utilities that power Better Tables' advanced filtering, sorting, pagination, and data management capabilities.

## Features

- 🏗️ **Fluent Column Builders** - Type-safe, declarative API for defining table columns
- 🎛️ **State Management** - Powerful managers for filters, sorting, pagination, selection, and virtualization
- 🔒 **Full TypeScript Support** - End-to-end type safety from data to UI
- 🛠️ **Utility Functions** - Helpers for filter serialization, equality checks, and column operations
- 🏭 **Factory Functions** - Convenient factories for creating column and action builders
- 📦 **Framework Agnostic** - Core logic works with any React UI library

## Installation

```bash
npm install @better-tables/core
# or
yarn add @better-tables/core
# or
pnpm add @better-tables/core
# or
bun add @better-tables/core
```

## Quick Start

### Basic Column Definition

```typescript
import { createColumnBuilder } from '@better-tables/core';

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive';
  createdAt: Date;
}

// Create a column builder for your data type
const cb = createColumnBuilder<User>();

// Define columns with a fluent API
const columns = [
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor((user) => user.name)
    .filterable()
    .sortable()
    .build(),

  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor((user) => user.email)
    .filterable()
    .sortable()
    .build(),

  cb
    .number()
    .id('age')
    .displayName('Age')
    .accessor((user) => user.age)
    .range(18, 100)
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('role')
    .displayName('Role')
    .accessor((user) => user.role)
    .options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
      { value: 'viewer', label: 'Viewer' },
    ])
    .filterable()
    .sortable()
    .build(),

  cb
    .date()
    .id('createdAt')
    .displayName('Joined')
    .accessor((user) => user.createdAt)
    .filterable()
    .sortable()
    .build(),
];
```

### Using State Managers

```typescript
import {
  FilterManager,
  SortingManager,
  PaginationManager,
  TableStateManager,
  type FilterState,
  type SortingState,
  type PaginationState,
} from '@better-tables/core';

// Initialize managers
const filterManager = new FilterManager(columns);
const sortingManager = new SortingManager(columns, { multiSort: true });
const paginationManager = new PaginationManager({ defaultPageSize: 20 });

// Or use the unified TableStateManager
const tableStateManager = new TableStateManager<User>(columns, {
  filters: [],
  pagination: { page: 1, limit: 20 },
  sorting: [],
  selectedRows: new Set(),
});

// Subscribe to state changes
const unsubscribe = tableStateManager.subscribe((event) => {
  console.log('State changed:', event.type, event.payload);
});

// Update state
filterManager.addFilter({
  columnId: 'name',
  type: 'text',
  operator: 'contains',
  values: ['John'],
});

sortingManager.toggleSort('name');
paginationManager.setPage(2);
```

### Working with Relationships

The core package works seamlessly with adapters that support relationship filtering:

```typescript
interface UserWithRelations extends User {
  profile?: {
    bio: string;
    location: string;
    website?: string;
  };
  posts?: Array<{
    id: string;
    title: string;
    views: number;
  }>;
}

const cb = createColumnBuilder<UserWithRelations>();

const columns = [
  // Direct columns
  cb.text().id('name').accessor((u) => u.name).build(),

  // One-to-one relationship
  cb
    .text()
    .id('profile.bio')
    .displayName('Bio')
    .nullableAccessor((user) => user.profile?.bio)
    .filterable()
    .build(),

  cb
    .text()
    .id('profile.location')
    .displayName('Location')
    .nullableAccessor((user) => user.profile?.location)
    .filterable()
    .build(),

  // One-to-many relationship (access first item)
  cb
    .text()
    .id('posts.title')
    .displayName('Latest Post')
    .nullableAccessor((user) => user.posts?.[0]?.title)
    .build(),
];
```

## Core Concepts

### Column Builders

Column builders provide a fluent, type-safe API for defining table columns. Each builder type supports specific features:

- **TextColumnBuilder** - Text data with search, truncation, and validation
- **NumberColumnBuilder** - Numeric data with ranges and formatting
- **DateColumnBuilder** - Date/time data with formatting and ranges
- **BooleanColumnBuilder** - Boolean values with custom labels
- **OptionColumnBuilder** - Single-select options with custom rendering
- **MultiOptionColumnBuilder** - Multi-select options

```typescript
// Text column with advanced features
cb.text()
  .id('name')
  .displayName('Full Name')
  .accessor((user) => `${user.firstName} ${user.lastName}`)
  .searchable()
  .filterable()
  .sortable()
  .truncate({ maxLength: 50, suffix: '...' })
  .build();

// Number column with range validation
cb.number()
  .id('age')
  .displayName('Age')
  .accessor((user) => user.age)
  .range(0, 120)
  .format('number')
  .filterable()
  .sortable()
  .build();

// Option column with custom rendering
cb.option()
  .id('status')
  .displayName('Status')
  .accessor((user) => user.status)
  .options([
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'red' },
  ])
  .filterable()
  .sortable()
  .build();
```

### State Managers

State managers handle different aspects of table state:

#### FilterManager

Manages filter state with support for multiple filter types and operators.

```typescript
const filterManager = new FilterManager(columns);

// Add a filter
filterManager.addFilter({
  columnId: 'name',
  type: 'text',
  operator: 'contains',
  values: ['John'],
});

// Get all filters
const filters = filterManager.getFilters();

// Remove a filter
filterManager.removeFilter('name');

// Clear all filters
filterManager.clearFilters();
```

#### SortingManager

Handles single and multi-column sorting.

```typescript
const sortingManager = new SortingManager(columns, {
  multiSort: true,
  maxSortColumns: 3,
});

// Toggle sort on a column
sortingManager.toggleSort('name');

// Set explicit sort
sortingManager.setSorting([{ columnId: 'name', direction: 'asc' }]);

// Get current sorting
const sorting = sortingManager.getSorting();
```

#### PaginationManager

Manages pagination state and calculations.

```typescript
const paginationManager = new PaginationManager({
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
});

// Navigate pages
paginationManager.setPage(2);
paginationManager.nextPage();
paginationManager.previousPage();

// Change page size
paginationManager.setPageSize(50);

// Get pagination state
const pagination = paginationManager.getPagination();
```

#### TableStateManager

Unified manager that coordinates all table state.

```typescript
const tableStateManager = new TableStateManager<User>(columns, {
  filters: [],
  pagination: { page: 1, limit: 20 },
  sorting: [],
  selectedRows: new Set(),
});

// Subscribe to all state changes
tableStateManager.subscribe((event) => {
  switch (event.type) {
    case 'filter':
      console.log('Filter changed:', event.payload);
      break;
    case 'sort':
      console.log('Sort changed:', event.payload);
      break;
    case 'pagination':
      console.log('Pagination changed:', event.payload);
      break;
  }
});

// Update multiple states at once
tableStateManager.updateState({
  filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['John'] }],
  pagination: { page: 1, limit: 20 },
});
```

### Action Builders

Create actions for bulk operations on selected rows.

```typescript
import { createActionBuilder } from '@better-tables/core';
import { Trash2 } from 'lucide-react';

const deleteAction = createActionBuilder<User>()
  .id('delete')
  .label('Delete Selected')
  .icon(Trash2)
  .variant('destructive')
  .confirmationDialog({
    title: 'Delete Users',
    description: 'Are you sure you want to delete {count} user(s)?',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    destructive: true,
  })
  .handler(async (selectedIds: string[]) => {
    // Perform deletion
    await fetch('/api/users', {
      method: 'DELETE',
      body: JSON.stringify({ ids: selectedIds }),
    });
  })
  .build();
```

### Utilities

The core package includes utility functions for common operations:

```typescript
import {
  serializeFiltersToURL,
  deserializeFiltersFromURL,
  deepEqual,
  shallowEqualArrays,
} from '@better-tables/core';

// Serialize filters for URL storage
const urlParams = serializeFiltersToURL(filters);
// Result: "filters=[{\"columnId\":\"name\",\"type\":\"text\",...}]"

// Deserialize from URL
const filters = deserializeFiltersFromURL(urlParams);

// Equality checks
const isEqual = deepEqual(obj1, obj2);
const arraysEqual = shallowEqualArrays(arr1, arr2);
```

## API Overview

### Main Exports

#### Column Builders

```typescript
import {
  TextColumnBuilder,
  NumberColumnBuilder,
  DateColumnBuilder,
  BooleanColumnBuilder,
  OptionColumnBuilder,
  MultiOptionColumnBuilder,
  ColumnBuilder,
} from '@better-tables/core';
```

#### Factory Functions

```typescript
import {
  createColumnBuilder,
  createColumnBuilders,
  createTypedColumnBuilder,
  column,
  typed,
  createActionBuilder,
  createActionBuilders,
} from '@better-tables/core';
```

#### State Managers

```typescript
import {
  FilterManager,
  SortingManager,
  PaginationManager,
  SelectionManager,
  TableStateManager,
  VirtualizationManager,
} from '@better-tables/core';
```

#### Types

```typescript
import type {
  ColumnDefinition,
  FilterState,
  FilterOperator,
  PaginationState,
  SortingState,
  SelectionState,
  VirtualizationConfig,
  TableConfig,
  TableAdapter,
} from '@better-tables/core';
```

#### Utilities

```typescript
import {
  serializeFiltersToURL,
  deserializeFiltersFromURL,
  deepEqual,
  shallowEqualArrays,
} from '@better-tables/core';
```

## Usage Examples

### Complete Example with Adapter

```typescript
import { createColumnBuilder, type FilterState, type SortingState } from '@better-tables/core';
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';

// Define columns
const cb = createColumnBuilder<User>();
const columns = [
  cb.text().id('name').accessor((u) => u.name).filterable().sortable().build(),
  cb.text().id('email').accessor((u) => u.email).filterable().build(),
];

// Create adapter
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'sqlite',
});

// Fetch data with filters and sorting
const filters: FilterState[] = [
  {
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: ['John'],
  },
];

const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];

const result = await adapter.fetchData({
  columns: ['name', 'email'],
  filters,
  sorting,
  pagination: { page: 1, limit: 20 },
});

console.log(result.data); // Array of User records
console.log(result.total); // Total count
```

### Server-Side Rendering (Next.js)

```typescript
// app/page.tsx
import type { FilterState, SortingState } from '@better-tables/core';
import { getAdapter } from '@/lib/adapter';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;

  // Parse URL params
  const page = Number.parseInt(params.page || '1', 10);
  const limit = Number.parseInt(params.limit || '10', 10);

  let filters: FilterState[] = [];
  if (params.filters) {
    filters = JSON.parse(params.filters);
  }

  let sorting: SortingState = [];
  if (params.sorting) {
    sorting = JSON.parse(params.sorting);
  }

  // Fetch data
  const adapter = await getAdapter();
  const result = await adapter.fetchData({
    columns: defaultVisibleColumns,
    pagination: { page, limit },
    filters,
    sorting,
  });

  return <Table data={result.data} totalCount={result.total} />;
}
```

## Advanced Usage

### Custom Column Renderers

```typescript
cb.text()
  .id('avatar')
  .displayName('User')
  .accessor((user) => user.name)
  .cellRenderer(({ value, row }) => (
    <div className="flex items-center gap-2">
      <img src={row.avatarUrl} alt={value} className="w-8 h-8 rounded-full" />
      <span>{value}</span>
    </div>
  ))
  .build();
```

### Nullable Accessors

```typescript
cb.text()
  .id('profile.bio')
  .displayName('Bio')
  .nullableAccessor((user) => user.profile?.bio, '-') // Default value for null
  .build();
```

### Column Truncation

```typescript
cb.text()
  .id('description')
  .displayName('Description')
  .accessor((item) => item.description)
  .truncate({
    maxLength: 100,
    suffix: '...',
    showTooltip: true, // Show full text on hover
  })
  .build();
```

### Filter Serialization for URLs

```typescript
import { serializeFiltersToURL, deserializeFiltersFromURL } from '@better-tables/core';

// Save filters to URL
const filters: FilterState[] = [
  { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
  { columnId: 'age', type: 'number', operator: 'greaterThan', values: [18] },
];

const urlParams = serializeFiltersToURL(filters);
// Use in URL: ?filters=[{...}]

// Restore from URL
const restoredFilters = deserializeFiltersFromURL(urlParams);
```

## Documentation

For detailed documentation, see:

- **[User Guide](../../docs/core/USER_GUIDE.md)** - Complete feature reference and usage patterns
- **[Column Builders Guide](../../docs/core/COLUMN_BUILDERS_GUIDE.md)** - Deep dive into column configuration
- **[Managers API Reference](../../docs/core/MANAGERS_API_REFERENCE.md)** - State management API documentation
- **[Types API Reference](../../docs/core/TYPES_API_REFERENCE.md)** - Complete type definitions
- **[Utilities API Reference](../../docs/core/UTILITIES_API_REFERENCE.md)** - Utility function documentation
- **[Architecture](../../docs/core/ARCHITECTURE.md)** - Design decisions and system overview

## Examples

See the [demo app](../../apps/demo) for a complete working example:

- **Column Definitions**: [apps/demo/lib/columns/user-columns.tsx](../../apps/demo/lib/columns/user-columns.tsx)
- **Action Builders**: [apps/demo/lib/actions/user-actions.tsx](../../apps/demo/lib/actions/user-actions.tsx)
- **Integration**: [apps/demo/components/users-table-client.tsx](../../apps/demo/components/users-table-client.tsx)

## TypeScript Support

The core package is built with TypeScript and provides full type safety:

```typescript
// Type inference from accessors
const cb = createColumnBuilder<User>();

// Accessor types are inferred
cb.text()
  .id('name')
  .accessor((user) => user.name) // TypeScript knows user is User
  .build();

// Column definitions are fully typed
const columns: ColumnDefinition<User>[] = [
  // TypeScript will error if accessor doesn't match User type
];
```

## Contributing

Contributions are welcome! This is an open-source project, and we appreciate any help you can provide.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bun test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Areas We Need Help

- **Documentation**: Improving guides and examples
- **Tests**: Adding more test coverage
- **Performance**: Optimizing state management
- **Type Safety**: Enhancing TypeScript types
- **Utilities**: Adding helpful utility functions

See [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Related Packages

- **[@better-tables/ui](../../packages/ui)** - React components built on top of core
- **[@better-tables/adapters-drizzle](../../packages/adapters/drizzle)** - Drizzle ORM adapter
- **[Demo App](../../apps/demo)** - Complete working example

## Support

- **GitHub Issues** - Report bugs or request features
- **GitHub Discussions** - Ask questions and share ideas
- **Documentation** - Comprehensive guides in the `docs/` directory

---

Built with ❤️ by the Better Tables team. This package is part of the [Better Tables](https://github.com/Better-Tables/better-tables) project.

