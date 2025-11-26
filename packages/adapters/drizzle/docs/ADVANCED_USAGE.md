# Advanced Usage Guide

This guide covers advanced features and patterns for the Drizzle adapter.

## Table of Contents

- [Custom Relationship Mappings](#custom-relationship-mappings)
- [Array Foreign Key Relationships](#array-foreign-key-relationships)
- [Query Optimization Strategies](#query-optimization-strategies)
- [Handling Many-to-Many Relationships](#handling-many-to-many-relationships)
- [Aggregate Columns](#aggregate-columns)
- [Subqueries for Complex Cases](#subqueries-for-complex-cases)
- [Custom Filter Operators](#custom-filter-operators)
- [Performance Monitoring](#performance-monitoring)
- [Error Handling Patterns](#error-handling-patterns)
- [Testing Strategies](#testing-strategies)

## Array Foreign Key Relationships

The adapter now supports array foreign key relationships, where a column contains an array of foreign key references. This is automatically detected and handled with database-specific join syntax.

### PostgreSQL Array Foreign Keys

PostgreSQL supports native array types, which can be used for foreign key arrays:

```typescript
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

const events = pgTable('events', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  organizerId: uuid('organizer_id')
    .array()
    .references(() => users.id)
    .notNull(),
});

// The adapter automatically detects this relationship
// Use dot notation to access organizer fields:
const columns = [
  cb.text().id('organizers.name').displayName('Organizers')
    .accessor(event => event.organizers?.map(org => org.name).join(', ') || '')
    .build(),
];

// Query with array FK join
const result = await adapter.fetchData({
  columns: ['title', 'organizers.name', 'organizers.username', 'organizers.image'],
});
// Returns nested structure: { title: 'Event', organizers: [{ name: 'John', ... }] }
```

The adapter uses PostgreSQL's `ANY()` operator for efficient array joins:
```sql
SELECT * FROM events
LEFT JOIN users ON users.id = ANY(events.organizer_id)
```

### MySQL JSON Array Foreign Keys

MySQL doesn't have native arrays, but you can use JSON columns:

```typescript
import { mysqlTable, json, varchar } from 'drizzle-orm/mysql-core';

const events = mysqlTable('events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  organizerId: json('organizer_id'), // JSON array: ["uuid1", "uuid2"]
});

// Works the same way - adapter detects JSON array with FK references
const result = await adapter.fetchData({
  columns: ['title', 'organizers.name'],
});
```

The adapter uses `JSON_SEARCH()` for MySQL:
```sql
SELECT * FROM events
LEFT JOIN users ON JSON_SEARCH(events.organizer_id, 'one', users.id) IS NOT NULL
```

Note: For MySQL 8.0.17+, the `MEMBER OF` operator could also be used, but `JSON_SEARCH` provides better compatibility with MySQL 5.7+.

### SQLite JSON Array Foreign Keys

SQLite also uses JSON columns for arrays:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const events = sqliteTable('events', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  organizerId: text('organizer_id'), // JSON array: "[1, 2, 3]"
});

// Same API, different database
const result = await adapter.fetchData({
  columns: ['title', 'organizers.name'],
});
```

The adapter uses `json_each()` for SQLite:
```sql
SELECT * FROM events
LEFT JOIN users ON EXISTS (
  SELECT 1 FROM json_each(events.organizer_id) 
  WHERE json_each.value = users.id
)
```

### Automatic Detection

The adapter automatically detects array foreign keys by:
1. Identifying array columns (PostgreSQL `.array()`, MySQL/SQLite JSON columns)
2. Checking for foreign key references in the column metadata
3. Creating relationship paths with `isArray: true` flag
4. Generating pluralized alias names (e.g., `organizerId` → `organizers`)

### Manual Override

If you need to override the auto-detected relationship:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  driver: 'postgres',
  relationships: {
    'organizers.name': {
      from: 'events',
      to: 'users',
      foreignKey: 'id',
      localKey: 'organizerId',
      cardinality: 'many',
      nullable: true,
      joinType: 'left',
      isArray: true, // Explicitly mark as array FK
    },
  },
});
```

### Best Practices

1. **Index Array Columns**: For PostgreSQL, use GIN indexes on array columns:
   ```typescript
   index('idx_events_organizer_id').using('gin', table.organizerId)
   ```

2. **Use Appropriate Data Types**: 
   - PostgreSQL: Use native arrays for better performance
   - MySQL/SQLite: Use JSON columns with proper validation

3. **Handle Empty Arrays**: The adapter gracefully handles empty arrays and null values

4. **Performance**: Array FK joins can be slower than regular joins - use indexes and limit result sets

## Custom Relationship Mappings

### Overriding Auto-Detection

Sometimes the automatic relationship detection doesn't capture the exact relationship you need. You can override specific relationships:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'postgres',
  autoDetectRelationships: true,
  relationships: {
    // Override the auto-detected profile relationship
    'profile.bio': {
      from: 'users',
      to: 'profiles',
      foreignKey: 'userId',
      localKey: 'id',
      cardinality: 'one',
      nullable: true,
      joinType: 'left'
    },
    // Add a custom relationship for user preferences
    'preferences.theme': {
      from: 'users',
      to: 'user_preferences',
      foreignKey: 'userId',
      localKey: 'id',
      cardinality: 'one',
      nullable: true,
      joinType: 'left'
    }
  }
});
```

### Complex Multi-Level Relationships

For deeply nested relationships, you can define custom paths:

```typescript
// Schema: users -> companies -> departments -> employees
const relationships = {
  'company.department.employee.name': {
    from: 'users',
    to: 'companies',
    foreignKey: 'companyId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left'
  },
  'company.department.name': {
    from: 'companies',
    to: 'departments',
    foreignKey: 'companyId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left'
  },
  'department.employee.name': {
    from: 'departments',
    to: 'employees',
    foreignKey: 'departmentId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left'
  }
};
```

## Query Optimization Strategies

### Join Optimization

The adapter automatically optimizes joins, but you can fine-tune the behavior:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'postgres',
  options: {
    optimization: {
      maxJoins: 3,           // Limit maximum joins per query
      enableBatching: true,  // Enable batch processing for large datasets
      batchSize: 1000        // Process 1000 records at a time
    }
  }
});
```

### Query Result Caching

Implement intelligent caching strategies:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'postgres',
  options: {
    cache: {
      enabled: true,
      ttl: 300000,    // 5 minutes
      maxSize: 10000  // Maximum 10,000 cached queries
    }
  }
});

// Cache is automatically invalidated on data changes
await adapter.createRecord({ name: 'New User' });
// All cached queries are now invalidated
```

### Database-Specific Optimizations

#### PostgreSQL

```typescript
// Use prepared statements for better performance
const adapter = new DrizzleAdapter({
  db: drizzle(sql, { prepare: true }),
  schema,
  mainTable: 'users',
  driver: 'postgres',
  options: {
    optimization: {
      enableBatching: true,
      batchSize: 2000  // PostgreSQL can handle larger batches
    }
  }
});
```

#### MySQL

```typescript
// Optimize for MySQL's query execution
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'mysql',
  options: {
    optimization: {
      maxJoins: 5,     // MySQL has join limits
      batchSize: 500   // Smaller batches for MySQL
    }
  }
});
```

#### SQLite

```typescript
// Optimize for SQLite's single-threaded nature
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'sqlite',
  options: {
    optimization: {
      enableBatching: false,  // SQLite doesn't benefit from batching
      maxJoins: 10           // SQLite can handle more joins
    }
  }
});
```

## Handling Many-to-Many Relationships

### Junction Tables

For many-to-many relationships, you'll need to handle junction tables:

```typescript
// Schema with many-to-many: users <-> roles
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

const userRoles = sqliteTable('user_roles', {
  userId: integer('user_id').notNull().references(() => users.id),
  roleId: integer('role_id').notNull().references(() => roles.id),
});

// Custom relationship mapping
const relationships = {
  'roles.name': {
    from: 'users',
    to: 'user_roles',
    foreignKey: 'userId',
    localKey: 'id',
    cardinality: 'many',
    joinType: 'left'
  },
  'role.name': {
    from: 'user_roles',
    to: 'roles',
    foreignKey: 'roleId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left'
  }
};
```

### Aggregate Many-to-Many Data

```typescript
const columns = [
  // Count of roles
  cb.number().id('roles_count').displayName('Role Count')
    .accessor(user => user.roles?.length || 0).build(),
  
  // List of role names
  cb.text().id('role_names').displayName('Roles')
    .accessor(user => user.roles?.map(role => role.name).join(', ') || '')
    .build(),
  
  // Check if user has specific role
  cb.boolean().id('is_admin').displayName('Is Admin')
    .accessor(user => user.roles?.some(role => role.name === 'admin') || false)
    .build(),
];
```

## Aggregate Columns

### Built-in Aggregates

The adapter supports various aggregate functions:

```typescript
const columns = [
  // Count aggregates
  cb.number().id('posts_count').displayName('Posts')
    .accessor(user => user.posts?.length || 0).build(),
  
  // Sum aggregates
  cb.number().id('total_views').displayName('Total Views')
    .accessor(user => user.posts?.reduce((sum, post) => sum + (post.views || 0), 0) || 0)
    .build(),
  
  // Average aggregates
  cb.number().id('avg_rating').displayName('Avg Rating')
    .accessor(user => {
      const ratings = user.posts?.map(post => post.rating).filter(Boolean) || [];
      return ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
    }).build(),
  
  // Min/Max aggregates
  cb.date().id('latest_post').displayName('Latest Post')
    .accessor(user => {
      const dates = user.posts?.map(post => post.createdAt).filter(Boolean) || [];
      return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    }).build(),
];
```

### Custom Aggregate Functions

For complex aggregations, you can create custom accessor functions:

```typescript
const columns = [
  cb.text().id('post_titles').displayName('Post Titles')
    .accessor(user => user.posts?.map(post => post.title).join(' | ') || '')
    .build(),
  
  cb.number().id('engagement_score').displayName('Engagement Score')
    .accessor(user => {
      const posts = user.posts || [];
      const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
      const totalComments = posts.reduce((sum, post) => sum + (post.comments || 0), 0);
      return totalLikes + (totalComments * 2); // Comments worth 2x likes
    }).build(),
];
```

## Subqueries for Complex Cases

### When Joins Aren't Enough

Sometimes you need subqueries for complex aggregations:

```typescript
// Custom query for complex aggregations
class CustomDrizzleAdapter extends DrizzleAdapter {
  async getComplexAggregates(userIds: string[]) {
    const subquery = this.db
      .select({
        userId: posts.userId,
        postCount: count(posts.id),
        totalViews: sum(posts.views),
        avgRating: avg(posts.rating)
      })
      .from(posts)
      .where(inArray(posts.userId, userIds))
      .groupBy(posts.userId);

    const results = await this.db
      .select()
      .from(users)
      .leftJoin(subquery, eq(users.id, subquery.userId))
      .where(inArray(users.id, userIds));

    return results;
  }
}
```

### Window Functions

For advanced analytics, you can use window functions:

```typescript
const columns = [
  cb.number().id('user_rank').displayName('User Rank')
    .accessor(user => user.rank || 0).build(),
];

// In your query building
const rankQuery = this.db
  .select({
    id: users.id,
    name: users.name,
    postCount: count(posts.id),
    rank: sql`RANK() OVER (ORDER BY ${count(posts.id)} DESC)`
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId))
  .groupBy(users.id)
  .orderBy(desc(count(posts.id)));
```

## Custom Filter Operators

### Extending Filter Support

You can extend the filter handler with custom operators:

```typescript
class CustomFilterHandler extends FilterHandler {
  protected mapOperatorToCondition(column: any, operator: FilterOperator, values: unknown[]): SQL | SQLWrapper {
    // Handle custom operators
    switch (operator) {
      case 'hasAnyRole':
        return sql`EXISTS (
          SELECT 1 FROM user_roles ur 
          JOIN roles r ON ur.role_id = r.id 
          WHERE ur.user_id = ${column} AND r.name IN (${sql.join(values.map(v => sql`${v}`), sql`, `)})
        )`;
      
      case 'createdInLastDays':
        const days = values[0] as number;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return gte(column, cutoffDate);
      
      default:
        return super.mapOperatorToCondition(column, operator, values);
    }
  }
}
```

### Geographic Filters

For location-based filtering:

```typescript
const columns = [
  cb.text().id('location').displayName('Location')
    .accessor(user => `${user.latitude}, ${user.longitude}`).build(),
];

// Custom geographic filter
const geographicFilter = {
  columnId: 'location',
  type: 'custom',
  operator: 'withinRadius',
  values: [latitude, longitude, radiusInKm]
};
```

## Performance Monitoring

### Query Performance Tracking

Enable detailed performance monitoring:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'postgres',
  options: {
    performance: {
      trackTiming: true,
      maxQueryTime: 5000,  // Warn if query takes > 5 seconds
    },
    logging: {
      enabled: true,
      level: 'info',
      logQueries: true
    }
  }
});

// Monitor query performance
adapter.subscribe((event) => {
  if (event.type === 'query_executed') {
    console.log(`Query executed in ${event.executionTime}ms`);
    if (event.executionTime > 1000) {
      console.warn('Slow query detected:', event.query);
    }
  }
});
```

### Memory Usage Monitoring

```typescript
class MonitoredDrizzleAdapter extends DrizzleAdapter {
  private memoryUsage: number[] = [];

  async fetchData(params: FetchDataParams) {
    const startMemory = process.memoryUsage().heapUsed;
    const result = await super.fetchData(params);
    const endMemory = process.memoryUsage().heapUsed;
    
    const memoryDelta = endMemory - startMemory;
    this.memoryUsage.push(memoryDelta);
    
    // Keep only last 100 measurements
    if (this.memoryUsage.length > 100) {
      this.memoryUsage.shift();
    }
    
    return {
      ...result,
      meta: {
        ...result.meta,
        memoryUsage: memoryDelta,
        avgMemoryUsage: this.memoryUsage.reduce((a, b) => a + b, 0) / this.memoryUsage.length
      }
    };
  }
}
```

## Error Handling Patterns

### Graceful Degradation

Handle errors gracefully with fallback strategies:

```typescript
class ResilientDrizzleAdapter extends DrizzleAdapter {
  async fetchData(params: FetchDataParams) {
    try {
      return await super.fetchData(params);
    } catch (error) {
      if (error instanceof QueryError) {
        // Log error and return empty result
        console.error('Query failed, returning empty result:', error.message);
        return {
          data: [],
          total: 0,
          pagination: params.pagination ? {
            page: params.pagination.page,
            limit: params.pagination.limit,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          } : undefined,
          meta: {
            error: error.message,
            fallback: true
          }
        };
      }
      throw error;
    }
  }
}
```

### Retry Logic

Implement retry logic for transient failures:

```typescript
class RetryableDrizzleAdapter extends DrizzleAdapter {
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError!;
  }

  async fetchData(params: FetchDataParams) {
    return this.withRetry(() => super.fetchData(params));
  }
}
```

## Testing Strategies

### Unit Testing

Test individual components:

```typescript
import { describe, it, expect } from 'vitest';
import { RelationshipDetector } from '@better-tables/adapters-drizzle';

describe('RelationshipDetector', () => {
  it('should detect relationships correctly', () => {
    const detector = new RelationshipDetector();
    const relationships = detector.detectFromSchema(schema, relationsSchema);
    
    expect(relationships['users.profile']).toBeDefined();
    expect(relationships['users.posts']).toBeDefined();
  });
});
```

### Integration Testing

Test with real database:

```typescript
describe('DrizzleAdapter Integration', () => {
  let adapter: DrizzleAdapter;
  let db: any;

  beforeEach(async () => {
    // Set up test database
    db = await setupTestDatabase();
    adapter = new DrizzleAdapter({
      db,
      schema: testSchema,
      mainTable: 'users',
      driver: 'sqlite'
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('should handle complex queries', async () => {
    const result = await adapter.fetchData({
      filters: [
        { columnId: 'profile.bio', type: 'text', operator: 'contains', values: ['developer'] },
        { columnId: 'posts_count', type: 'number', operator: 'greaterThan', values: [5] }
      ],
      sorting: [{ columnId: 'name', direction: 'asc' }],
      pagination: { page: 1, limit: 10 }
    });

    expect(result.data).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
  });
});
```

### Performance Testing

Benchmark query performance:

```typescript
describe('Performance Tests', () => {
  it('should handle large datasets efficiently', async () => {
    const startTime = Date.now();
    
    const result = await adapter.fetchData({
      pagination: { page: 1, limit: 10000 }
    });
    
    const executionTime = Date.now() - startTime;
    
    expect(executionTime).toBeLessThan(5000); // Should complete in < 5 seconds
    expect(result.data).toHaveLength(10000);
  });
});
```

## Best Practices

1. **Index Foreign Keys** - Always index foreign key columns for better join performance
2. **Use Appropriate Join Types** - Use `left` joins for optional relationships, `inner` for required ones
3. **Limit Result Sets** - Always use pagination for large datasets
4. **Monitor Query Performance** - Enable performance tracking in development
5. **Handle Errors Gracefully** - Implement proper error handling and fallbacks
6. **Test Edge Cases** - Test with empty results, null values, and invalid data
7. **Use Caching Wisely** - Cache frequently accessed data, but invalidate on changes
8. **Optimize Database Schema** - Design your schema with query patterns in mind

## Troubleshooting

### Common Issues

1. **Slow Queries** - Check if foreign keys are indexed, reduce number of joins
2. **Memory Issues** - Enable batching for large datasets, monitor memory usage
3. **Type Errors** - Ensure schema types match your TypeScript definitions
4. **Relationship Errors** - Verify relationship mappings are correct
5. **Cache Issues** - Check cache TTL settings and invalidation logic

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const adapter = new DrizzleAdapter({
  db,
  schema,
  mainTable: 'users',
  driver: 'postgres',
  options: {
    logging: {
      enabled: true,
      level: 'debug',
      logQueries: true
    }
  }
});
```

This will log all queries and their execution times, helping you identify performance bottlenecks.
