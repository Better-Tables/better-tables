# @better-tables/adapters-drizzle

A powerful Drizzle ORM adapter for Better Tables that provides automatic relationship detection, smart join generation, and full TypeScript type safety across PostgreSQL, MySQL, and SQLite databases.

## Features

- 🚀 **Automatic Relationship Detection** - Automatically detects table relationships from Drizzle's `relations()` API
- 🔗 **Smart Join Generation** - Only joins tables needed for current query (filters/sorts/columns)
- 🎯 **Dot Notation Support** - Use `profile.bio` and `posts.title` for intuitive column access
- 🏗️ **Nested Data Structures** - Preserves relationship hierarchy in query results
- 📊 **Aggregate Support** - Built-in support for counts, sums, averages, and more
- 🔍 **Cross-Table Filtering** - Filter and sort across multiple tables seamlessly
- ⚡ **Performance Optimized** - Query caching, join optimization, and batch processing
- 🛡️ **Full Type Safety** - Complete TypeScript support with schema inference
- 🗄️ **Multi-Database** - Support for PostgreSQL, MySQL, and SQLite
- 🏭 **Factory Function** - Simple API with automatic schema and driver detection
- 🔢 **Array Foreign Keys** - Native support for array foreign key relationships (PostgreSQL arrays, MySQL/SQLite JSON arrays)

## Installation

```bash
# Install the adapter
npm install @better-tables/adapters-drizzle

# Install your database driver (choose one)
npm install postgres        # For PostgreSQL
npm install mysql2         # For MySQL
npm install better-sqlite3 # For SQLite
```

## Quick Start

### 1. Define Your Schema

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Tables
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
});

const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  bio: text('bio'),
  avatar: text('avatar'),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
  published: integer('published', { mode: 'boolean' }).default(false),
});

// Relations
const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  posts: many(posts),
}));

const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));

const schema = { users, profiles, posts };
const relationsSchema = {
  users: usersRelations,
  profiles: profilesRelations,
  posts: postsRelations,
};
```

### 2. Set Up Database Connection

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

// For SQLite
const sqlite = new Database('database.db');
const db = drizzle(sqlite, { schema: { ...schema, ...relationsSchema } });

// For PostgreSQL
// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// const sql = postgres('postgresql://user:password@localhost:5432/database');
// const db = drizzle(sql, { schema: { ...schema, ...relationsSchema } });

// For MySQL
// import { drizzle } from 'drizzle-orm/mysql2';
// import mysql from 'mysql2/promise';
// const connection = await mysql.createConnection({
//   host: 'localhost',
//   user: 'user',
//   password: 'password',
//   database: 'database'
// });
// const db = drizzle(connection, { schema: { ...schema, ...relationsSchema } });
```

### 3. Create the Adapter (Recommended: Factory Function)

The factory function automatically detects the schema and driver from your Drizzle instance:

```typescript
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

// Simple usage - everything auto-detected
const adapter = drizzleAdapter(db);

// With options
const adapter = drizzleAdapter(db, {
  options: {
    cache: { enabled: true, ttl: 300000, maxSize: 1000 },
    logging: { enabled: true, level: 'info' },
  },
});
```

### 4. Define Columns with Dot Notation

```typescript
import { createColumnBuilder } from '@better-tables/core';

const cb = createColumnBuilder<UserWithRelations>();

const columns = [
  // Direct columns
  cb.text().id('name').displayName('Name').accessor(user => user.name).build(),
  cb.text().id('email').displayName('Email').accessor(user => user.email).build(),
  
  // One-to-one relationship
  cb.text().id('profile.bio').displayName('Bio').accessor(user => user.profile?.bio).build(),
  cb.text().id('profile.avatar').displayName('Avatar').accessor(user => user.profile?.avatar).build(),
  
  // One-to-many relationship (first post)
  cb.text().id('posts.title').displayName('Latest Post').accessor(user => user.posts?.[0]?.title).build(),
  
  // Aggregate columns
  cb.number().id('posts_count').displayName('Post Count').accessor(user => user.posts?.length || 0).build(),
];
```

### 5. Use with Better Tables

```typescript
import { BetterTable } from '@better-tables/ui';

function UserTable() {
  return (
    <BetterTable
      adapter={adapter}
      columns={columns}
      // All Better Tables features work seamlessly:
      // - Filtering across relationships
      // - Sorting by related fields
      // - Pagination
      // - Virtual scrolling
      // - Export functionality
    />
  );
}
```

## Advanced Usage

### Using the Constructor (Advanced)

For more control, you can use the constructor directly:

```typescript
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';

// REQUIRED: Specify the driver type explicitly for proper type safety
const adapter = new DrizzleAdapter<typeof schema, 'sqlite'>({
  db,
  schema,
  driver: 'sqlite', // 'postgres' | 'mysql' | 'sqlite'
  relations: relationsSchema, // For auto-detection
  autoDetectRelationships: true,
  options: {
    cache: { enabled: true, ttl: 300000 },
  },
});
```

### Custom Relationship Mapping

If you need more control over relationships, you can provide manual mappings:

```typescript
const adapter = drizzleAdapter(db, {
  autoDetectRelationships: false,
  relationships: {
    'profile.bio': {
      from: 'users',
      to: 'profiles',
      foreignKey: 'userId',
      localKey: 'id',
      cardinality: 'one',
      nullable: true,
      joinType: 'left'
    },
    'posts.title': {
      from: 'users',
      to: 'posts',
      foreignKey: 'userId',
      localKey: 'id',
      cardinality: 'many',
      joinType: 'left'
    }
  }
});
```

### Performance Optimization

```typescript
const adapter = drizzleAdapter(db, {
  options: {
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000
    },
    optimization: {
      maxJoins: 5,
      enableBatching: true,
      batchSize: 1000
    },
    logging: {
      enabled: true,
      level: 'info',
      logQueries: false
    },
    performance: {
      trackTiming: true,
      maxQueryTime: 5000
    }
  }
});
```

### Complex Filtering

```typescript
import type { FilterState } from '@better-tables/core';

// Filter across multiple tables
const filters: FilterState[] = [
  {
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: ['John']
  },
  {
    columnId: 'profile.bio',
    type: 'text',
    operator: 'isNotEmpty',
    values: []
  },
  {
    columnId: 'posts_count',
    type: 'number',
    operator: 'greaterThan',
    values: [5]
  }
];

const result = await adapter.fetchData({ 
  columns: ['name', 'email', 'profile.bio'],
  filters 
});
```

### Primary Table Specification

When working with JSONB accessor columns or ambiguous column names, you can explicitly specify the primary table:

```typescript
// Explicit primary table - recommended for clarity and to avoid ambiguity
const result = await adapter.fetchData({
  primaryTable: 'surveys',
  columns: ['title', 'slug', 'status'],
  // 'title' may be accessed via accessor from survey.survey.title (JSONB)
  // Explicit primaryTable ensures correct table selection
});

// Automatic determination - adapter infers from columns
const result = await adapter.fetchData({
  columns: ['id', 'slug', 'status'], // All direct columns
  // Adapter will automatically determine 'surveys' as primary table
});
```

**When to use explicit `primaryTable`:**
- When column IDs reference JSONB nested fields via accessors
- When column IDs are ambiguous across multiple tables
- When you want explicit control over table selection
- For better code clarity and maintainability

**Automatic determination:**
- The adapter uses improved heuristics to determine the primary table
- Prefers tables with the most matching direct columns
- Falls back to first table when truly ambiguous
- Works well when all columns are direct schema columns

### Computed Fields

Computed fields allow you to add virtual columns that are calculated at runtime. These fields don't exist in the database schema but are computed from the row data, related tables, or any other source.

**Basic Example:**

```typescript
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { count, eq } from 'drizzle-orm';

const adapter = new DrizzleAdapter({
  db,
  schema,
  driver: 'postgres',
  computedFields: {
    eventsTable: [
      {
        field: 'attendeeCount',
        type: 'number',
        compute: async (row, context) => {
          const result = await context.db
            .select({ count: count() })
            .from(eventAttendeesTable)
            .where(eq(eventAttendeesTable.eventId, row.id));
          return result[0]?.count || 0;
        },
        filter: async (filter, context) => {
          // Transform attendeeCount filter into id filter
          const matchingIds = await getEventIdsByAttendeeCount(filter, context);
          return [{
            columnId: 'id',
            operator: 'isAnyOf',
            values: matchingIds,
            type: 'text',
          }];
        },
      },
    ],
  },
});

// Use computed field in queries
const result = await adapter.fetchData({
  columns: ['title', 'attendeeCount'],
  filters: [
    { columnId: 'attendeeCount', operator: 'greaterThan', values: [10], type: 'number' },
  ],
});
```

**Simple Calculation Example:**

```typescript
computedFields: {
  usersTable: [
    {
      field: 'fullName',
      type: 'text',
      compute: (row) => `${row.firstName} ${row.lastName}`,
    },
    {
      field: 'age',
      type: 'number',
      compute: (row) => {
        const birthDate = new Date(row.birthDate);
        const today = new Date();
        return today.getFullYear() - birthDate.getFullYear();
      },
    },
  ],
},
```

**With Filtering Support:**

```typescript
import { count, eq, gt } from 'drizzle-orm';

computedFields: {
  eventsTable: [
    {
      field: 'attendeeCount',
      type: 'number',
      compute: async (row, context) => {
        // Compute from related table
        const result = await context.db
          .select({ count: count() })
          .from(eventAttendeesTable)
          .where(eq(eventAttendeesTable.eventId, row.id));
        return result[0]?.count || 0;
      },
      filter: async (filter, context) => {
        // Transform computed field filter into database filter
        const eventAttendeeCounts = context.db
          .select({ eventId: eventAttendeesTable.eventId })
          .from(eventAttendeesTable)
          .groupBy(eventAttendeesTable.eventId)
          .having(gt(count(eventAttendeesTable.userId), filter.values[0]))
          .as('event_attendee_counts');
        
        const matchingIds = await context.db
          .select({ id: eventAttendeeCounts.eventId })
          .from(eventAttendeeCounts);
        
        return [{
          columnId: 'id',
          operator: 'isAnyOf',
          values: matchingIds.map(r => r.id),
          type: 'text',
        }];
      },
    },
  ],
},
```

**Key Features:**

- **Runtime Computation**: Fields are computed after data is fetched
- **Database Queries**: Can query related tables using `context.db`
- **Filtering Support**: Optional `filter` function to transform computed field filters into database queries
- **Batch Processing**: `context.allRows` provides all rows for batch computation
- **Type Safety**: Full TypeScript support with proper types

See [Advanced Usage Guide](./docs/ADVANCED_USAGE.md#computed-fields) for more examples.

### Array Foreign Keys

**Important**: The adapter internally stores and resolves relationships using **schema keys** (e.g., `usersTable`, `eventsTable`) rather than raw database table names (e.g., `users`, `events`). This ensures consistency with Drizzle's schema object structure. When defining custom relationships or debugging, ensure you refer to tables by their schema keys.

The adapter automatically handles conversion from database table names to schema keys:
- If your schema keys differ from database table names (e.g., `{ usersTable: usersTable }` where DB name is `'users'`), the adapter will find the correct schema key.
- If your schema keys match database table names (e.g., `{ users: usersTable }`), the adapter will use the database table name as the schema key (backward compatibility).

### Array Foreign Keys

The adapter automatically detects and handles array foreign key relationships. This is useful for scenarios where a column contains an array of foreign key references.

**Auto-Detection**: The adapter automatically detects array FK relationships from your schema definition. You don't need to manually configure them - just define your columns with `.references()` and `.array()`:

```typescript
// PostgreSQL example
organizerId: uuid('organizer_id')
  .references(() => usersTable.id)
  .array()
  .notNull()
```

The adapter will automatically:
- Detect that `organizerId` is an array column
- Extract the foreign key reference from `.references(() => usersTable.id)`
- Create a relationship named `events.organizers` (auto-pluralized from `organizerId`)
- Enable joins and filtering on the related `users` table

**PostgreSQL Example:**
```typescript
import { pgTable, uuid } from 'drizzle-orm/pg-core';

const events = pgTable('events', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  organizerId: uuid('organizer_id')
    .array()
    .references(() => users.id)
    .notNull(),
});

// The adapter automatically detects this as an array FK relationship
// You can now query organizer data directly:
const columns = [
  cb.text().id('organizers.name').displayName('Organizers')
    .accessor(event => event.organizers?.map(org => org.name).join(', ') || '')
    .build(),
];

// The adapter will automatically join with users table using array FK join
const result = await adapter.fetchData({
  columns: ['title', 'organizers.name', 'organizers.username'],
});
// Returns: { title: 'Event', organizers: [{ name: 'John', username: 'john' }, ...] }
```

**MySQL/SQLite Example:**
```typescript
import { json, mysqlTable } from 'drizzle-orm/mysql-core';

const events = mysqlTable('events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  organizerId: json('organizer_id'), // JSON array of user IDs
});

// Works the same way - adapter detects JSON array columns with FK references
```

The adapter uses database-specific syntax for array joins:
- **PostgreSQL**: `target = ANY(source_array)` (native array support)
- **MySQL**: `JSON_SEARCH(source_array, 'one', target) IS NOT NULL` (JSON array support)
- **SQLite**: `EXISTS (SELECT 1 FROM json_each(source_array) WHERE value = target)` (JSON array support)

### Aggregate Columns

```typescript
const columns = [
  // Count of related records
  cb.number().id('posts_count').displayName('Posts').accessor(user => user.posts?.length || 0).build(),
  
  // Sum of related values
  cb.number().id('total_views').displayName('Total Views').accessor(user => 
    user.posts?.reduce((sum, post) => sum + (post.views || 0), 0) || 0
  ).build(),
  
  // Average of related values
  cb.number().id('avg_rating').displayName('Avg Rating').accessor(user => {
    const ratings = user.posts?.map(post => post.rating).filter(Boolean) || [];
    return ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
  }).build(),
];
```

### Server-Side Rendering (Next.js)

```typescript
// app/page.tsx
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import type { FilterState, SortingState } from '@better-tables/core';
import { getDatabase } from '@/lib/db';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  
  // Get database connection
  const { db } = await getDatabase();
  
  // Create adapter (can be cached at module level)
  const adapter = drizzleAdapter(db);
  
  // Parse URL params
  const page = Number.parseInt(params.page || '1', 10);
  const limit = Number.parseInt(params.limit || '10', 10);
  
  // Deserialize filters (compressed format, prefixed with "c:")
  let filters: FilterState[] = [];
  if (params.filters) {
    try {
      const { deserializeFiltersFromURL } = await import('@better-tables/core');
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
      const { decompressAndDecode } = await import('@better-tables/core');
      sorting = decompressAndDecode<SortingState>(params.sorting);
    } catch {
      // Invalid or corrupted sorting data, use empty array
      sorting = [];
    }
  }
  
  // Fetch data
  const result = await adapter.fetchData({
    columns: ['name', 'email', 'profile.bio'],
    pagination: { page, limit },
    filters,
    sorting,
  });
  
  return <Table data={result.data} totalCount={result.total} />;
}
```

## API Reference

### Factory Function

#### `drizzleAdapter<TDB>(db, factoryOptions?)`

The recommended way to create an adapter. Automatically detects schema and driver.

```typescript
function drizzleAdapter<TDB>(
  db: TDB,
  factoryOptions?: DrizzleAdapterFactoryOptions
): DrizzleAdapter
```

**Parameters:**
- `db` - The Drizzle database instance (schema and driver auto-detected)
- `factoryOptions` - Optional configuration:
  - `schema?` - Override auto-detected schema
  - `driver?` - Override auto-detected driver
  - `relations?` - Provide relations for auto-detection
  - `relationships?` - Manual relationship mappings
  - `autoDetectRelationships?` - Enable/disable auto-detection (default: true)
  - `options?` - Adapter configuration options
  - `meta?` - Custom adapter metadata

**Returns:** Fully typed `DrizzleAdapter` instance

### DrizzleAdapter Class

The main adapter class that implements the `TableAdapter` interface.

#### Constructor

```typescript
new DrizzleAdapter<TSchema, TDriver>(config: DrizzleAdapterConfig<TSchema, TDriver>)
```

**Configuration:**
```typescript
interface DrizzleAdapterConfig<TSchema, TDriver> {
  db: DrizzleDatabase<TDriver>;     // Drizzle database instance
  schema: TSchema;                   // Schema with tables
  driver: TDriver;                   // 'postgres' | 'mysql' | 'sqlite'
  relations?: Record<string, Relations>; // Drizzle relations for auto-detection
  autoDetectRelationships?: boolean; // Enable auto-detection (default: true)
  relationships?: RelationshipMap;   // Manual relationship mappings
  options?: DrizzleAdapterOptions;    // Adapter options
  meta?: Partial<AdapterMeta>;       // Custom metadata
}
```

#### Methods

- `fetchData(params)` - Fetch data with filtering, sorting, and pagination
  - `params.columns` - Array of column IDs to fetch
  - `params.primaryTable?` - Explicit primary table (optional, auto-detected if not provided)
  - `params.filters?` - Array of filter states
  - `params.sorting?` - Array of sort states
  - `params.pagination?` - Pagination configuration
  - Returns: `Promise<FetchDataResult<TRecord>>`

- `getFilterOptions(columnId)` - Get available filter options for a column
- `getFacetedValues(columnId)` - Get faceted values for a column
- `getMinMaxValues(columnId)` - Get min/max values for number columns
- `createRecord(data)` - Create a new record
- `updateRecord(id, data)` - Update an existing record
- `deleteRecord(id)` - Delete a record
- `bulkUpdate(ids, data)` - Bulk update records
- `bulkDelete(ids)` - Bulk delete records
- `exportData(params)` - Export data in various formats
- `subscribe(callback)` - Subscribe to real-time updates

### RelationshipMap

Maps column IDs to relationship paths:

```typescript
interface RelationshipMap {
  [columnId: string]: RelationshipPath;
}

interface RelationshipPath {
  from: string;           // Source table
  to: string;              // Target table
  foreignKey: string;      // Foreign key field in target table
  localKey: string;        // Local key field in source table
  cardinality: 'one' | 'many';
  nullable?: boolean;
  joinType?: 'left' | 'inner';
}
```

## Database-Specific Notes

### PostgreSQL Array Column Filtering

The Drizzle adapter supports filtering on PostgreSQL array columns (e.g., `uuid[]`, `text[]`, `integer[]`) using `multiOption` filter types. This enables efficient filtering on array columns that store relationships, tags, permissions, or other multi-value fields.

#### Supported Array Types

- `uuid[]` - UUID arrays
- `text[]` - Text arrays
- `integer[]` - Integer arrays
- `bigint[]` - BigInt arrays
- `boolean[]` - Boolean arrays
- `numeric[]` - Numeric arrays
- `varchar[]` - Varchar arrays

#### Schema Definition

Define array columns in your Drizzle schema:

```typescript
import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';

export const eventsTable = pgTable('events', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  organizerIds: uuid('organizer_ids').array().notNull(), // uuid[]
  tags: text('tags').array(), // text[]
  categoryIds: integer('category_ids').array(), // integer[]
});
```

#### Supported Operators

**Option Operators** (for `type: 'option'`):
- `isAnyOf` - Array overlaps with any of the specified values (`column && ARRAY[values]::type[]`)
- `isNoneOf` - Array does not overlap with any of the specified values (`NOT (column && ARRAY[values]::type[])`)
- `isNull` - Array column is NULL
- `isNotNull` - Array column is not NULL

**MultiOption Operators** (for `type: 'multiOption'`):
- `includes` - Array contains a specific value (`column @> ARRAY[value]::type[]`)
- `excludes` - Array does not contain a specific value (`NOT (column @> ARRAY[value]::type[])`)
- `includesAny` - Array overlaps with any of the specified values (`column && ARRAY[values]::type[]`)
- `includesAll` - Array contains all of the specified values (`column @> ARRAY[values]::type[]`)
- `excludesAny` - Array does not overlap with any of the specified values (`NOT (column && ARRAY[values]::type[])`)
- `excludesAll` - Array does not contain all of the specified values (`NOT (column @> ARRAY[values]::type[])`)
- `isNull` - Array column is NULL
- `isNotNull` - Array column is not NULL

#### Usage Examples

**Filter events by organizer IDs (uuid[]):**

```typescript
const result = await adapter.fetchData({
  primaryTable: 'events',
  columns: ['id', 'name', 'organizerIds'],
  filters: [
    {
      columnId: 'organizerIds',
      operator: 'isAnyOf',
      values: ['019a4f81-2758-73f9-9bc2-5832f88c056c', '019a4f81-2758-73f9-9bc2-5832f88c056d'],
      type: 'option',
    },
  ],
});
```

**Filter events by tags (text[]):**

```typescript
const result = await adapter.fetchData({
  primaryTable: 'events',
  columns: ['id', 'name', 'tags'],
  filters: [
    {
      columnId: 'tags',
      operator: 'includesAny',
      values: ['typescript', 'javascript'],
      type: 'multiOption',
    },
  ],
});
```

**Filter events by category IDs (integer[]):**

```typescript
const result = await adapter.fetchData({
  primaryTable: 'events',
  columns: ['id', 'name', 'categoryIds'],
  filters: [
    {
      columnId: 'categoryIds',
      operator: 'includesAll',
      values: ['1', '3'], // Note: values are strings in FilterState
      type: 'multiOption',
    },
  ],
});
```

**Filter events with NULL array columns:**

```typescript
const result = await adapter.fetchData({
  primaryTable: 'events',
  columns: ['id', 'name', 'tags'],
  filters: [
    {
      columnId: 'tags',
      operator: 'isNull',
      values: [],
      type: 'multiOption',
    },
  ],
});
```

#### Performance Considerations

- **GIN Indexes**: For optimal performance with array columns, create GIN indexes:

```sql
CREATE INDEX idx_events_organizer_ids ON events USING GIN (organizer_ids);
CREATE INDEX idx_events_tags ON events USING GIN (tags);
```

- **Array Operators**: The adapter uses PostgreSQL's native array operators (`&&`, `@>`) which are optimized for array columns and can leverage GIN indexes.

#### Common Use Cases

1. **Event Management Systems**: Filter events by organizer IDs stored as `uuid[]`
2. **Content Management Systems**: Filter posts/articles by tag IDs or category IDs
3. **Permission Systems**: Filter users by role arrays or resources by permission arrays
4. **Many-to-Many Relationships**: Handle many-to-many relationships stored as arrays in PostgreSQL

### PostgreSQL

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

const sql = postgres('postgresql://user:password@localhost:5432/database');
const db = drizzle(sql, { schema: { ...schema, ...relationsSchema } });

const adapter = drizzleAdapter(db);
```

### MySQL

```typescript
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'user',
  password: 'password',
  database: 'database'
});
const db = drizzle(connection, { schema: { ...schema, ...relationsSchema } });

const adapter = drizzleAdapter(db);
```

### SQLite

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';

const sqlite = new Database('database.db');
const db = drizzle(sqlite, { schema: { ...schema, ...relationsSchema } });

const adapter = drizzleAdapter(db);
```

## Error Handling

The adapter provides specific error types for different scenarios:

```typescript
import { 
  DrizzleAdapterError,
  RelationshipError,
  QueryError,
  SchemaError
} from '@better-tables/adapters-drizzle';

try {
  const result = await adapter.fetchData({ filters: invalidFilters });
} catch (error) {
  if (error instanceof RelationshipError) {
    console.error('Relationship issue:', error.message);
  } else if (error instanceof QueryError) {
    console.error('Query issue:', error.message);
  } else if (error instanceof SchemaError) {
    console.error('Schema issue:', error.message);
  }
}
```

## Performance Tips

1. **Use Indexes** - Ensure foreign key columns are indexed
2. **Limit Joins** - Use `maxJoins` option to prevent excessive joins
3. **Enable Caching** - Use query result caching for repeated requests
4. **Batch Large Queries** - Enable batching for large datasets
5. **Monitor Performance** - Enable performance tracking to identify slow queries
6. **Cache Adapter Instance** - Reuse the adapter instance instead of creating new ones

## Migration from Raw Drizzle

If you're migrating from raw Drizzle queries, the adapter provides a seamless transition:

### Before (Raw Drizzle)

```typescript
const users = await db
  .select()
  .from(usersTable)
  .leftJoin(profilesTable, eq(usersTable.id, profilesTable.userId))
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
  .where(and(
    ilike(usersTable.name, '%John%'),
    eq(postsTable.published, true)
  ))
  .orderBy(asc(usersTable.name))
  .limit(10);
```

### After (Drizzle Adapter)

```typescript
import type { FilterState, SortingState } from '@better-tables/core';

const filters: FilterState[] = [
  { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
  { columnId: 'posts.published', type: 'boolean', operator: 'isTrue', values: [] }
];

const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];

const result = await adapter.fetchData({
  columns: ['name', 'email', 'profile.bio', 'posts.title'],
  filters,
  sorting,
  pagination: { page: 1, limit: 10 }
});
```

## Examples

See the [demo app](../../apps/demo) for a complete working example:

- **Adapter Setup**: [apps/demo/lib/adapter.ts](../../apps/demo/lib/adapter.ts)
- **Column Definitions**: [apps/demo/lib/columns/user-columns.tsx](../../apps/demo/lib/columns/user-columns.tsx)
- **Server Component**: [apps/demo/app/page.tsx](../../apps/demo/app/page.tsx)

## Documentation

For detailed documentation, see:

- **[Core Package README](../core/README.md)** - Column builders and state management
- **[Getting Started Guide](../../docs/GETTING_STARTED.md)** - Installation and setup
- **[Adapters Architecture](../../docs/adapters/ADAPTERS_ARCHITECTURE.md)** - How adapters work
- **[Advanced Usage](./docs/ADVANCED_USAGE.md)** - Advanced patterns and examples

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

See [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Related Packages

- **[@better-tables/core](../core)** - Core functionality and column builders
- **[@better-tables/ui](../ui)** - React components built on top of core
- **[Demo App](../../apps/demo)** - Complete working example

## Support

- **GitHub Issues** - Report bugs or request features
- **GitHub Discussions** - Ask questions and share ideas
- **Documentation** - Comprehensive guides in the `docs/` directory

---

Built with ❤️ by the Better Tables team. This package is part of the [Better Tables](https://github.com/Better-Tables/better-tables) project.
