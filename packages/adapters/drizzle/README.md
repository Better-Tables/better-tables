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
const db = drizzle(sqlite);

// For PostgreSQL
// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// const sql = postgres('postgresql://user:password@localhost:5432/database');
// const db = drizzle(sql);

// For MySQL
// import { drizzle } from 'drizzle-orm/mysql2';
// import mysql from 'mysql2/promise';
// const connection = await mysql.createConnection({
//   host: 'localhost',
//   user: 'user',
//   password: 'password',
//   database: 'database'
// });
// const db = drizzle(connection);
```

### 3. Create the Adapter

```typescript
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';

const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'sqlite', // 'postgres' | 'mysql' | 'sqlite'
  autoDetectRelationships: true,
});
```

### 4. Define Columns with Dot Notation

```typescript
import { columnBuilder as cb } from '@better-tables/core';

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

### Custom Relationship Mapping

If you need more control over relationships, you can provide manual mappings:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'sqlite',
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
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'sqlite',
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
// Filter across multiple tables
const filters = [
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

const result = await adapter.fetchData({ filters });
```

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

## API Reference

### DrizzleAdapter

The main adapter class that implements the `TableAdapter` interface.

#### Constructor Options

```typescript
interface DrizzleAdapterConfig<TSchema> {
  db: any;                    // Drizzle database instance
  schema: TSchema;            // Schema with tables and relations
  mainTable: keyof TSchema;   // Main table to query from
  driver: 'postgres' | 'mysql' | 'sqlite';
  autoDetectRelationships?: boolean;
  relationships?: RelationshipMap;
  options?: DrizzleAdapterOptions;
  meta?: Partial<AdapterMeta>;
}
```

#### Methods

- `fetchData(params)` - Fetch data with filtering, sorting, and pagination
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
  to: string;             // Target table
  foreignKey: string;     // Foreign key field in target table
  localKey: string;       // Local key field in source table
  cardinality: 'one' | 'many';
  nullable?: boolean;
  joinType?: 'left' | 'inner';
}
```

## Database-Specific Notes

### PostgreSQL

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const sql = postgres('postgresql://user:password@localhost:5432/database');
const db = drizzle(sql);

const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'postgres',
});
```

### MySQL

```typescript
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'user',
  password: 'password',
  database: 'database'
});
const db = drizzle(connection);

const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'mysql',
});
```

### SQLite

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('database.db');
const db = drizzle(sqlite);

const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'sqlite',
});
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
const result = await adapter.fetchData({
  filters: [
    { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
    { columnId: 'posts.published', type: 'boolean', operator: 'isTrue', values: [] }
  ],
  sorting: [{ columnId: 'name', direction: 'asc' }],
  pagination: { page: 1, limit: 10 }
});
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
