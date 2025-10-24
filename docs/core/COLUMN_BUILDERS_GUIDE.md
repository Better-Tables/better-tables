# @better-tables/core - Column Builders Guide

## Overview

The Better Tables column builder system provides a fluent, type-safe API for creating column definitions. It uses a builder pattern that allows you to configure columns step-by-step with full TypeScript support and validation.

## Table of Contents

- [Getting Started](#getting-started)
- [Column Factory](#column-factory)
- [Base Column Builder](#base-column-builder)
- [Type-Specific Builders](#type-specific-builders)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Getting Started

### Basic Usage

```typescript
import { createColumnBuilder } from '@better-tables/core';

// Create a column factory for your data type
const cb = createColumnBuilder<Contact>();

// Build columns using the fluent API
const columns = [
  cb
    .text()
    .id('name')
    .displayName('Full Name')
    .accessor(contact => `${contact.firstName} ${contact.lastName}`)
    .searchable()
    .build(),

  cb
    .number()
    .id('age')
    .displayName('Age')
    .accessor(contact => contact.age)
    .range(0, 120)
    .build(),

  cb
    .option()
    .id('status')
    .displayName('Status')
    .accessor(contact => contact.status)
    .options([
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'inactive', label: 'Inactive', color: 'red' },
    ])
    .build(),
];
```

### Quick Column Creation

For simple use cases, use the `quickColumn` utility:

```typescript
import { quickColumn } from '@better-tables/core';

const columns = [
  quickColumn('name', 'Name', data => data.name),
  quickColumn('email', 'Email', data => data.email, { type: 'email' }),
  quickColumn('age', 'Age', data => data.age, { type: 'number' }),
];
```

## Column Factory

### createColumnBuilder<TData>()

Creates a type-safe column factory for your data type.

```typescript
interface ColumnFactory<TData = unknown> {
  text(): TextColumnBuilder<TData>;
  number(): NumberColumnBuilder<TData>;
  date(): DateColumnBuilder<TData>;
  boolean(): BooleanColumnBuilder<TData>;
  option(): OptionColumnBuilder<TData>;
  multiOption(): MultiOptionColumnBuilder<TData>;
  custom<TValue = unknown>(type: 'json' | 'custom'): ColumnBuilder<TData, TValue>;
}
```

### Global Factory

Use the global `column` factory when you don't need type safety:

```typescript
import { column } from '@better-tables/core';

const columns = [
  column
    .text()
    .id('name')
    .displayName('Name')
    .accessor(data => data.name)
    .build(),
];
```

### Multiple Data Types

Create factories for multiple data types:

```typescript
import { createColumnBuilders } from '@better-tables/core';

const { users, orders, products } = createColumnBuilders({
  users: {} as User,
  orders: {} as Order,
  products: {} as Product,
});

// Use them independently
const userColumns = [users.text().id('name').displayName('Name').build()];

const orderColumns = [orders.number().id('total').displayName('Total').build()];
```

## Base Column Builder

All column builders extend the base `ColumnBuilder` class, which provides common configuration methods.

### Core Methods

```typescript
class ColumnBuilder<TData, TValue> {
  // Required configuration
  id(id: string): this;
  displayName(displayName: string): this;
  accessor(accessor: (data: TData) => TValue): this;

  // Optional configuration
  icon(icon: IconComponent): this;
  sortable(sortable?: boolean): this;
  filterable(filterable?: boolean, filterConfig?: FilterConfig<TValue>): this;
  resizable(resizable?: boolean): this;

  // Layout
  width(width: number, minWidth?: number, maxWidth?: number): this;
  minWidth(minWidth: number): this;
  maxWidth(maxWidth: number): this;
  align(align: 'left' | 'center' | 'right'): this;

  // Customization
  cellRenderer(renderer: (props: CellRendererProps<TData, TValue>) => ReactNode): this;
  headerRenderer(renderer: (props: HeaderRendererProps<TData>) => ReactNode): this;

  // Validation
  validation(rules: ValidationRule<TValue>[]): this;
  nullable(nullable?: boolean): this;

  // Metadata
  meta(meta: Record<string, unknown>): this;

  // Build
  build(): ColumnDefinition<TData, TValue>;
}
```

### Example Usage

```typescript
const column = cb
  .text()
  .id('description')
  .displayName('Description')
  .accessor(item => item.description)
  .width(300, 100, 500) // width, minWidth, maxWidth
  .align('left')
  .sortable(true)
  .filterable(true)
  .nullable(true)
  .meta({ category: 'content' })
  .build();
```

## Type-Specific Builders

### TextColumnBuilder

For text-based columns with search functionality.

```typescript
cb.text()
  .id('name')
  .displayName('Name')
  .accessor(user => user.name)
  .searchable({ debounce: 300, includeNull: false })
  .textOperators(['contains', 'equals', 'startsWith'])
  .asEmail() // Convert to email type
  .asUrl() // Convert to URL type
  .asPhone() // Convert to phone type
  .truncate({ maxLength: 100, showTooltip: true })
  .transform('capitalize')
  .build();
```

**Methods:**

- `searchable(options?)` - Enable text search with debouncing
- `textOperators(operators)` - Set specific text operators
- `asEmail()` - Configure as email column
- `asUrl()` - Configure as URL column
- `asPhone()` - Configure as phone column
- `truncate(options)` - Set text truncation
- `transform(type)` - Set text transformation

### NumberColumnBuilder

For numeric columns with range filtering and formatting.

```typescript
cb.number()
  .id('price')
  .displayName('Price')
  .accessor(item => item.price)
  .range(0, 10000, { step: 0.01 })
  .currency({ currency: 'USD', locale: 'en-US' })
  .precision(2)
  .format({ useGrouping: true, notation: 'standard' })
  .compact({ compactDisplay: 'short' })
  .build();
```

**Methods:**

- `range(min, max, options?)` - Set numeric range for filtering
- `numberOperators(operators)` - Set specific number operators
- `currency(options)` - Configure as currency column
- `percentage(options)` - Configure as percentage column
- `format(options)` - Set number formatting
- `precision(digits)` - Set decimal precision
- `compact(options)` - Use compact notation (1K, 1M)

### DateColumnBuilder

For date/time columns with date-specific filtering.

```typescript
cb.date()
  .id('createdAt')
  .displayName('Created At')
  .accessor(item => item.createdAt)
  .format('yyyy-MM-dd', { locale: 'en-US', timeZone: 'UTC' })
  .dateRange({ includeNull: false })
  .dateOnly({ format: 'yyyy-MM-dd' })
  .dateTime({ format: 'yyyy-MM-dd HH:mm:ss' })
  .timeOnly({ format: 'HH:mm:ss' })
  .relative({ style: 'long' })
  .chronological()
  .build();
```

**Methods:**

- `format(formatString, options?)` - Set date format
- `dateOperators(operators)` - Set specific date operators
- `dateRange(options)` - Enable date range filtering
- `dateOnly(options)` - Configure as date-only
- `dateTime(options)` - Configure as date-time
- `timeOnly(options)` - Configure as time-only
- `relative(options)` - Show relative time
- `chronological()` - Set chronological sorting

### OptionColumnBuilder

For single-select dropdown columns.

```typescript
cb.option()
  .id('status')
  .displayName('Status')
  .accessor(item => item.status)
  .options(
    [
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'inactive', label: 'Inactive', color: 'red' },
    ],
    { searchable: true, placeholder: 'Select status' },
  )
  .status([
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'red' },
  ])
  .priority([
    { value: 'high', label: 'High', color: 'red', order: 3 },
    { value: 'medium', label: 'Medium', color: 'yellow', order: 2 },
    { value: 'low', label: 'Low', color: 'gray', order: 1 },
  ])
  .category(categories, { showIcons: true })
  .showBadges({ variant: 'default', showColors: true })
  .build();
```

**Methods:**

- `options(options, config?)` - Set available options
- `asyncOptions(loader, config?)` - Load options asynchronously
- `optionOperators(operators)` - Set specific option operators
- `status(statuses, config?)` - Configure as status column
- `priority(priorities, config?)` - Configure as priority column
- `category(categories, config?)` - Configure as category column
- `showBadges(config?)` - Enable badge display

### MultiOptionColumnBuilder

For multi-select columns with tag-like functionality.

```typescript
cb.multiOption()
  .id('tags')
  .displayName('Tags')
  .accessor(item => item.tags)
  .options(
    [
      { value: 'frontend', label: 'Frontend', color: 'blue' },
      { value: 'backend', label: 'Backend', color: 'green' },
    ],
    { maxSelections: 5, minSelections: 1 },
  )
  .tags(tags, { allowCreate: true, maxTags: 10 })
  .categories(categories, { showHierarchy: true })
  .roles(roles, { showDescriptions: true })
  .displayFormat({ type: 'chips', maxVisible: 3 })
  .showBadges({ removable: true })
  .validate({ maxSelections: 5, minSelections: 1 })
  .build();
```

**Methods:**

- `options(options, config?)` - Set available options
- `asyncOptions(loader, config?)` - Load options asynchronously
- `multiOptionOperators(operators)` - Set specific operators
- `tags(tags, config?)` - Configure as tags column
- `categories(categories, config?)` - Configure as categories column
- `roles(roles, config?)` - Configure as roles column
- `displayFormat(format)` - Set display format
- `showBadges(config?)` - Enable badge display
- `validate(config)` - Set validation rules

### BooleanColumnBuilder

For boolean columns with various display options.

```typescript
cb.boolean()
  .id('isActive')
  .displayName('Active')
  .accessor(item => item.isActive)
  .booleanFilter({ includeNull: false })
  .displayFormat({
    type: 'badge',
    trueText: 'Active',
    falseText: 'Inactive',
    trueColor: 'green',
    falseColor: 'red',
  })
  .yesNo({ yesText: 'Yes', noText: 'No', showBadges: true })
  .activeInactive({ showBadges: true })
  .enabledDisabled({ showBadges: true })
  .checkbox({ interactive: true, onChange: (value, row) => updateRow(row.id, { isActive: value }) })
  .switch({ interactive: true, size: 'medium' })
  .iconDisplay({ trueIcon: 'check', falseIcon: 'x' })
  .build();
```

**Methods:**

- `booleanOperators(operators)` - Set specific boolean operators
- `booleanFilter(options?)` - Configure boolean filtering
- `displayFormat(format)` - Set display format
- `yesNo(options?)` - Configure as yes/no column
- `activeInactive(options?)` - Configure as active/inactive column
- `enabledDisabled(options?)` - Configure as enabled/disabled column
- `checkbox(options?)` - Configure as checkbox display
- `switch(options?)` - Configure as switch display
- `iconDisplay(options?)` - Configure as icon display

## Advanced Usage

### Custom Cell Renderers

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
  .build();
```

### Custom Header Renderers

```typescript
cb.number()
  .id('score')
  .displayName('Score')
  .accessor(item => item.score)
  .headerRenderer(({ column, isSorted, sortDirection, onSort }) => (
    <div className="flex items-center gap-1">
      <span>{column.displayName}</span>
      <button onClick={onSort} className="text-gray-400 hover:text-gray-600">
        {isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </button>
    </div>
  ))
  .build();
```

### Validation Rules

```typescript
cb.text()
  .id('email')
  .displayName('Email')
  .accessor(user => user.email)
  .validation([
    {
      id: 'email-format',
      validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: 'Invalid email format',
    },
    {
      id: 'required',
      validate: value => value && value.length > 0,
      message: 'Email is required',
    },
  ])
  .build();
```

### Async Options

```typescript
cb.option()
  .id('category')
  .displayName('Category')
  .accessor(item => item.categoryId)
  .asyncOptions(
    async () => {
      const response = await fetch('/api/categories');
      const categories = await response.json();
      return categories.map(cat => ({
        value: cat.id,
        label: cat.name,
        color: cat.color,
      }));
    },
    {
      searchable: true,
      placeholder: 'Select category',
      loadingPlaceholder: 'Loading categories...',
    },
  )
  .build();
```

### Complex Metadata

```typescript
cb.number()
  .id('revenue')
  .displayName('Revenue')
  .accessor(item => item.revenue)
  .currency({ currency: 'USD', locale: 'en-US' })
  .meta({
    category: 'financial',
    sensitive: true,
    permissions: ['admin', 'finance'],
    exportable: true,
    chartable: true,
    aggregation: {
      sum: true,
      average: true,
      median: true,
    },
  })
  .build();
```

## Best Practices

### 1. Use Type Safety

Always use typed column builders when possible:

```typescript
// Good: Type-safe
const cb = createColumnBuilder<User>();
const columns = [
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor(user => user.name) // TypeScript knows user is User
    .build(),
];

// Avoid: Untyped
const columns = [
  column
    .text()
    .id('name')
    .displayName('Name')
    .accessor(data => data.name) // data is any
    .build(),
];
```

### 2. Consistent Naming

Use consistent naming patterns:

```typescript
// Good: Consistent naming
const columns = [
  cb
    .text()
    .id('firstName')
    .displayName('First Name')
    .accessor(u => u.firstName)
    .build(),
  cb
    .text()
    .id('lastName')
    .displayName('Last Name')
    .accessor(u => u.lastName)
    .build(),
  cb
    .text()
    .id('emailAddress')
    .displayName('Email Address')
    .accessor(u => u.email)
    .build(),
];

// Avoid: Inconsistent naming
const columns = [
  cb
    .text()
    .id('firstName')
    .displayName('First Name')
    .accessor(u => u.firstName)
    .build(),
  cb
    .text()
    .id('last_name')
    .displayName('Last Name')
    .accessor(u => u.lastName)
    .build(),
  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor(u => u.email)
    .build(),
];
```

### 3. Appropriate Column Types

Choose the right column type for your data:

```typescript
// Good: Appropriate types
cb.number().id('age').accessor(u => u.age).range(0, 120).build(),
cb.date().id('birthDate').accessor(u => u.birthDate).dateOnly().build(),
cb.boolean().id('isActive').accessor(u => u.isActive).activeInactive().build(),

// Avoid: Wrong types
cb.text().id('age').accessor(u => u.age.toString()).build(),  // Should be number
cb.text().id('birthDate').accessor(u => u.birthDate.toISOString()).build(),  // Should be date
```

### 4. Meaningful Display Names

Use clear, user-friendly display names:

```typescript
// Good: Clear display names
cb.text().id('firstName').displayName('First Name').build(),
cb.number().id('annualSalary').displayName('Annual Salary').build(),
cb.date().id('lastLoginAt').displayName('Last Login').build(),

// Avoid: Technical or unclear names
cb.text().id('firstName').displayName('firstName').build(),
cb.number().id('annualSalary').displayName('salary').build(),
cb.date().id('lastLoginAt').displayName('last_login').build(),
```

### 5. Proper Filtering Configuration

Configure filtering appropriately for each column type:

```typescript
// Good: Appropriate filtering
cb.text().id('name').searchable({ debounce: 300 }).build(),
cb.number().id('price').range(0, 1000, { step: 0.01 }).build(),
cb.date().id('createdAt').dateRange({ includeNull: false }).build(),
cb.option().id('status').options(statusOptions, { searchable: true }).build(),

// Avoid: No filtering configuration
cb.text().id('name').build(),  // No search configuration
cb.number().id('price').build(),  // No range configuration
```

### 6. Validation Rules

Add validation rules where appropriate:

```typescript
cb.text()
  .id('email')
  .displayName('Email')
  .accessor(user => user.email)
  .validation([
    {
      id: 'email-format',
      validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: 'Invalid email format',
    },
  ])
  .build();
```

### 7. Performance Considerations

Consider performance for large datasets:

```typescript
// Good: Efficient accessors
cb.text().id('name').accessor(user => user.name).build(),  // Direct property access
cb.number().id('age').accessor(user => user.age).build(),  // Direct property access

// Avoid: Expensive accessors
cb.text().id('name').accessor(user => `${user.firstName} ${user.lastName}`).build(),  // String concatenation
cb.number().id('score').accessor(user => calculateScore(user)).build(),  // Function call
```

## Examples

### User Management Table

```typescript
import { createColumnBuilder } from '@better-tables/core';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  status: 'active' | 'inactive' | 'pending';
  roles: string[];
  lastLoginAt: Date;
  isVerified: boolean;
  avatar?: string;
}

const cb = createColumnBuilder<User>();

const userColumns = [
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor(user => `${user.firstName} ${user.lastName}`)
    .searchable({ debounce: 300 })
    .width(200)
    .cellRenderer(({ value, row }) => (
      <div className="flex items-center gap-2">
        {row.avatar && <img src={row.avatar} alt={value} className="w-8 h-8 rounded-full" />}
        <span>{value}</span>
      </div>
    ))
    .build(),

  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor(user => user.email)
    .asEmail()
    .searchable({ debounce: 300 })
    .validation([
      {
        id: 'email-format',
        validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Invalid email format',
      },
    ])
    .build(),

  cb
    .number()
    .id('age')
    .displayName('Age')
    .accessor(user => user.age)
    .range(18, 100)
    .align('center')
    .width(80)
    .build(),

  cb
    .option()
    .id('status')
    .displayName('Status')
    .accessor(user => user.status)
    .status(
      [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'inactive', label: 'Inactive', color: 'red' },
        { value: 'pending', label: 'Pending', color: 'yellow' },
      ],
      { searchable: true },
    )
    .showBadges({ variant: 'default', showColors: true })
    .build(),

  cb
    .multiOption()
    .id('roles')
    .displayName('Roles')
    .accessor(user => user.roles)
    .roles(
      [
        { value: 'admin', label: 'Admin', color: 'red' },
        { value: 'user', label: 'User', color: 'blue' },
        { value: 'moderator', label: 'Moderator', color: 'green' },
      ],
      { searchable: true, maxRoles: 5 },
    )
    .displayFormat({ type: 'chips', maxVisible: 2 })
    .showBadges({ removable: false })
    .build(),

  cb
    .date()
    .id('lastLoginAt')
    .displayName('Last Login')
    .accessor(user => user.lastLoginAt)
    .relative({ style: 'short' })
    .dateRange({ includeNull: true })
    .width(150)
    .build(),

  cb
    .boolean()
    .id('isVerified')
    .displayName('Verified')
    .accessor(user => user.isVerified)
    .enabledDisabled({
      enabledText: 'Verified',
      disabledText: 'Unverified',
      showBadges: true,
    })
    .align('center')
    .width(100)
    .build(),
];
```

### Product Catalog Table

```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  inStock: boolean;
  createdAt: Date;
  rating: number;
}

const cb = createColumnBuilder<Product>();

const productColumns = [
  cb
    .text()
    .id('name')
    .displayName('Product Name')
    .accessor(product => product.name)
    .searchable({ debounce: 300 })
    .width(250)
    .build(),

  cb
    .text()
    .id('description')
    .displayName('Description')
    .accessor(product => product.description)
    .truncate({ maxLength: 100, showTooltip: true })
    .width(300)
    .build(),

  cb
    .number()
    .id('price')
    .displayName('Price')
    .accessor(product => product.price)
    .currency({ currency: 'USD', locale: 'en-US' })
    .range(0, 10000, { step: 0.01 })
    .align('right')
    .width(120)
    .build(),

  cb
    .option()
    .id('category')
    .displayName('Category')
    .accessor(product => product.category)
    .category(
      [
        { value: 'electronics', label: 'Electronics', color: 'blue' },
        { value: 'clothing', label: 'Clothing', color: 'green' },
        { value: 'books', label: 'Books', color: 'purple' },
      ],
      { searchable: true, showIcons: true },
    )
    .build(),

  cb
    .multiOption()
    .id('tags')
    .displayName('Tags')
    .accessor(product => product.tags)
    .tags(
      [
        { value: 'new', label: 'New', color: 'green' },
        { value: 'sale', label: 'Sale', color: 'red' },
        { value: 'featured', label: 'Featured', color: 'blue' },
      ],
      { allowCreate: true, maxTags: 10 },
    )
    .displayFormat({ type: 'chips', maxVisible: 3 })
    .showBadges({ removable: true })
    .build(),

  cb
    .boolean()
    .id('inStock')
    .displayName('In Stock')
    .accessor(product => product.inStock)
    .yesNo({
      yesText: 'In Stock',
      noText: 'Out of Stock',
      showBadges: true,
      yesColor: 'green',
      noColor: 'red',
    })
    .align('center')
    .width(100)
    .build(),

  cb
    .date()
    .id('createdAt')
    .displayName('Created')
    .accessor(product => product.createdAt)
    .dateOnly({ format: 'yyyy-MM-dd' })
    .dateRange({ includeNull: false })
    .width(120)
    .build(),

  cb
    .number()
    .id('rating')
    .displayName('Rating')
    .accessor(product => product.rating)
    .range(0, 5, { step: 0.1 })
    .precision(1)
    .align('center')
    .width(100)
    .cellRenderer(({ value }) => (
      <div className="flex items-center gap-1">
        <span>{value}</span>
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < Math.floor(value) ? 'text-yellow-400' : 'text-gray-300'}>
              ★
            </span>
          ))}
        </div>
      </div>
    ))
    .build(),
];
```

## Validation

The column builder system includes built-in validation to ensure proper configuration:

```typescript
// This will throw an error
cb.text()
  .displayName('Name')
  .accessor(user => user.name)
  .build(); // Error: Column ID is required

// This will throw an error
cb.text()
  .id('name')
  .accessor(user => user.name)
  .build(); // Error: Column display name is required

// This will throw an error
cb.text().id('name').displayName('Name').build(); // Error: Column accessor is required
```

## Related Documentation

- [Types API Reference](./TYPES_API_REFERENCE.md)
- [Manager APIs](./MANAGERS_API.md)
- [Adapter Development](./ADAPTER_DEVELOPMENT.md)
- [UI Integration](./UI_INTEGRATION.md)
