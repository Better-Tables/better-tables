# Contributing to Better Tables

## Overview

Thank you for your interest in contributing to Better Tables! This guide will help you get started with development, understand our coding standards, and contribute effectively to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Code of Conduct](#code-of-conduct)

## Getting Started

### Prerequisites

- Node.js 18+
- Bun 1.3+
- Git
- Code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/Better-Tables/better-tables.git
cd better-tables
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/originalowner/better-tables.git
```

## Development Setup

### Install Dependencies

```bash
# Install all dependencies
bun install

# Install dependencies for specific package
cd packages/core
bun install
```

### Development Scripts

```bash
# Build all packages
bun run build

# Build specific package
cd packages/core && bun run build

# Run tests
bun run test

# Run tests for specific package
cd packages/core && bun run test

# Run linting
bun run lint

# Run type checking
bun --filter @better-tables/core type-check

# Start development mode
bun run dev
```

### Environment Setup

1. **VS Code Extensions** (recommended):

   - TypeScript and JavaScript Language Features
   - Biome
   - Tailwind CSS IntelliSense

2. **VS Code Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Project Structure

### Monorepo Structure

```
better-tables/
├── packages/
│   ├── core/                 # Core functionality
│   │   ├── src/
│   │   │   ├── types/        # Type definitions
│   │   │   ├── builders/     # Column builders
│   │   │   ├── managers/     # State managers
│   │   │   └── utils/        # Utility functions
│   │   ├── tests/            # Unit tests
│   │   └── package.json
│   ├── ui/                   # React components
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── hooks/        # Custom hooks
│   │   │   └── lib/          # Utilities
│   │   ├── tests/            # Component tests
│   │   └── package.json
│   └── adapters/             # Data adapters
│       ├── drizzle/
│       ├── memory/
│       └── rest/
├── apps/                     # Demo applications
├── docs/                     # Documentation
├── examples/                 # Code examples
├── package.json              # Root package.json
└── turbo.json               # Turborepo configuration
```

### Package Dependencies

- **Core Package**: No external dependencies (except React peer deps)
- **UI Package**: Depends on `@better-tables/core`, Radix UI, Tailwind CSS
- **Adapter Packages**: Depends on `@better-tables/core`, specific libraries

## Coding Standards

### TypeScript Guidelines

#### 1. Type Safety

```typescript
// ✅ Good: Explicit types
interface User {
  id: string;
  name: string;
  email: string;
}

const createUser = (data: Partial<User>): User => {
  return {
    id: generateId(),
    name: data.name || "",
    email: data.email || "",
  };
};

// ❌ Avoid: Any types
const createUser = (data: any): any => {
  return data;
};
```

#### 2. Generic Types

```typescript
// ✅ Good: Generic constraints
interface ColumnDefinition<TData = any> {
  id: string;
  accessor: (data: TData) => any;
}

function createColumn<TData>(
  config: ColumnDefinition<TData>
): ColumnDefinition<TData> {
  return config;
}

// ❌ Avoid: Loose generics
function createColumn<T>(config: any): any {
  return config;
}
```

#### 3. Type Guards

```typescript
// ✅ Good: Type guards for runtime safety
function isTextColumn<TData>(
  column: ColumnDefinition<TData>
): column is TextColumnDefinition<TData> {
  return column.type === "text";
}

// Usage
if (isTextColumn(column)) {
  // TypeScript knows column is TextColumnDefinition
  console.log(column.searchable);
}
```

### React Guidelines

#### 1. Component Structure

```typescript
// ✅ Good: Clear component structure
interface ComponentProps {
  data: any[];
  onSelect: (item: any) => void;
}

export function Component({ data, onSelect }: ComponentProps) {
  // Hooks at the top
  const [selected, setSelected] = useState<any[]>([]);

  // Event handlers
  const handleSelect = useCallback(
    (item: any) => {
      setSelected((prev) => [...prev, item]);
      onSelect(item);
    },
    [onSelect]
  );

  // Render
  return (
    <div>
      {data.map((item) => (
        <div
          key={item.id}
          onClick={() => handleSelect(item)}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

#### 2. Hooks Usage

```typescript
// ✅ Good: Custom hooks for reusable logic
function useTableData<TData>(config: UseTableDataConfig<TData>) {
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await config.adapter.fetchData(config.params);
      setData(result.data);
    } finally {
      setLoading(false);
    }
  }, [config.adapter, config.params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
```

#### 3. Performance Optimization

```typescript
// ✅ Good: Memoization for expensive operations
const ExpensiveComponent = memo(({ data, onUpdate }: Props) => {
  const processedData = useMemo(() => {
    return data.map((item) => expensiveOperation(item));
  }, [data]);

  const handleUpdate = useCallback(
    (id: string) => {
      onUpdate(id);
    },
    [onUpdate]
  );

  return (
    <div>
      {processedData.map((item) => (
        <Item
          key={item.id}
          data={item}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
});
```

### Naming Conventions

#### 1. Files and Directories

```
// ✅ Good: kebab-case for files
user-table.tsx
filter-manager.ts
date-utils.ts

// ✅ Good: PascalCase for components
UserTable.tsx
FilterManager.ts
DateUtils.ts

// ❌ Avoid: Inconsistent naming
userTable.tsx
filter_manager.ts
DateUtils.tsx
```

#### 2. Variables and Functions

```typescript
// ✅ Good: camelCase for variables and functions
const userName = "john";
const isActive = true;
const handleClick = () => {};

// ✅ Good: PascalCase for components and types
const UserTable = () => {};
interface UserData {}

// ❌ Avoid: Inconsistent naming
const user_name = "john";
const IsActive = true;
const handle_click = () => {};
```

#### 3. Constants

```typescript
// ✅ Good: SCREAMING_SNAKE_CASE for constants
const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_FILTER_DEBOUNCE = 300;
const API_BASE_URL = "https://api.example.com";

// ❌ Avoid: Mixed case for constants
const maxItemsPerPage = 100;
const defaultFilterDebounce = 300;
```

### Code Organization

#### 1. Import Order

```typescript
// ✅ Good: Organized imports
// 1. React imports
import React, { useState, useCallback, useEffect } from "react";

// 2. Third-party imports
import { format } from "date-fns";
import { clsx } from "clsx";

// 3. Internal imports (absolute paths)
import { ColumnDefinition } from "@better-tables/core";
import { Button } from "@/components/ui/button";

// 4. Relative imports
import { useTableData } from "./hooks/use-table-data";
import { formatValue } from "../utils/format-value";

// 5. Type-only imports
import type { FilterState } from "@better-tables/core";
```

#### 2. Export Patterns

```typescript
// ✅ Good: Named exports for utilities
export const formatDate = (date: Date) => format(date, "PPP");
export const parseFilter = (filter: string) => JSON.parse(filter);

// ✅ Good: Default export for main component
export default function UserTable() {
  return <div>...</div>;
}

// ✅ Good: Re-exports from index files
export { UserTable } from "./user-table";
export { FilterBar } from "./filter-bar";
export type { UserTableProps } from "./user-table";
```

## Testing Guidelines

### Test Structure

#### 1. Unit Tests

```typescript
// ✅ Good: Comprehensive unit tests
describe("FilterManager", () => {
  let filterManager: FilterManager;

  beforeEach(() => {
    filterManager = new FilterManager();
  });

  describe("addFilter", () => {
    it("should add a new filter", () => {
      const filter: FilterState = {
        columnId: "name",
        type: "text",
        operator: "contains",
        values: ["John"],
      };

      filterManager.addFilter(filter);

      expect(filterManager.getFilters()).toContain(filter);
    });

    it("should not add duplicate filters", () => {
      const filter: FilterState = {
        columnId: "name",
        type: "text",
        operator: "contains",
        values: ["John"],
      };

      filterManager.addFilter(filter);
      filterManager.addFilter(filter);

      expect(filterManager.getFilters()).toHaveLength(1);
    });
  });
});
```

#### 2. Component Tests

```typescript
// ✅ Good: Component testing with React Testing Library
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "../filter-bar";

describe("FilterBar", () => {
  const mockColumns = [
    {
      id: "name",
      displayName: "Name",
      type: "text" as const,
    },
  ];

  it("should render filter input", () => {
    render(
      <FilterBar
        columns={mockColumns}
        filters={[]}
        onFiltersChange={jest.fn()}
      />
    );

    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("should call onFiltersChange when filter is added", async () => {
    const onFiltersChange = jest.fn();

    render(
      <FilterBar
        columns={mockColumns}
        filters={[]}
        onFiltersChange={onFiltersChange}
      />
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "John" } });

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith([
        expect.objectContaining({
          columnId: "name",
          values: ["John"],
        }),
      ]);
    });
  });
});
```

#### 3. Integration Tests

```typescript
// ✅ Good: Integration tests for complete workflows
describe("Table Integration", () => {
  it("should filter and sort data correctly", async () => {
    const { user } = renderWithUser(<TableWithFilters />);

    // Add filter
    await user.click(screen.getByText("Add Filter"));
    await user.click(screen.getByText("Name"));
    await user.type(screen.getByRole("textbox"), "John");

    // Verify filtered data
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();

    // Sort data
    await user.click(screen.getByText("Name"));

    // Verify sorted data
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alice");
    expect(rows[2]).toHaveTextContent("John");
  });
});
```

### Test Coverage

- **Minimum Coverage**: 80% for core package, 70% for UI package
- **Critical Paths**: 100% coverage for core functionality
- **Edge Cases**: Test error conditions and boundary values

```bash
# Run tests with coverage
bun --filter @better-tables/core test:coverage

# Generate coverage report
bun run test:coverage --reporter=html
```

## Pull Request Process

### Before Submitting

1. **Check Issues**: Look for existing issues or create a new one
2. **Create Branch**: Create a feature branch from `main`
3. **Write Tests**: Add tests for new functionality
4. **Update Documentation**: Update relevant documentation
5. **Run Checks**: Ensure all tests pass and linting is clean

### Branch Naming

```bash
# Feature branches
feature/add-virtualization
feature/improve-filtering

# Bug fixes
fix/memory-leak-in-virtualization
fix/filter-validation-error

# Documentation
docs/update-getting-started
docs/add-performance-guide
```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Feature
feat: add virtualization support for large datasets

# Bug fix
fix: resolve memory leak in filter manager

# Documentation
docs: update API reference with new examples

# Performance
perf: optimize rendering performance for 100k+ rows

# Breaking change
feat!: change column builder API

BREAKING CHANGE: Column builder methods now return new instances
```

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and linting
2. **Code Review**: At least one maintainer reviews the PR
3. **Testing**: Reviewer tests the changes manually
4. **Approval**: PR is approved and merged

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update Version**: Update version in `package.json` files
2. **Update Changelog**: Add changes to `CHANGELOG.md`
3. **Create Release**: Create GitHub release with notes
4. **Publish Packages**: Publish to npm
5. **Update Documentation**: Update docs if needed

### Release Scripts

```bash
# Prepare release
bun run changeset

# Version packages
bun run changeset:version

# Publish packages
bun run changeset:publish
```

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Expected Behavior

- Use welcoming and inclusive language
- Respect different viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or inflammatory comments
- Personal attacks or political discussions
- Public or private harassment
- Publishing private information without permission
- Other unprofessional conduct

### Reporting

Report violations to [conduct@example.com](mailto:conduct@example.com).

## Getting Help

### Documentation

- [Getting Started Guide](./GETTING_STARTED.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [API Reference](./core/TYPES_API_REFERENCE.md)
- [Component Reference](./ui/COMPONENT_REFERENCE.md)

### Community

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Discord**: Real-time chat (if available)

### Mentorship

New contributors can request mentorship by:

1. Opening an issue with the `mentorship` label
2. Describing your background and interests
3. Specifying what you'd like to work on

## Recognition

Contributors are recognized in:

- **README.md**: Contributors section
- **CHANGELOG.md**: Release notes
- **GitHub**: Contributor graphs and insights

Thank you for contributing to Better Tables! 🎉
