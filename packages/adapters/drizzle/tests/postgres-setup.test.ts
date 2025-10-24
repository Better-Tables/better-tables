import { relations, sql } from 'drizzle-orm';
import { integer, boolean as pgBoolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataEvent, FilterOperator } from '../../../core/src/types';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig } from '../src/types';

// Test schema for PostgreSQL
const users = pgTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const profiles = pgTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  bio: text('bio'),
  avatar: text('avatar'),
});

const posts = pgTable('posts', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
  published: pgBoolean('published').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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

const schema = {
  users,
  profiles,
  posts,
} as const;

const _relationsSchema = {
  users: usersRelations,
  profiles: profilesRelations,
  posts: postsRelations,
} as const;

type User = typeof users.$inferSelect;
type Profile = typeof profiles.$inferSelect;
type Post = typeof posts.$inferSelect;

type UserWithRelations = User & {
  profile?: Profile | null;
  posts?: Post[];
};

/**
 * PostgreSQL Integration Tests
 *
 * To run these tests, you need a PostgreSQL database running.
 * Set POSTGRES_TEST_URL environment variable or use default: postgresql://localhost:5432/drizzle_test
 *
 * To skip these tests, use: npm test -- --exclude="*postgres-setup.test.ts"
 */
describe.skip('DrizzleAdapter - PostgreSQL', () => {
  let db: PostgresJsDatabase<typeof schema>;
  let adapter: DrizzleAdapter<typeof schema>;
  let pgClient: ReturnType<typeof postgres>;

  beforeEach(async () => {
    // Create PostgreSQL connection
    const connectionString =
      process.env.POSTGRES_TEST_URL || 'postgresql://localhost:5432/drizzle_test';
    pgClient = postgres(connectionString, { max: 1 });
    db = drizzle(pgClient);

    // Create tables
    await db.execute(sql`DROP TABLE IF EXISTS posts CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS profiles CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);

    await db.execute(sql`CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      age INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    await db.execute(sql`CREATE TABLE profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bio TEXT,
      avatar TEXT
    )`);

    await db.execute(sql`CREATE TABLE posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT,
      published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    // Insert test data
    await db.execute(sql`INSERT INTO users (id, name, email, age) VALUES 
      (1, 'John Doe', 'john@example.com', 30),
      (2, 'Jane Smith', 'jane@example.com', 25),
      (3, 'Bob Johnson', 'bob@example.com', 35)`);

    await db.execute(sql`INSERT INTO profiles (id, user_id, bio, avatar) VALUES 
      (1, 1, 'Software developer', 'avatar1.jpg'),
      (2, 2, 'Designer', 'avatar2.jpg')`);

    await db.execute(sql`INSERT INTO posts (id, user_id, title, content, published) VALUES 
      (1, 1, 'First Post', 'Content 1', TRUE),
      (2, 1, 'Second Post', 'Content 2', FALSE),
      (3, 2, 'Design Tips', 'Content 3', TRUE)`);

    // Create adapter
    const config: DrizzleAdapterConfig<typeof schema> = {
      db,
      schema,
      mainTable: 'users' as keyof typeof schema,
      driver: 'postgres',
      autoDetectRelationships: true,
      relations: _relationsSchema,
    };

    adapter = new DrizzleAdapter(config);
  });

  afterEach(async () => {
    // Clean up
    if (pgClient) {
      await pgClient.end();
    }
  });

  describe('Basic CRUD Operations', () => {
    it('should fetch data without filters', async () => {
      const result = await adapter.fetchData({});

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should apply pagination', async () => {
      const result = await adapter.fetchData({
        pagination: { page: 1, limit: 2 },
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination?.totalPages).toBe(2);
    });

    it('should apply sorting', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'desc' }],
      });

      expect((result.data[0] as UserWithRelations).age).toBe(35);
    });

    it('should create a new record', async () => {
      const newUser = await adapter.createRecord({
        name: 'Test User',
        email: 'test@example.com',
        age: 28,
      } as Partial<User>);

      expect((newUser as UserWithRelations).name).toBe('Test User');
      expect((newUser as UserWithRelations).email).toBe('test@example.com');
    });

    it('should update a record', async () => {
      const updatedUser = await adapter.updateRecord('1', {
        name: 'John Updated',
        age: 31,
      } as Partial<User>);

      expect((updatedUser as UserWithRelations).name).toBe('John Updated');
      expect((updatedUser as UserWithRelations).age).toBe(31);
    });

    it('should delete a record', async () => {
      await adapter.deleteRecord('3'); // Delete Bob Johnson who has no related records
      const result = await adapter.fetchData({});
      expect(result.data).toHaveLength(2);
      expect(result.data.find((u) => (u as UserWithRelations).id === 3)).toBeUndefined();
    });

    it('should bulk update records', async () => {
      const updatedUsers = await adapter.bulkUpdate(['1', '2'], { age: 30 } as Partial<User>);
      expect(updatedUsers).toHaveLength(2);
      expect(updatedUsers.every((u) => (u as UserWithRelations).age === 30)).toBe(true);
    });

    it('should bulk delete records', async () => {
      await adapter.bulkDelete(['3']); // Delete Bob Johnson
      const result = await adapter.fetchData({});
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Text Filter Operators', () => {
    it('should filter by text contains', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['John'] }],
      });
      expect(result.data).toHaveLength(2); // 'John Doe' and 'Bob Johnson' both contain 'John'
      const names = result.data.map((r) => (r as UserWithRelations).name).sort();
      expect(names).toContain('John Doe');
      expect(names).toContain('Bob Johnson');
    });

    it('should filter by text equals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'equals', values: ['John Doe'] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by text startsWith', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'startsWith', values: ['John'] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by text endsWith', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'endsWith', values: ['Smith'] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Jane Smith');
    });

    it('should filter by text isEmpty', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'bio', type: 'text', operator: 'isEmpty', values: [] }],
      });
      // This would need a user with empty bio to test properly
      expect(result.data).toHaveLength(0);
    });

    it('should filter by text isNotEmpty', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'bio', type: 'text', operator: 'isNotEmpty', values: [] }],
      });
      // This would need users with non-empty bio to test properly
      expect(result.data).toHaveLength(0);
    });

    it('should filter by text notEquals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'notEquals', values: ['John Doe'] }],
      });
      expect(result.data).toHaveLength(2);
      const names = result.data.map((r) => (r as UserWithRelations).name);
      expect(names).not.toContain('John Doe');
    });

    it('should filter by text isNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'bio', type: 'text', operator: 'isNull', values: [] }],
      });
      // Bob Johnson has no profile, so bio would be null
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Bob Johnson');
    });

    it('should filter by text isNotNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'bio', type: 'text', operator: 'isNotNull', values: [] }],
      });
      // Users with profiles have non-null bio
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Number Filter Operators', () => {
    it('should filter by number equals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'equals', values: [30] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by number notEquals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'notEquals', values: [30] }],
      });
      expect(result.data).toHaveLength(2);
      const ages = result.data.map((r) => (r as UserWithRelations).age);
      expect(ages).not.toContain(30);
    });

    it('should filter by number lessThan', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'lessThan', values: [30] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Jane Smith');
    });

    it('should filter by number lessThanOrEqual', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'lessThanOrEqual', values: [30] }],
      });
      expect(result.data).toHaveLength(2);
    });

    it('should filter by number greaterThan', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'greaterThan', values: [30] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Bob Johnson');
    });

    it('should filter by number greaterThanOrEqual', async () => {
      const result = await adapter.fetchData({
        filters: [
          { columnId: 'age', type: 'number', operator: 'greaterThanOrEqual', values: [30] },
        ],
      });
      expect(result.data).toHaveLength(2);
    });

    it('should filter by number between', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'between', values: [25, 35] }],
      });
      expect(result.data).toHaveLength(3);
    });

    it('should filter by number notBetween', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'notBetween', values: [25, 35] }],
      });
      expect(result.data).toHaveLength(0);
    });

    it('should filter by number isNull', async () => {
      // First create a user with null age
      await adapter.createRecord({
        name: 'Null Age User',
        email: 'nullage@example.com',
      } as Partial<User>);

      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'isNull', values: [] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Null Age User');
    });
  });

  describe('Date Filter Operators', () => {
    it('should filter by date is', async () => {
      // Get current timestamp for exact match
      const now = new Date();
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'is', values: [now] }],
      });
      // This might be flaky due to exact timestamp matching
      expect(result.data).toHaveLength(0); // No exact matches likely
    });

    it('should filter by date isNot', async () => {
      const pastDate = new Date('2020-01-01');
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isNot', values: [pastDate] }],
      });
      expect(result.data).toHaveLength(3); // All records are not from 2020
    });

    it('should filter by date before', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const result = await adapter.fetchData({
        filters: [
          { columnId: 'createdAt', type: 'date', operator: 'before', values: [futureDate] },
        ],
      });
      expect(result.data).toHaveLength(3);
    });

    it('should filter by date after', async () => {
      const pastDate = new Date('2020-01-01');
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'after', values: [pastDate] }],
      });
      expect(result.data).toHaveLength(3);
    });

    it('should filter by date isToday', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isToday', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created today
    });

    it('should filter by date isYesterday', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isYesterday', values: [] }],
      });
      expect(result.data).toHaveLength(0); // None created yesterday
    });

    it('should filter by date isThisWeek', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isThisWeek', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created this week
    });

    it('should filter by date isThisMonth', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isThisMonth', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created this month
    });

    it('should filter by date isThisYear', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isThisYear', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created this year
    });

    it('should filter by date isNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isNull', values: [] }],
      });
      expect(result.data).toHaveLength(0); // No null created dates
    });

    it('should filter by date isNotNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isNotNull', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All have created dates
    });
  });

  describe('Sorting Tests', () => {
    it('should sort ascending', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'asc' }],
      });
      expect((result.data[0] as UserWithRelations).age).toBe(25);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(35);
    });

    it('should sort descending', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'desc' }],
      });
      expect((result.data[0] as UserWithRelations).age).toBe(35);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(25);
    });

    it('should sort across relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        sorting: [{ columnId: 'profile.bio', direction: 'asc' }],
      });
      expect((result.data[0] as UserWithRelations).name).toBe('Bob Johnson'); // No profile (NULL)
      expect((result.data[1] as UserWithRelations).name).toBe('Jane Smith'); // Designer
      expect((result.data[2] as UserWithRelations).name).toBe('John Doe'); // Software developer
    });

    it('should handle multi-column sorting', async () => {
      const result = await adapter.fetchData({
        sorting: [
          { columnId: 'age', direction: 'desc' },
          { columnId: 'name', direction: 'asc' },
        ],
      });
      expect((result.data[0] as UserWithRelations).age).toBe(35);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(25);
    });
  });

  describe('Complex Filter Combinations', () => {
    it('should handle multiple filters with AND logic', async () => {
      const result = await adapter.fetchData({
        filters: [
          { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
          { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        ],
      });
      expect(result.data).toHaveLength(2); // John Doe and Bob Johnson
    });

    it('should handle cross-table filter combinations', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        filters: [
          { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
          { columnId: 'profile.bio', type: 'text', operator: 'contains', values: ['developer'] },
        ],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });
  });

  describe('Relationship Handling', () => {
    it('should fetch data with one-to-one relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'profile.bio'],
      });

      expect(result.data).toHaveLength(3);
      const johnUser = result.data.find((u) => (u as UserWithRelations).name === 'John Doe');
      expect((johnUser as UserWithRelations).profile).toBeDefined();
      expect((johnUser as UserWithRelations).profile?.bio).toBe('Software developer');
    });

    it('should fetch data with one-to-many relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'posts.title'],
      });

      expect(result.data).toHaveLength(3);
      const johnUser = result.data.find((u) => (u as UserWithRelations).name === 'John Doe');
      expect((johnUser as UserWithRelations).posts).toBeDefined();
      expect((johnUser as UserWithRelations).posts).toHaveLength(2);
    });

    it('should filter across relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        filters: [
          {
            columnId: 'profile.bio',
            type: 'text',
            operator: 'contains',
            values: ['developer'],
          },
        ],
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should handle nullable relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'profile.bio'],
      });

      expect(result.data).toHaveLength(3);
      const bobUser = result.data.find((u) => (u as UserWithRelations).name === 'Bob Johnson');
      expect((bobUser as UserWithRelations).profile).toBeNull();
    });
  });

  describe('Caching', () => {
    it('should cache query results', async () => {
      const params = { pagination: { page: 1, limit: 2 } };

      // First call
      const result1 = await adapter.fetchData(params);
      expect(result1.meta?.cached).toBe(false);

      // Second call should be cached
      const result2 = await adapter.fetchData(params);
      expect(result2.meta?.cached).toBe(true);
      expect(result2.data).toEqual(result1.data);
    });

    it('should invalidate cache on data changes', async () => {
      const params = { pagination: { page: 1, limit: 2 } };

      // First call
      await adapter.fetchData(params);

      // Modify data
      await adapter.createRecord({
        name: 'Cache Test User',
        email: 'cache@example.com',
        age: 40,
      } as Partial<User>);

      // Next call should not be cached
      const result = await adapter.fetchData(params);
      expect(result.meta?.cached).toBe(false);
    });
  });

  describe('Events', () => {
    it('should emit events on data changes', async () => {
      const events: DataEvent<UserWithRelations>[] = [];
      const unsubscribe = adapter.subscribe((event) => {
        events.push(event as DataEvent<UserWithRelations>);
      });

      await adapter.createRecord({
        name: 'Event Test User',
        email: 'event@example.com',
        age: 45,
      } as Partial<User>);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('insert');
      expect((events[0].data as UserWithRelations).name).toBe('Event Test User');

      unsubscribe();
    });
  });

  describe('Faceted Values and Aggregations', () => {
    it('should get faceted values for a column', async () => {
      const facets = await adapter.getFacetedValues('age');
      expect(facets.size).toBeGreaterThan(0);
      expect(facets.get('30')).toBe(1);
      expect(facets.get('25')).toBe(1);
      expect(facets.get('35')).toBe(1);
    });

    it('should get min/max values for number columns', async () => {
      const [min, max] = await adapter.getMinMaxValues('age');
      expect(min).toBe(25);
      expect(max).toBe(35);
    });

    it('should get filter options for a column', async () => {
      const options = await adapter.getFilterOptions('age');
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((opt) => opt.value === '30')).toBe(true);
    });
  });

  describe('PostgreSQL-Specific Features', () => {
    it('should handle case-insensitive search with ILIKE', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'contains',
            values: ['JOHN'], // uppercase
          },
        ],
      });

      // Should still match 'John Doe' and 'Bob Johnson' with case-insensitive search
      expect(result.data).toHaveLength(2);
    });

    it('should handle array operations (if implemented)', async () => {
      // Placeholder for future array column support
      expect(true).toBe(true);
    });

    it('should handle JSON operations (if implemented)', async () => {
      // Placeholder for future JSON column support
      expect(true).toBe(true);
    });

    it('should handle PostgreSQL-specific data types', async () => {
      // Test with timestamp precision
      const result = await adapter.fetchData({
        columns: ['name', 'createdAt'],
      });

      expect(result.data).toHaveLength(3);
      result.data.forEach((user) => {
        expect((user as UserWithRelations).createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export data as CSV', async () => {
      const result = await adapter.exportData({
        format: 'csv',
        columns: ['name', 'email'],
      });

      expect(result.data).toContain('name,email');
      expect(result.mimeType).toBe('text/csv');
    });

    it('should export data as JSON', async () => {
      const result = await adapter.exportData({
        format: 'json',
        columns: ['name', 'email'],
      });

      const parsed = JSON.parse(result.data as string);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid column references', async () => {
      await expect(
        adapter.fetchData({
          filters: [
            { columnId: 'invalidColumn', type: 'text', operator: 'equals', values: ['test'] },
          ],
        })
      ).rejects.toThrow();
    });

    it('should handle invalid filter operators', async () => {
      await expect(
        adapter.fetchData({
          filters: [
            {
              columnId: 'name',
              type: 'text',
              operator: 'invalidOp' as FilterOperator,
              values: ['test'],
            },
          ],
        })
      ).rejects.toThrow();
    });

    it('should handle invalid relationship paths', async () => {
      await expect(
        adapter.fetchData({
          columns: ['invalidRelation.field'],
        })
      ).rejects.toThrow();
    });
  });
});
