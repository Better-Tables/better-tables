# Better Tables

> **Type-safe, database-agnostic table library for React** with advanced filtering, sorting, and virtual scrolling. Stop writing boilerplate. Start shipping features.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19+-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

Better Tables is the React table library you wished existed. Define your columns once, and get powerful filtering, sorting, pagination, and virtualization-all with end-to-end type safety across your database queries and UI components.

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
- **Database Adapters**: Define your schema once-filters automatically work across relationships
- **Type-Safe End-to-End**: From your database query to your UI component, full type inference
- **Zero Boilerplate**: Declarative column definitions give you filtering, sorting, and pagination automatically

### The Magic: Adapters + Relationships

The real power comes from how Better Tables handles relationships automatically:

```tsx
import { betterTables, defineTable } from '@better-tables/core';

export const tables = betterTables({ database: drizzleAdapter(db) });

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name'),
    t.text('profile.location'),
    t.text('posts.title'),
  ],
}));

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
bun add @better-tables/adapters-drizzle
```

The UI components aren't published to npm — they're copied directly into your project with the CLI (shadcn-style), so you own and can customize the source:

```bash
bunx @better-tables/cli init
```

`init` requires an existing [shadcn/ui](https://ui.shadcn.com) setup (`components.json`) and copies the table/filter components, hooks, and stores into your project (default: `components/better-tables-ui/`), rewriting imports to match your project's aliases. See [`@better-tables/cli`](packages/cli/README.md) for options.

### Your First Table

Upgrading from 0.5? See [MIGRATION.md](MIGRATION.md) for the flagship `betterTables()` + `defineTable()` API.

```tsx
import { BetterTable } from '@/components/better-tables-ui/table/table';
import { betterTables, defineTable } from '@better-tables/core';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

export const tables = betterTables({ database: drizzleAdapter(db) });

export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name').displayName('Name').filterable().sortable(),
    t.text('email').displayName('Email').filterable().sortable(),
    t.option('role').displayName('Role').options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
      { value: 'viewer', label: 'Viewer' },
    ]).filterable().sortable(),
  ],
}));

function UserTable() {
  return (
    <BetterTable
      columns={usersTable.columns}
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

### Inline cell editing

Mark a column `.editable()` and the table mounts a type-aware in-cell editor (text, number, option, boolean, date). Saves go through the adapter's `updateRecord` when `features.update` is on, or through an `onCellEdit` callback (required for `httpAdapter`). Optimistic UI with rollback on failure; column `validation` rules run before any write.

```tsx
t.text('subject').editable()
t.option('status').options([...]).editable()

<BetterTable table={ticketsTable} data={rows} adapter={adapter} />
```

### Automatic Relationship Filtering

The crown jewel of Better Tables: filter across relationships without writing JOIN queries.

```tsx
export const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name'),
    t.text('profile.location'),
    t.computed('posts_count', (u) => u.posts?.length ?? 0).displayName('Posts'),
  ],
}));

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
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { FilterState, SortingState } from '@better-tables/core';

// Set up your Drizzle database (schema and relations included)
const db = drizzle(sqlite, { schema: { users, profiles, usersRelations } });

// Create adapter - automatically detects schema and driver
const adapter = drizzleAdapter(db);

// Automatically handles joins, filtering, sorting, and pagination
const filters: FilterState[] = [
  { columnId: 'status', type: 'option', operator: 'is', values: ['active'] }
];
const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];

const result = await adapter.fetchData({
  columns: ['name', 'email', 'status'],
  pagination: { page: 1, limit: 20 },
  filters,
  sorting,
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
defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.computed('fullName', (user) => `${user.firstName} ${user.lastName}`)
      .displayName('Full Name')
      .searchable()
      .sortable(),
    t.option('status')
      .options([
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'inactive', label: 'Inactive', color: 'red' },
      ])
      .showBadges({ variant: 'default' }),
    t.custom()
      .id('actions')
      .displayName('Actions')
      .accessor(() => null)
      .cellRenderer(({ row }) => (
        <DropdownMenu>
          <DropdownMenuItem onClick={() => editUser(row.id)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => deleteUser(row.id)}>Delete</DropdownMenuItem>
        </DropdownMenu>
      ))
      .build(),
  ],
}));
```

> [📸 **Screenshot: Table showing text search, option filters, and custom action cells**]

---

## 🏗️ Architecture

Better Tables is built as a monorepo with clear separation of concerns:

```
better-tables/
├── packages/
│   ├── core/              # Type system, builders, managers
│   ├── ui/                # React components & hooks (distributed via the CLI)
│   ├── cli/               # `better-tables init` - copies ui components into your project
│   └── adapters/          # Database adapters
│       └── drizzle/       # Drizzle ORM integration
│           ├── relationship-detector.ts
│           ├── query-builder.ts     # Automatic JOIN generation
│           └── schema-inference.ts  # Detect relationships
└── apps/
    └── demo/             # Live demo application
```

### Package Overview

- **@better-tables/core** - Type-safe builders, managers, and utilities
- **@better-tables/ui** - Production-ready React components with shadcn/ui, copied into your project via the CLI
- **@better-tables/cli** - `better-tables init` - copies and wires up the UI components
- **@better-tables/adapters-drizzle** - **Automatic relationship detection and JOIN generation**
- **@better-tables/adapters-toolkit** - ORM-agnostic adapter primitives (for adapter authors)

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

**Canonical docs:** [better-tables.com/docs](https://better-tables.com/docs) (source: `apps/marketing/content/docs/`).

Local preview: `cd apps/marketing && bun run dev` → http://localhost:3000/docs

- **[Quick Start](https://better-tables.com/docs/quick-start)** - Install, define a table, fetch rows
- **[Migrating from 0.5 to 0.6](MIGRATION.md)** - Upgrading a 0.5 app? Start here.
- **[@better-tables/core](packages/core/README.md)** - Core package with builders and managers
- **[@better-tables/ui](packages/ui/README.md)** - React components and hooks (CLI copy)
- **[@better-tables/cli](packages/cli/README.md)** - The `init` / `docs` commands
- **[@better-tables/adapters-drizzle](packages/adapters/drizzle/README.md)** - Drizzle ORM adapter
- **[Live Examples](https://better-tables.com/examples)** - Relationship filters, query groups, facets, big board
- **AI indexes** — `/llms.txt`, `/llms-full.txt` on the site

---

## 🎨 Examples

> **💡 Tip**: Scroll to the live demo on the [marketing site](apps/marketing) or run `cd apps/marketing && bun run dev` locally.

### Cross-Table Filtering (The Magic Feature)

Filter across relationships without writing SQL JOINs. This is what sets Better Tables apart.

```tsx
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables, defineTable } from '@better-tables/core';

const db = drizzle(sqlite, { schema: { users, profiles, posts, usersRelations } });
const tables = betterTables({ database: drizzleAdapter(db) });

const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name'),
    t.text('profile.location'),
    t.computed('posts_count', (u) => u.posts?.length ?? 0).displayName('Posts'),
    t.text('profile.website'),
  ],
}));

<BetterTable
  columns={usersTable.columns}
  adapter={tables.database}
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
const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [
    t.text('name').searchable(),
    t.number('age').range(18, 100),
    t.option('role').options([
      { value: 'admin', label: 'Admin' },
      { value: 'editor', label: 'Editor' },
    ]),
    t.date('joinedAt').displayName('Joined').dateRange({ includeNull: false }),
  ],
}));

<BetterTable columns={usersTable.columns} data={users} features={{ filtering: true }} />
```

> [📸 **Screenshot: Filter bar showing text input, number range, select dropdown, and date picker**]

### Custom Cell Rendering

```tsx
t.text('name')
  .displayName('User')
  .cellRenderer(({ value, row }) => (
    <div className="flex items-center gap-2">
      <img src={row.avatarUrl} alt={value} className="w-8 h-8 rounded-full" />
      <span>{value}</span>
    </div>
  )),
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

See the "How to Contribute" steps above, and open an issue first for larger changes.

---

## 🛣️ Roadmap

### Current Status (v0.5)

- ✅ Core type system and builders
- ✅ Complete filter manager with 6 filter types
- ✅ Drizzle adapter with automatic relationship detection
- ✅ Factory function for easy adapter creation
- ✅ UI components with shadcn/ui
- ✅ Virtual scrolling support
- ✅ URL state persistence
- ✅ Server-side rendering support (Next.js)
- ✅ Action builders for bulk operations
- ✅ Primary table resolution for complex schemas

### Coming Next (v0.6+)

- [ ] REST adapter
- [ ] Export functionality (CSV, Excel)
- [ ] Saved filter presets
- [ ] Advanced column customization
- [ ] Performance benchmarks and optimization
- [ ] Enhanced documentation and examples

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
| `@better-tables/ui` | ✅ Ready | React components and hooks, distributed via the CLI (not on npm) |
| `@better-tables/cli` | ✅ Ready | `better-tables init` - copies UI components into your project |
| `@better-tables/adapters-drizzle` | ✅ Ready | Drizzle ORM integration |
| `@better-tables/adapters-toolkit` | ✅ Ready | ORM-agnostic adapter primitives |

### Roadmap (not yet started)

- REST API adapter
- In-memory adapter for testing and demos
- A premium/pro features package

---

## 🙏 Acknowledgments

Better Tables is inspired by and built with:

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