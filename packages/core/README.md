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
import { betterTables, defineTable } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

export const tables = betterTables({ database: drizzleAdapter(db) });

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name').displayName('Name').filterable().sortable(),
    t.text('email').displayName('Email').filterable().sortable(),
    t.number('age').displayName('Age').range(18, 100).filterable().sortable(),
    t
      .option('role')
      .displayName('Role')
      .options([
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
        { value: 'viewer', label: 'Viewer' },
      ])
      .filterable()
      .sortable(),
    t.date('createdAt').displayName('Joined').filterable().sortable(),
  ],
}));
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
export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name'),
    t.text('profile.bio').filterable(),
    t.text('profile.location').filterable(),
    t.text('posts.title').displayName('Latest Post'),
  ],
}));
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
defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t
      .computed('fullName', (user) => `${user.firstName} ${user.lastName}`)
      .displayName('Full Name')
      .searchable()
      .filterable()
      .sortable()
      .truncate({ maxLength: 50, suffix: '...' }),
    t.number('age').displayName('Age').range(0, 120).format('number').filterable().sortable(),
    t
      .option('status')
      .displayName('Status')
      .options([
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'inactive', label: 'Inactive', color: 'red' },
      ])
      .filterable()
      .sortable(),
  ],
}));
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

// Serialize filters for URL storage (compressed with lz-string)
const urlParams = serializeFiltersToURL(filters);
// Result: "c:..." (compressed URL-safe string, prefixed with "c:")

// Deserialize from URL (expects compressed format)
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

#### Flagship API (0.6+)

```typescript
import { betterTables, defineTable, defineTableRow, defineColumns } from '@better-tables/core';
```

For hand-built columns without a schema, use the builder classes (`TextColumnBuilder`, …) with `defineColumns` and `defineTableRow`, or run the whole pipeline in memory with `memoryAdapter(rows)`.

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
import { betterTables, defineTable, type FilterState, type SortingState } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

export const tables = betterTables({ database: drizzleAdapter(db) });

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name').filterable().sortable(),
    t.text('email').filterable(),
  ],
}));

const filters: FilterState[] = [
  { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
];

const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];

const result = await tables.fetchData(usersTable, {
  columns: ['name', 'email'],
  filters,
  sorting,
  pagination: { page: 1, limit: 20 },
});

console.log(result.data);
console.log(result.total);
```

### Server-Side Rendering (Next.js)

```typescript
// app/page.tsx
import type { FilterState, SortingState } from '@better-tables/core';
import { deserializeFiltersFromURL } from '@better-tables/core';
import { decompressAndDecode } from '@better-tables/core';
import { getAdapter } from '@/lib/adapter';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;

  // Parse URL params
  const page = Number.parseInt(params.page || '1', 10);
  const limit = Number.parseInt(params.limit || '10', 10);

  // Deserialize filters (compressed format, prefixed with "c:")
  let filters: FilterState[] = [];
  if (params.filters) {
    try {
      filters = deserializeFiltersFromURL(params.filters);
    } catch {
      // Invalid or corrupted filter data, use empty array
      filters = [];
    }
  }

  // Deserialize sorting (compressed format, prefixed with "c:")
  let sorting: SortingState = [];
  if (params.sorting) {
    try {
      sorting = decompressAndDecode<SortingState>(params.sorting);
    } catch {
      // Invalid or corrupted sorting data, use empty array
      sorting = [];
    }
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
t.text('name')
  .displayName('User')
  .cellRenderer(({ value, row }) => (
    <div className="flex items-center gap-2">
      <img src={row.avatarUrl} alt={value} className="w-8 h-8 rounded-full" />
      <span>{value}</span>
    </div>
  )),
```

### Nullable Accessors

```typescript
t.text('profile.bio').displayName('Bio').searchable({ includeNull: true }),
```

### Column Truncation

```typescript
t.text('description')
  .displayName('Description')
  .truncate({
    maxLength: 100,
    suffix: '...',
    showTooltip: true,
  }),
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
// Use in URL: ?filters=c:... (compressed format, prefixed with "c:")

// Restore from URL (must be compressed format)
const restoredFilters = deserializeFiltersFromURL(urlParams);
```

## Documentation

For detailed documentation, see:

- **[HTTP Adapter](./docs/HTTP_ADAPTER.md)** - Browser `httpAdapter` + server `createAdapterRouteHandler`
- **[wiki.md](../../wiki.md)** - Lean 0.6 handbook
- **[Drizzle adapter](../adapters/drizzle/README.md)** - Database adapter reference

## Examples

See the [live demo in the marketing site](../../apps/marketing) for a complete working example:

- **Column Definitions**: [apps/marketing/src/lib/demo/support/columns.tsx](../../apps/marketing/src/lib/columns/user-columns.tsx)
- **Action Builders**: [apps/marketing/src/lib/actions/user-actions.tsx](../../apps/marketing/src/lib/actions/user-actions.tsx)
- **Integration**: [apps/marketing/src/components/sections/users-table-client.tsx](../../apps/marketing/src/components/sections/users-table-client.tsx)

## TypeScript Support

The core package is built with TypeScript and provides full type safety:

```typescript
export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [t.text('name')],
}));

type UserRow = typeof usersTable.$infer.Row;
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

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Related Packages

- **[@better-tables/ui](../../packages/ui)** - React components built on top of core
- **[@better-tables/adapters-drizzle](../../packages/adapters/drizzle)** - Drizzle ORM adapter
- **[Live Demo](../../apps/marketing)** - Marketing site with interactive table demo

## Support

- **GitHub Issues** - Report bugs or request features
- **GitHub Discussions** - Ask questions and share ideas
- **Documentation** - See [wiki.md](../../wiki.md) and [better-tables.com/docs](https://better-tables.com/docs)

---

Built with ❤️ by the Better Tables team. This package is part of the [Better Tables](https://github.com/Better-Tables/better-tables) project.

