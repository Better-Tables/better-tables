# Better Tables

A comprehensive React table library with advanced filtering, sorting, and database adapter support.

## 🚀 Features

- **Type-safe column definitions** with fluent builders
- **Database-agnostic** through adapter pattern
- **Advanced filtering** with 5 filter types and 20+ operators
- **Server-side and client-side** strategies
- **Declarative configuration** - define schema once, get full functionality
- **Built-in UI components** with customizable themes
- **URL state persistence** for shareable filtered views
- **Bulk operations** and export functionality

## 📦 Packages

This monorepo contains the following packages:

- `@better-tables/core` - Core functionality and React components
- `@better-tables/ui` - UI components and themes
- `@better-tables/drizzle` - Drizzle ORM adapter
- `@better-tables/rest` - REST API adapter
- `@better-tables/memory` - In-memory adapter for demos
- `@better-tables/pro` - Premium features (commercial)

## 🏗️ Project Structure

```
better-tables/
├── packages/
│   ├── core/          # Core functionality
│   ├── ui/            # UI components
│   ├── adapters/      # Database adapters
│   └── pro/           # Premium features
├── apps/              # Demo applications
├── examples/          # Usage examples
├── docs/              # Documentation
└── tools/             # Build tools
```

## 🛠️ Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development mode
pnpm dev
```

### Available Scripts

- `pnpm build` - Build all packages
- `pnpm dev` - Start development mode
- `pnpm test` - Run tests
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm clean` - Clean build artifacts

## 📚 Quick Start

```typescript
import { Table, createColumnBuilder, createDrizzleAdapter } from '@better-tables/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { contacts } from './schema';

// Create adapter
const adapter = createDrizzleAdapter({
  db: drizzle(connectionString),
  table: contacts,
});

// Define columns
const cb = createColumnBuilder<Contact>();

const columns = [
  cb.text()
    .id('name')
    .displayName('Full Name')
    .accessor(contact => `${contact.firstName} ${contact.lastName}`)
    .searchable()
    .build(),
    
  cb.option()
    .id('status')
    .displayName('Status')
    .accessor(contact => contact.status)
    .options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ])
    .build(),
];

// Render table
function ContactsTable() {
  return (
    <Table
      config={{
        id: 'contacts',
        name: 'Contacts',
        columns,
        adapter,
      }}
    />
  );
}
```

## 📖 Documentation

Full documentation is available at [https://better-tables.dev](https://better-tables.dev) (coming soon).

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs. 