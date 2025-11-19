import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import Database from 'better-sqlite3';
import { relations, sql } from 'drizzle-orm';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { SQLiteQueryBuilder } from '../query-builders/sqlite-query-builder';
import { RelationshipDetector } from '../relationship-detector';
import { RelationshipManager } from '../relationship-manager';
import type { SQLiteQueryBuilderWithJoins } from '../types';

// Test schema
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
});

const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  bio: text('bio'),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  published: integer('published', { mode: 'boolean' }).default(false),
});

const schema = { users, profiles, posts };

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

const relationsSchema = {
  users: usersRelations,
  profiles: profilesRelations,
  posts: postsRelations,
};

describe('SQLiteQueryBuilder', () => {
  let db: BetterSQLite3Database;
  let queryBuilder: SQLiteQueryBuilder;
  let relationshipManager: RelationshipManager;
  let sqlite: Database.Database;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite);

    // Create tables
    await db.run(sql`CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      age INTEGER
    )`);

    await db.run(sql`CREATE TABLE profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      bio TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await db.run(sql`CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      published INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Insert test data
    await db.run(sql`INSERT INTO users (id, name, email, age) VALUES 
      (1, 'John Doe', 'john@example.com', 30),
      (2, 'Jane Smith', 'jane@example.com', 25),
      (3, 'Bob Johnson', 'bob@example.com', 35)`);

    await db.run(sql`INSERT INTO profiles (id, user_id, bio) VALUES 
      (1, 1, 'Software developer'),
      (2, 2, 'Designer')`);

    await db.run(sql`INSERT INTO posts (id, user_id, title, published) VALUES 
      (1, 1, 'First Post', 1),
      (2, 1, 'Second Post', 0),
      (3, 2, 'Design Tips', 1)`);

    // Initialize relationship manager
    const detector = new RelationshipDetector();
    const relationships = detector.detectFromSchema(relationsSchema, schema);
    relationshipManager = new RelationshipManager(schema, relationships);

    // Initialize query builder
    queryBuilder = new SQLiteQueryBuilder(db, schema, relationshipManager);
  });

  afterEach(() => {
    if (sqlite) {
      sqlite.close();
    }
  });

  describe('Query Building', () => {
    it('should build basic select query', () => {
      const context = relationshipManager.buildQueryContext(
        {
          columns: ['name', 'email'],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users', ['name', 'email']);
      expect(query).toBeDefined();
    });

    it('should build query with joins', () => {
      const context = relationshipManager.buildQueryContext(
        {
          columns: ['name', 'profile.bio'],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users', ['name', 'profile.bio']);
      expect(query).toBeDefined();
    });

    it('should build count query', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const query = queryBuilder.buildCountQuery(context, 'users');
      expect(query).toBeDefined();
    });

    it('should build aggregate query', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'count', 'users');
      expect(query).toBeDefined();
    });
  });

  describe('Filter Application', () => {
    it('should apply text filters', () => {
      const context = relationshipManager.buildQueryContext(
        {
          filters: [{ columnId: 'name' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const filteredQuery = queryBuilder.applyFilters(
        query,
        [
          {
            columnId: 'name',
            type: 'text',
            operator: 'contains',
            values: ['John'],
          },
        ],
        'users'
      );

      expect(filteredQuery).toBeDefined();
    });

    it('should apply number filters', () => {
      const context = relationshipManager.buildQueryContext(
        {
          filters: [{ columnId: 'age' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const filteredQuery = queryBuilder.applyFilters(
        query,
        [
          {
            columnId: 'age',
            type: 'number',
            operator: 'greaterThan',
            values: [25],
          },
        ],
        'users'
      );

      expect(filteredQuery).toBeDefined();
    });

    it('should apply cross-table filters', () => {
      const context = relationshipManager.buildQueryContext(
        {
          filters: [{ columnId: 'profile.bio' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const filteredQuery = queryBuilder.applyFilters(
        query,
        [
          {
            columnId: 'profile.bio',
            type: 'text',
            operator: 'contains',
            values: ['developer'],
          },
        ],
        'users'
      );

      expect(filteredQuery).toBeDefined();
    });
  });

  describe('Sorting Application', () => {
    it('should apply single column sorting', () => {
      const context = relationshipManager.buildQueryContext(
        {
          sorts: [{ columnId: 'name' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          {
            columnId: 'name',
            direction: 'asc',
          },
        ],
        'users'
      );

      expect(sortedQuery).toBeDefined();
    });

    it('should apply multi-column sorting', () => {
      const context = relationshipManager.buildQueryContext(
        {
          sorts: [{ columnId: 'age' }, { columnId: 'name' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          { columnId: 'age', direction: 'desc' },
          { columnId: 'name', direction: 'asc' },
        ],
        'users'
      );

      expect(sortedQuery).toBeDefined();
    });

    it('should apply cross-table sorting', () => {
      const context = relationshipManager.buildQueryContext(
        {
          sorts: [{ columnId: 'profile.bio' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          {
            columnId: 'profile.bio',
            direction: 'asc',
          },
        ],
        'users'
      );

      expect(sortedQuery).toBeDefined();
    });
  });

  describe('Pagination Application', () => {
    it('should apply pagination', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const paginatedQuery = queryBuilder.applyPagination(query, {
        page: 2,
        limit: 10,
      });

      expect(paginatedQuery).toBeDefined();
    });

    it('should handle first page pagination', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const paginatedQuery = queryBuilder.applyPagination(query, {
        page: 1,
        limit: 5,
      });

      expect(paginatedQuery).toBeDefined();
    });
  });

  describe('Complete Query Building', () => {
    it('should build complete query with all parameters', () => {
      const { dataQuery, countQuery } = queryBuilder.buildCompleteQuery({
        columns: ['name', 'profile.bio'],
        filters: [
          {
            columnId: 'age',
            type: 'number',
            operator: 'greaterThan',
            values: [25],
          },
        ],
        sorting: [{ columnId: 'name', direction: 'asc' }],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'users',
      });

      expect(dataQuery).toBeDefined();
      expect(countQuery).toBeDefined();
    });

    it('should build query with minimal parameters', () => {
      const { dataQuery, countQuery } = queryBuilder.buildCompleteQuery({
        primaryTable: 'users',
      });

      expect(dataQuery).toBeDefined();
      expect(countQuery).toBeDefined();
    });
  });

  describe('Filter Options Query', () => {
    it('should build filter options query for direct column', () => {
      const query = queryBuilder.buildFilterOptionsQuery('name', 'users');
      expect(query).toBeDefined();
    });

    it('should build filter options query for related column', () => {
      const query = queryBuilder.buildFilterOptionsQuery('profile.bio', 'users');
      expect(query).toBeDefined();
    });
  });

  describe('Min/Max Query', () => {
    it('should build min/max query for direct column', () => {
      const query = queryBuilder.buildMinMaxQuery('age', 'users');
      expect(query).toBeDefined();
    });

    it('should build min/max query for related column', () => {
      const query = queryBuilder.buildMinMaxQuery('profile.id', 'users');
      expect(query).toBeDefined();
    });
  });

  describe('Query Validation', () => {
    it('should validate query before execution', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should handle invalid queries', () => {
      expect(queryBuilder.validateQuery(null as unknown as SQLiteQueryBuilderWithJoins)).toBe(
        false
      );
      expect(queryBuilder.validateQuery(undefined as unknown as SQLiteQueryBuilderWithJoins)).toBe(
        false
      );
      expect(queryBuilder.validateQuery({} as unknown as SQLiteQueryBuilderWithJoins)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid column IDs', () => {
      expect(() => {
        queryBuilder.buildFilterOptionsQuery('invalid.column', 'users');
      }).toThrow();
    });
  });
});
