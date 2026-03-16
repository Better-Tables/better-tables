/**
 * Tests for DrizzleAdapter schema filtering with different database types
 *
 * This test suite verifies:
 * - Schema filtering works correctly with PostgreSQL (postgres-js, node-postgres, neon-http)
 * - Schema filtering works correctly with MySQL (mysql2)
 * - Schema filtering works correctly with SQLite (better-sqlite3)
 * - Relations are properly filtered out at runtime
 * - Type safety is maintained across all database types
 * - Mixed schemas with tables and relations are handled correctly
 */

import { describe, expect, it } from 'bun:test';
import { relations } from 'drizzle-orm';
import {
  serial as mysqlSerial,
  mysqlTable,
  text as mysqlText,
  timestamp as mysqlTimestamp,
  varchar,
} from 'drizzle-orm/mysql-core';
import { jsonb as pgJsonb, pgTable, text as pgText, serial, timestamp } from 'drizzle-orm/pg-core';
import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type {
  DrizzleAdapterConfig,
  FilterTablesFromSchema,
  InferSelectModelFromFilteredSchema,
} from '../src/types';
import { filterTablesFromSchema } from '../src/utils/schema-extractor';

// ============================================================================
// PostgreSQL Schema Definitions
// ============================================================================

const pgUsersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: pgText('email').notNull(),
  name: pgText('name'),
  metadata: pgJsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

const pgPostsTable = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: pgText('title').notNull(),
  content: pgText('content'),
  authorId: serial('author_id').references(() => pgUsersTable.id),
  createdAt: timestamp('created_at').defaultNow(),
});

const pgUsersRelations = relations(pgUsersTable, ({ one, many }) => ({
  posts: many(pgPostsTable),
  profile: one(pgUsersTable, {
    fields: [pgUsersTable.id],
    references: [pgUsersTable.id],
  }),
}));

const pgPostsRelations = relations(pgPostsTable, ({ one }) => ({
  author: one(pgUsersTable, {
    fields: [pgPostsTable.authorId],
    references: [pgUsersTable.id],
  }),
}));

// ============================================================================
// MySQL Schema Definitions
// ============================================================================

const mysqlUsersTable = mysqlTable('users', {
  id: mysqlSerial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: mysqlText('name'),
  createdAt: mysqlTimestamp('created_at', { fsp: 2 }).defaultNow(),
});

const mysqlOrdersTable = mysqlTable('orders', {
  id: mysqlSerial('id').primaryKey(),
  userId: mysqlSerial('user_id').references(() => mysqlUsersTable.id),
  total: mysqlText('total').notNull(),
  createdAt: mysqlTimestamp('created_at', { fsp: 2 }).defaultNow(),
});

const mysqlUsersRelations = relations(mysqlUsersTable, ({ many }) => ({
  orders: many(mysqlOrdersTable),
}));

const mysqlOrdersRelations = relations(mysqlOrdersTable, ({ one }) => ({
  user: one(mysqlUsersTable, {
    fields: [mysqlOrdersTable.userId],
    references: [mysqlUsersTable.id],
  }),
}));

// ============================================================================
// SQLite Schema Definitions
// ============================================================================

const sqliteUsersTable = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: sqliteText('email').notNull(),
  name: sqliteText('name'),
  createdAt: sqliteText('created_at'),
});

const sqliteCommentsTable = sqliteTable('comments', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => sqliteUsersTable.id),
  content: sqliteText('content').notNull(),
  createdAt: sqliteText('created_at'),
});

const sqliteUsersRelations = relations(sqliteUsersTable, ({ many }) => ({
  comments: many(sqliteCommentsTable),
}));

const sqliteCommentsRelations = relations(sqliteCommentsTable, ({ one }) => ({
  user: one(sqliteUsersTable, {
    fields: [sqliteCommentsTable.userId],
    references: [sqliteUsersTable.id],
  }),
}));

// ============================================================================
// Mock Database Instances
// ============================================================================

function createMockPostgresDb() {
  return {
    select: () => ({ from: () => Promise.resolve([]) }),
    insert: () => Promise.resolve([]),
    update: () => Promise.resolve([]),
    delete: () => Promise.resolve([]),
    _: {
      fullSchema: {},
    },
  } as unknown as DrizzleAdapterConfig<typeof pgSchemaWithRelations, 'postgres'>['db'];
}

function createMockMysqlDb() {
  return {
    select: () => ({ from: () => Promise.resolve([]) }),
    insert: () => Promise.resolve([]),
    update: () => Promise.resolve([]),
    delete: () => Promise.resolve([]),
    _: {
      fullSchema: {},
    },
  } as unknown as DrizzleAdapterConfig<typeof mysqlSchemaWithRelations, 'mysql'>['db'];
}

function createMockSqliteDb() {
  return {
    select: () => ({ from: () => ({ all: () => [] }) }),
    insert: () => ({ returning: () => [] }),
    update: () => ({ returning: () => [] }),
    delete: () => ({ returning: () => [] }),
    _: {
      fullSchema: {},
    },
  } as unknown as DrizzleAdapterConfig<typeof sqliteSchemaWithRelations, 'sqlite'>['db'];
}

// ============================================================================
// Schema Configurations
// ============================================================================

// PostgreSQL schemas
const pgSchemaWithRelations = {
  users: pgUsersTable,
  posts: pgPostsTable,
  usersRelations: pgUsersRelations,
  postsRelations: pgPostsRelations,
} as const;

const pgSchemaTablesOnly = {
  users: pgUsersTable,
  posts: pgPostsTable,
} as const;

// MySQL schemas
const mysqlSchemaWithRelations = {
  users: mysqlUsersTable,
  orders: mysqlOrdersTable,
  usersRelations: mysqlUsersRelations,
  ordersRelations: mysqlOrdersRelations,
} as const;

const mysqlSchemaTablesOnly = {
  users: mysqlUsersTable,
  orders: mysqlOrdersTable,
} as const;

// SQLite schemas
const sqliteSchemaWithRelations = {
  users: sqliteUsersTable,
  comments: sqliteCommentsTable,
  usersRelations: sqliteUsersRelations,
  commentsRelations: sqliteCommentsRelations,
} as const;

const sqliteSchemaTablesOnly = {
  users: sqliteUsersTable,
  comments: sqliteCommentsTable,
} as const;

// ============================================================================
// Test Suite
// ============================================================================

describe('DrizzleAdapter Schema Filtering - Different Database Types', () => {
  describe('PostgreSQL Schema Filtering', () => {
    it('should filter relations from schema with PostgreSQL tables and relations', () => {
      const filtered = filterTablesFromSchema(pgSchemaWithRelations);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('posts');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('postsRelations');
      expect(Object.keys(filtered)).toHaveLength(2);
      expect(filtered.users).toBe(pgUsersTable);
      expect(filtered.posts).toBe(pgPostsTable);
    });

    it('should accept schema with relations in DrizzleAdapter constructor (PostgreSQL)', () => {
      const db = createMockPostgresDb();
      const config: DrizzleAdapterConfig<typeof pgSchemaWithRelations, 'postgres'> = {
        db,
        schema: pgSchemaWithRelations,
        driver: 'postgres',
      };

      // Should not throw - relations should be filtered internally
      expect(() => {
        const adapter = new DrizzleAdapter(config);
        expect(adapter).toBeDefined();
      }).not.toThrow();
    });

    it('should maintain type safety with FilterTablesFromSchema for PostgreSQL', () => {
      type FilteredPgSchema = FilterTablesFromSchema<typeof pgSchemaWithRelations>;

      // Type-level test: should only include tables
      const _test: FilteredPgSchema = {
        users: pgUsersTable,
        posts: pgPostsTable,
      };

      expect(_test.users).toBe(pgUsersTable);
      expect(_test.posts).toBe(pgPostsTable);
    });

    it('should correctly infer select model types from filtered PostgreSQL schema', () => {
      type InferredModel = InferSelectModelFromFilteredSchema<typeof pgSchemaWithRelations>;

      // Type-level test: should compile without errors
      // biome-ignore lint/suspicious/noExplicitAny: Type test requires any for empty object
      const _test: InferredModel = {} as any;
      expect(_test).toBeDefined();
    });

    it('should handle PostgreSQL schema with only tables', () => {
      const filtered = filterTablesFromSchema(pgSchemaTablesOnly);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('posts');
      expect(Object.keys(filtered)).toHaveLength(2);
    });
  });

  describe('MySQL Schema Filtering', () => {
    it('should filter relations from schema with MySQL tables and relations', () => {
      const filtered = filterTablesFromSchema(mysqlSchemaWithRelations);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('orders');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('ordersRelations');
      expect(Object.keys(filtered)).toHaveLength(2);
      expect(filtered.users).toBe(mysqlUsersTable);
      expect(filtered.orders).toBe(mysqlOrdersTable);
    });

    it('should accept schema with relations in DrizzleAdapter constructor (MySQL)', () => {
      const db = createMockMysqlDb();
      const config: DrizzleAdapterConfig<typeof mysqlSchemaWithRelations, 'mysql'> = {
        db,
        schema: mysqlSchemaWithRelations,
        driver: 'mysql',
      };

      // Should not throw - relations should be filtered internally
      expect(() => {
        const adapter = new DrizzleAdapter(config);
        expect(adapter).toBeDefined();
      }).not.toThrow();
    });

    it('should maintain type safety with FilterTablesFromSchema for MySQL', () => {
      type FilteredMysqlSchema = FilterTablesFromSchema<typeof mysqlSchemaWithRelations>;

      // Type-level test: should only include tables
      const _test: FilteredMysqlSchema = {
        users: mysqlUsersTable,
        orders: mysqlOrdersTable,
      };

      expect(_test.users).toBe(mysqlUsersTable);
      expect(_test.orders).toBe(mysqlOrdersTable);
    });

    it('should correctly infer select model types from filtered MySQL schema', () => {
      type InferredModel = InferSelectModelFromFilteredSchema<typeof mysqlSchemaWithRelations>;

      // Type-level test: should compile without errors
      // biome-ignore lint/suspicious/noExplicitAny: Type test requires any for empty object
      const _test: InferredModel = {} as any;
      expect(_test).toBeDefined();
    });

    it('should handle MySQL schema with only tables', () => {
      const filtered = filterTablesFromSchema(mysqlSchemaTablesOnly);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('orders');
      expect(Object.keys(filtered)).toHaveLength(2);
    });
  });

  describe('SQLite Schema Filtering', () => {
    it('should filter relations from schema with SQLite tables and relations', () => {
      const filtered = filterTablesFromSchema(sqliteSchemaWithRelations);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('comments');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('commentsRelations');
      expect(Object.keys(filtered)).toHaveLength(2);
      expect(filtered.users).toBe(sqliteUsersTable);
      expect(filtered.comments).toBe(sqliteCommentsTable);
    });

    it('should accept schema with relations in DrizzleAdapter constructor (SQLite)', () => {
      const db = createMockSqliteDb();
      const config: DrizzleAdapterConfig<typeof sqliteSchemaWithRelations, 'sqlite'> = {
        db,
        schema: sqliteSchemaWithRelations,
        driver: 'sqlite',
      };

      // Should not throw - relations should be filtered internally
      expect(() => {
        const adapter = new DrizzleAdapter(config);
        expect(adapter).toBeDefined();
      }).not.toThrow();
    });

    it('should maintain type safety with FilterTablesFromSchema for SQLite', () => {
      type FilteredSqliteSchema = FilterTablesFromSchema<typeof sqliteSchemaWithRelations>;

      // Type-level test: should only include tables
      const _test: FilteredSqliteSchema = {
        users: sqliteUsersTable,
        comments: sqliteCommentsTable,
      };

      expect(_test.users).toBe(sqliteUsersTable);
      expect(_test.comments).toBe(sqliteCommentsTable);
    });

    it('should correctly infer select model types from filtered SQLite schema', () => {
      type InferredModel = InferSelectModelFromFilteredSchema<typeof sqliteSchemaWithRelations>;

      // Type-level test: should compile without errors
      // biome-ignore lint/suspicious/noExplicitAny: Type test requires any for empty object
      const _test: InferredModel = {} as any;
      expect(_test).toBeDefined();
    });

    it('should handle SQLite schema with only tables', () => {
      const filtered = filterTablesFromSchema(sqliteSchemaTablesOnly);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('comments');
      expect(Object.keys(filtered)).toHaveLength(2);
    });
  });

  describe('Cross-Database Type Consistency', () => {
    it('should filter relations consistently across all database types', () => {
      const pgFiltered = filterTablesFromSchema(pgSchemaWithRelations);
      const mysqlFiltered = filterTablesFromSchema(mysqlSchemaWithRelations);
      const sqliteFiltered = filterTablesFromSchema(sqliteSchemaWithRelations);

      // All should have exactly 2 tables (relations filtered out)
      expect(Object.keys(pgFiltered)).toHaveLength(2);
      expect(Object.keys(mysqlFiltered)).toHaveLength(2);
      expect(Object.keys(sqliteFiltered)).toHaveLength(2);

      // All should have a 'users' table
      expect(pgFiltered).toHaveProperty('users');
      expect(mysqlFiltered).toHaveProperty('users');
      expect(sqliteFiltered).toHaveProperty('users');
    });

    it('should handle schemas with multiple relation definitions', () => {
      // Create a schema with many relations
      const complexPgSchema = {
        users: pgUsersTable,
        posts: pgPostsTable,
        usersRelations: pgUsersRelations,
        postsRelations: pgPostsRelations,
        // Add duplicate relation names (should still be filtered)
        usersRelationsDuplicate: pgUsersRelations,
      };

      const filtered = filterTablesFromSchema(complexPgSchema);

      expect(Object.keys(filtered)).toHaveLength(2);
      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('posts');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('postsRelations');
      expect(filtered).not.toHaveProperty('usersRelationsDuplicate');
    });

    it('should handle empty schemas across all database types', () => {
      const emptyPgSchema = {};
      const emptyMysqlSchema = {};
      const emptySqliteSchema = {};

      expect(Object.keys(filterTablesFromSchema(emptyPgSchema))).toHaveLength(0);
      expect(Object.keys(filterTablesFromSchema(emptyMysqlSchema))).toHaveLength(0);
      expect(Object.keys(filterTablesFromSchema(emptySqliteSchema))).toHaveLength(0);
    });

    it('should handle schemas with only relations (no tables)', () => {
      const onlyRelationsPg = {
        usersRelations: pgUsersRelations,
        postsRelations: pgPostsRelations,
      };

      const onlyRelationsMysql = {
        usersRelations: mysqlUsersRelations,
        ordersRelations: mysqlOrdersRelations,
      };

      const onlyRelationsSqlite = {
        usersRelations: sqliteUsersRelations,
        commentsRelations: sqliteCommentsRelations,
      };

      expect(Object.keys(filterTablesFromSchema(onlyRelationsPg))).toHaveLength(0);
      expect(Object.keys(filterTablesFromSchema(onlyRelationsMysql))).toHaveLength(0);
      expect(Object.keys(filterTablesFromSchema(onlyRelationsSqlite))).toHaveLength(0);
    });
  });

  describe('Type Safety Verification', () => {
    it('should prevent relations from being used in FilterTablesFromSchema type', () => {
      type FilteredPgSchema = FilterTablesFromSchema<typeof pgSchemaWithRelations>;

      // This should compile - tables only
      const valid: FilteredPgSchema = {
        users: pgUsersTable,
        posts: pgPostsTable,
      };

      expect(valid).toBeDefined();

      // TypeScript should prevent this (uncomment to verify):
      // const invalid: FilteredPgSchema = {
      //   users: pgUsersTable,
      //   posts: pgPostsTable,
      //   usersRelations: pgUsersRelations, // Should cause type error
      // };
    });

    it('should correctly infer union types from filtered schemas', () => {
      type PgModel = InferSelectModelFromFilteredSchema<typeof pgSchemaWithRelations>;
      type MysqlModel = InferSelectModelFromFilteredSchema<typeof mysqlSchemaWithRelations>;
      type SqliteModel = InferSelectModelFromFilteredSchema<typeof sqliteSchemaWithRelations>;

      // Type-level test: should compile without errors
      // biome-ignore lint/suspicious/noExplicitAny: Type test requires any for empty object
      const _pgTest: PgModel = {} as any;
      // biome-ignore lint/suspicious/noExplicitAny: Type test requires any for empty object
      const _mysqlTest: MysqlModel = {} as any;
      // biome-ignore lint/suspicious/noExplicitAny: Type test requires any for empty object
      const _sqliteTest: SqliteModel = {} as any;

      expect(_pgTest).toBeDefined();
      expect(_mysqlTest).toBeDefined();
      expect(_sqliteTest).toBeDefined();
    });

    it('should maintain type compatibility when schema includes relations', () => {
      // This test verifies that DrizzleAdapterConfig accepts schemas with relations
      const db = createMockPostgresDb();

      const config: DrizzleAdapterConfig<typeof pgSchemaWithRelations, 'postgres'> = {
        db,
        schema: pgSchemaWithRelations, // Includes relations
        driver: 'postgres',
      };

      // Should compile and work at runtime
      expect(() => {
        const adapter = new DrizzleAdapter(config);
        expect(adapter).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle schemas with null/undefined values', () => {
      const schemaWithNulls = {
        users: pgUsersTable,
        nullValue: null,
        undefinedValue: undefined,
        posts: pgPostsTable,
        usersRelations: pgUsersRelations,
      };

      // biome-ignore lint/suspicious/noExplicitAny: Test requires any for invalid schema
      const filtered = filterTablesFromSchema(schemaWithNulls as any);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('posts');
      expect(filtered).not.toHaveProperty('nullValue');
      expect(filtered).not.toHaveProperty('undefinedValue');
      expect(filtered).not.toHaveProperty('usersRelations');
    });

    it('should handle schemas with primitive values mixed in', () => {
      const schemaWithPrimitives = {
        users: pgUsersTable,
        stringValue: 'not a table',
        numberValue: 123,
        booleanValue: true,
        posts: pgPostsTable,
        usersRelations: pgUsersRelations,
      };

      // biome-ignore lint/suspicious/noExplicitAny: Test requires any for invalid schema
      const filtered = filterTablesFromSchema(schemaWithPrimitives as any);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('posts');
      expect(filtered).not.toHaveProperty('stringValue');
      expect(filtered).not.toHaveProperty('numberValue');
      expect(filtered).not.toHaveProperty('booleanValue');
      expect(filtered).not.toHaveProperty('usersRelations');
    });

    it('should handle very large schemas with many tables and relations', () => {
      // Create a large schema
      const largeSchema: Record<string, unknown> = {
        users: pgUsersTable,
        posts: pgPostsTable,
        usersRelations: pgUsersRelations,
        postsRelations: pgPostsRelations,
      };

      // Add many more entries
      for (let i = 0; i < 50; i++) {
        largeSchema[`table${i}`] = pgUsersTable;
        largeSchema[`relation${i}`] = pgUsersRelations;
      }

      const filtered = filterTablesFromSchema(largeSchema);

      // Should filter correctly
      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('posts');
      // Should have all tables (2 original + 50 new = 52)
      expect(Object.keys(filtered).length).toBeGreaterThan(50);
      // Should not have any relations
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('postsRelations');
    });
  });
});
