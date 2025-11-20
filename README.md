# Better Tables

> **Type-safe, database-agnostic table library for React** with advanced filtering, sorting, and virtual scrolling. Stop writing boilerplate. Start shipping features.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

Better Tables is the React table library you wished existed. Define your columns once, and get powerful filtering, sorting, pagination, and virtualization—all with end-to-end type safety across your database queries and UI components.

---

## 🎯 Why Better Tables?

Building complex data tables should be **simple**. Not a soul-crushing mix of useState hooks, prop drilling, and scattered utility functions.

### The Problem

Most table libraries ask you to:
- Wire up filtering logic across multiple files
- Manually handle joins and relationships in your queries
- Write the same filter UI components over and over
- Manually sync URL state for shareable views
- Give up type safety between your database and UI
- Rebuild pagination and sorting logic for every project

### The Solution

Better Tables revolutionizes how you work with relational data:

- **Automatic Relationships**: Filter across joined tables without writing JOIN queries yourself
- **Database Adapters**: Define your schema once—filters automatically work across relationships
- **Type-Safe End-to-End**: From your database query to your UI component, full type inference
- **Zero Boilerplate**: Declarative column definitions give you filtering, sorting, and pagination automatically

### The Magic: Adapters + Relationships

The real power comes from how Better Tables handles relationships automatically:

```tsx
// You define columns that access related data
const columns = [
  cb.text().id('name').accessor(u => u.name).build(),
  // This automatically creates the JOIN and filters work on it!
  cb.text().id('profile.location').accessor(u => u.profile?.location).build(),
  cb.text().id('posts.title').accessor(u => u.posts?.[0]?.title).build(),
];

// The Drizzle adapter automatically:
// 1. Detects the relationships
// 2. Builds the JOIN queries
// 3. Applies filters across tables
// 4. Maintains type safety throughout
```

No manual query building. No JOIN syntax to memorize. Just define your columns, and Better Tables handles the rest.

---

## 🚀 Quick Start

### Installation

```bash
# Core package
bun add @better-tables/core

# Choose an adapter
bun add @better-tables/adapters-drizzle  # or @better-tables/adapters-rest
```

### Your First Table

```tsx
import { BetterTable } from '@better-tables/ui';
import { createColumnBuilder } from '@better-tables/core';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive';
}

const cb = createColumnBuilder<User>();

const columns = [
  cb.text().id('name').displayName('Name').accessor(u => u.name).build(),
  cb.text().id('email').displayName('Email').accessor(u => u.email).build(),
  cb.option().id('role').displayName('Role').accessor(u => u.role)
    .options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
      { value: 'viewer', label: 'Viewer' },
    ]).build(),
];

function UserTable() {
  return (
    <BetterTable
      columns={columns}
      data={users}
      features={{
        filtering: true,
        sorting: true,
        pagination: true,
        rowSelection: true,
      }}
    />
  );
}
```

*That's it.* You now have a fully functional table with filtering, sorting, pagination, and row selection. No boilerplate, no prop drilling, no headaches.

---

## 💎 Key Features

### Automatic Relationship Filtering

The crown jewel of Better Tables: filter across relationships without writing JOIN queries.

```tsx
// Define columns that touch multiple tables
const columns = [
  cb.text().id('name').accessor(u => u.name).build(),
  cb.text().id('profile.location').accessor(u => u.profile?.location).build(),
  cb.number().id('posts.count').accessor(u => u.posts?.length || 0).build(),
];

// Filter by location - automatically creates the JOIN!
// SELECT users.*, profiles.location 
// FROM users 
// LEFT JOIN profiles ON profiles.user_id = users.id
// WHERE profiles.location = 'San Francisco'
```

The adapter handles all the complexity: detecting relationships, building JOINs, applying filters across tables, and maintaining type safety throughout.

### Advanced Filtering System

Six filter types with 20+ operators. Filters persist in the URL, making every view shareable.

**Supported Filter Types:**
- Text (contains, equals, startsWith, regex)
- Number (equals, greaterThan, between)
- Date (is, before, after, between)
- Option (is, isNot, isAnyOf)
- Multi-Option (includes, excludes)
- Boolean (isTrue, isFalse)

```tsx
// Filters automatically work with your database adapter
<BetterTable
  columns={columns}
  data={users}
  features={{ filtering: true }}  // Full filter UI automatically included
/>
```

> [📸 **Screenshot: Filter UI with multiple filter types**]

### Database Adapters

Connect to any backend with a consistent API. No vendor lock-in.

#### Drizzle Adapter
```tsx
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { db, users } from './db';

const adapter = new DrizzleAdapter({
  db,
  schema: users,
  autoDetectRelationships: true,
});

// Automatically handles joins, filtering, sorting, and pagination
const result = await adapter.fetchData({
  pagination: { page: 1, limit: 20 },
  filters: [{ columnId: 'status', operator: 'equals', values: ['active'] }],
  sorting: [{ columnId: 'name', direction: 'asc' }],
});
```

#### REST Adapter
```tsx
import { RestAdapter } from '@better-tables/adapters-rest';

const adapter = new RestAdapter({
  baseUrl: '/api/users',
  headers: { Authorization: `Bearer ${token}` },
});
```

### Virtual Scrolling for Large Datasets

Render millions of rows efficiently with built-in virtualization.

```tsx
<VirtualizedTable
  data={largeDataset}
  columns={columns}
  height={600}
  rowHeight={52}
  overscan={5}
/>
```

> [📸 **GIF: Smooth scrolling through 100k+ rows**]

### URL State Persistence

Every filter, sort, and pagination state syncs to the URL. Users can bookmark and share filtered views.

```tsx
// URL: /users?page=2&filters=[{"columnId":"role","values":["admin"]}]

// Opening that URL loads the exact same filter and pagination state
```

> [📸 **Screenshot: Browser URL bar showing filter state**]

### Declarative Column Configuration

Build complex tables with a fluent, type-safe API.

```tsx
const columns = [
  // Text column with search
  cb.text()
    .id('name')
    .displayName('Full Name')
    .accessor(user => `${user.firstName} ${user.lastName}`)
    .searchable()
    .sortable()
    .build(),

  // Option column with badges
  cb.option()
    .id('status')
    .accessor(u => u.status)
    .options([
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'inactive', label: 'Inactive', color: 'red' },
    ])
    .showBadges({ variant: 'default' })
    .build(),

  // Custom cell renderer
  cb.text()
    .id('actions')
    .accessor(() => null)
    .cellRenderer(({ row }) => (
      <DropdownMenu>
        <DropdownMenuItem onClick={() => editUser(row.id)}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => deleteUser(row.id)}>Delete</DropdownMenuItem>
      </DropdownMenu>
    ))
    .build(),
];
```

> [📸 **Screenshot: Table showing text search, option filters, and custom action cells**]

---

## 🏗️ Architecture

Better Tables is built as a monorepo with clear separation of concerns:

```
better-tables/
├── packages/
│   ├── core/              # Type system, builders, managers
│   ├── ui/                # React components & hooks
│   └── adapters/          # Database adapters
│       ├── drizzle/       # Drizzle ORM integration
│       │   ├── relationship-detector.ts
│       │   ├── query-builder.ts     # Automatic JOIN generation
│       │   └── schema-inference.ts  # Detect relationships
│       ├── memory/        # In-memory adapter (testing)
│       └── rest/         # REST API adapter (coming soon)
├── apps/
│   └── demo/             # Live demo application
└── docs/                 # Comprehensive documentation
```

### Package Overview

- **@better-tables/core** - Type-safe builders, managers, and utilities
- **@better-tables/ui** - Production-ready React components with shadcn/ui
- **@better-tables/adapters-drizzle** - **Automatic relationship detection and JOIN generation**
- **@better-tables/adapters-memory** - In-memory adapter for testing and demos

### How Automatic Relationships Work

The Drizzle adapter uses sophisticated relationship detection:

1. **Schema Introspection**: Analyzes your Drizzle schema to find relationships
2. **Relationship Mapping**: Automatically maps one-to-one, one-to-many, and many-to-many relationships
3. **Query Generation**: Builds optimized JOIN queries based on accessed columns
4. **Filter Translation**: Converts UI filters into SQL WHERE clauses across joined tables
5. **Type Safety**: Maintains TypeScript types throughout the entire query chain

When you reference `user.profile.location` in a column, the adapter:
- Detects the `user` → `profile` relationship
- Identifies the foreign key
- Generates the appropriate JOIN
- Applies filters to the joined table
- Returns fully type-safe results

Each package is independently versioned and can be used standalone or together.

---

## 📖 Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** - Installation and basic setup
- **[User Guide](docs/core/USER_GUIDE.md)** - Complete feature reference
- **[Architecture](docs/ARCHITECTURE.md)** - Design decisions and system overview
- **[API Reference](docs/core/TYPES_API_REFERENCE.md)** - Complete API documentation
- **[Contributing](docs/CONTRIBUTING.md)** - How to contribute to Better Tables

### Quick Links

- [Column Builders Guide](docs/core/COLUMN_BUILDERS_GUIDE.md)
- [Adapters Architecture](docs/adapters/ADAPTERS_ARCHITECTURE.md)
- [Filter Components Reference](docs/ui/FILTER_COMPONENTS_REFERENCE.md)
- [State Management](docs/STATE_MANAGEMENT_ARCHITECTURE.md)

---

## 🎨 Examples

### Cross-Table Filtering (The Magic Feature)

Filter across relationships without writing SQL JOINs. This is what sets Better Tables apart.

```tsx
// Define columns that span multiple tables
const columns = [
  cb.text().id('name').accessor(u => u.name).build(),
  cb.text().id('profile.location').accessor(u => u.profile?.location).build(),
  cb.number().id('posts.count').accessor(u => u.posts?.length || 0).build(),
  cb.text().id('profile.website').accessor(u => u.profile?.website).build(),
];

// User filters by "profile.location" - automatic JOIN generated
// User filters by "posts.count" - automatic COUNT and JOIN
// All handled by the adapter, zero query writing required

<BetterTable 
  columns={columns} 
  adapter={drizzleAdapter}
  features={{ filtering: true, sorting: true }}
/>
```

The adapter automatically:
- Detects relationships from your schema
- Builds appropriate JOIN queries
- Applies filters across joined tables  
- Handles pagination and sorting on joined data
- Maintains full type safety

> [📸 **Screenshot: Table showing users with their profile location and post counts, with filters applied**]

### Filtering with Multiple Types

```tsx
const columns = [
  cb.text().id('name').accessor(u => u.name).searchable().build(),
  cb.number().id('age').accessor(u => u.age).range(18, 100).build(),
  cb.option().id('role').accessor(u => u.role).options([
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' },
  ]).build(),
  cb.date().id('joined').accessor(u => u.joinedAt)
    .dateRange({ includeNull: false }).build(),
];

// Automatically generates appropriate filter UIs for each type
<BetterTable columns={columns} data={users} features={{ filtering: true }} />
```

> [📸 **Screenshot: Filter bar showing text input, number range, select dropdown, and date picker**]

### Custom Cell Rendering

```tsx
cb.text()
  .id('avatar')
  .displayName('User')
  .accessor(u => u.name)
  .cellRenderer(({ value, row }) => (
    <div className="flex items-center gap-2">
      <img src={row.avatarUrl} alt={value} className="w-8 h-8 rounded-full" />
      <span>{value}</span>
    </div>
  ))
  .build(),
```

> [📸 **Screenshot: Table row with custom avatar cell**]

---

## 🤝 Contributing

Better Tables is in active development, and we'd love your help! Whether you're fixing bugs, adding features, or improving docs, every contribution makes the library better.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bun run test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Areas We Need Help

- **Adapter Development**: REST adapter implementation
- **Examples**: More real-world use cases
- **Documentation**: Better guides and tutorials
- **Performance**: Optimization for even larger datasets
- **Accessibility**: WCAG compliance improvements

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

---

## 🛣️ Roadmap

### Current Status (v0.1)

- ✅ Core type system and builders
- ✅ Complete filter manager with 6 filter types
- ✅ Drizzle adapter with relationship detection
- ✅ UI components with shadcn/ui
- ✅ Virtual scrolling support
- ✅ URL state persistence
- ✅ Server-side rendering support (Next.js)

### Coming Next (v0.2)

- [ ] REST adapter
- [ ] Bulk operations API
- [ ] Export functionality (CSV, Excel)
- [ ] Saved filter presets
- [ ] Advanced column customization
- [ ] Performance benchmarks and optimization

### Future (v1.0)

- [ ] GraphQL adapter
- [ ] Real-time updates via WebSockets
- [ ] Advanced analytics and aggregations
- [ ] Plugin system for custom features
- [ ] Official examples for Remix, Vite, CRA

---

## 📦 Package Status

| Package | Status | Description |
|---------|--------|-------------|
| `@better-tables/core` | ✅ Ready | Core functionality and types |
| `@better-tables/ui` | ✅ Ready | React components and hooks |
| `@better-tables/adapters-drizzle` | ✅ Ready | Drizzle ORM integration |
| `@better-tables/adapters-memory` | ✅ Ready | In-memory testing adapter |
| `@better-tables/adapters-rest` | 🚧 In Progress | REST API adapter |
| `@better-tables/pro` | 📋 Planned | Premium features |

---

## 🙏 Acknowledgments

Better Tables is inspired by and built with:

- [TanStack Table](https://tanstack.com/table) - For the excellent query API
- [shadcn/ui](https://ui.shadcn.com) - Beautiful, accessible components
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database queries
- [Radix UI](https://www.radix-ui.com) - Primitives for accessible components
- [Zustand](https://github.com/pmndrs/zustand) - Simple state management

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 💬 Questions?

- **GitHub Discussions** - Ask questions and share ideas
- **Issues** - Report bugs or request features
- **Contributing** - Read our contribution guide

Built with ❤️ by the Better Tables team.