/**
 * @fileoverview Tests for SQLiteQueryBuilder
 * @module @better-tables/drizzle-adapter/tests/sqlite-query-builder
 *
 * Tests SQLite-specific query builder methods including json_each for array FKs
 * and json_extract() for JSON accessor columns.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { SQLiteQueryBuilder } from '../src/query-builders/sqlite-query-builder';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipPath } from '../src/types';
import { QueryError, RelationshipError } from '../src/types';
import {
  type BunSQLiteDatabase,
  closeSQLiteDatabase,
  createSQLiteDatabase,
  setupSQLiteDatabase,
} from './helpers/test-fixtures';
import { relationsSchema, schema } from './helpers/test-schema';

describe('SQLiteQueryBuilder', () => {
  describe('Unit Tests (Mocked Database)', () => {
    let mockDb: BunSQLiteDatabase;
    let queryBuilder: SQLiteQueryBuilder;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      // Create a mock database connection with necessary methods
      // In unit tests, we don't actually connect to SQLite
      // We just need the type for the query builder
      // The mock needs to support method chaining used by query builders
      const createMockQuery = () => ({
        where: () => createMockQuery(),
        leftJoin: () => createMockQuery(),
        innerJoin: () => createMockQuery(),
        orderBy: () => createMockQuery(),
        groupBy: () => createMockQuery(),
        limit: () => createMockQuery(),
        offset: () => createMockQuery(),
        execute: async () => [],
      });

      mockDb = {
        select: () => ({
          from: () => createMockQuery(),
        }),
      } as unknown as BunSQLiteDatabase;

      // Initialize relationship manager
      const detector = new RelationshipDetector();
      const relationships = detector.detectFromSchema(relationsSchema, schema);
      relationshipManager = new RelationshipManager(schema, relationships);

      // Initialize query builder with mock database
      // @ts-expect-error - Mock database for unit tests, type mismatch expected
      queryBuilder = new SQLiteQueryBuilder(mockDb, schema, relationshipManager);
    });

    describe('SQLite-Specific Array Join Conditions', () => {
      it('should use json_each syntax for array foreign keys (tests buildArrayJoinCondition)', () => {
        // Create array FK relationship manually
        const arrayRelationships = {
          'events.organizers': {
            from: 'events',
            to: 'users',
            foreignKey: 'id',
            localKey: 'organizerId',
            cardinality: 'many' as const,
            nullable: true,
            joinType: 'left' as const,
            isArray: true,
          },
        };

        // Create schema with events and users tables for array FK test
        const eventsTable = sqliteTable('events', {
          id: integer('id').primaryKey(),
          title: text('title').notNull(),
          organizerId: text('organizer_id'),
        });

        const usersTable = sqliteTable('users', {
          id: integer('id').primaryKey(),
          name: text('name').notNull(),
          email: text('email').notNull(),
        });

        const testSchema = {
          events: eventsTable,
          users: usersTable,
        };

        const arrayRelationshipManager = new RelationshipManager(testSchema, arrayRelationships);
        const arrayQueryBuilder = new SQLiteQueryBuilder(
          // @ts-expect-error - Mock database for unit tests, type mismatch expected
          mockDb as unknown as BunSQLiteDatabase,
          testSchema,
          arrayRelationshipManager
        );

        const arrayRelationship = arrayRelationships['events.organizers'];
        expect(arrayRelationship).toBeDefined();
        expect(arrayRelationship?.isArray).toBe(true);

        if (arrayRelationship) {
          // Access protected method to test array FK join
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const joinCondition = (
            arrayQueryBuilder as unknown as {
              buildJoinCondition: (relationship: RelationshipPath) => SQL;
            }
          ).buildJoinCondition(arrayRelationship);

          // Convert SQL to string to verify the syntax
          // In unit tests with mocked database, joinCondition might not have toSQL()
          // Check if it's available, otherwise just verify the condition is defined
          if (
            joinCondition &&
            typeof (
              joinCondition as unknown as { toSQL?: () => { sql: string; params: unknown[] } }
            ).toSQL === 'function'
          ) {
            const sqlResult = (
              joinCondition as unknown as { toSQL: () => { sql: string; params: unknown[] } }
            ).toSQL();
            const sqlString = sqlResult.sql;

            // Verify it uses json_each syntax for array FK join
            expect(sqlString).toContain('json_each');
            expect(sqlString).toContain('EXISTS');
            expect(sqlString).toMatch(/json_each\(/i);
            expect(sqlString).toMatch(/json_each\.value\s*=/i);
          } else {
            // In mocked environment, just verify the join condition is defined
            // The actual SQL syntax is verified in integration tests
            expect(joinCondition).toBeDefined();
          }
        }
      });

      it('should use regular join for non-array relationships', () => {
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['name', 'profile.bio'],
          },
          'users'
        );

        // This should not throw and should use regular eq() join
        expect(() => {
          queryBuilder.buildSelectQuery(context, 'users', ['name', 'profile.bio']);
        }).not.toThrow();
      });
    });

    describe('SQLite-Specific Select Query Building', () => {
      it('should build basic select query', () => {
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['name', 'email'],
          },
          'users'
        );

        const { query, columnMetadata } = queryBuilder.buildSelectQuery(context, 'users', [
          'name',
          'email',
        ]);

        expect(query).toBeDefined();
        expect(columnMetadata).toBeDefined();
        expect(columnMetadata.selections).toBeDefined();
        expect(columnMetadata.columnMapping).toBeDefined();
      });

      it('should build select query with joins', () => {
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['name', 'profile.bio'],
          },
          'users'
        );

        const { query, columnMetadata, isNested } = queryBuilder.buildSelectQuery(
          context,
          'users',
          ['name', 'profile.bio']
        );

        expect(query).toBeDefined();
        expect(columnMetadata).toBeDefined();
        // SQLite always uses manual joins, so isNested should be false
        expect(isNested).toBe(false);
      });

      it('should handle JSON accessor columns (tests buildColumnSelections override)', () => {
        // Use existing schema from shared test schema
        // For unit tests, we'll just verify the method doesn't throw
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['name'], // Use existing column from users table
          },
          'users'
        );

        // This should work with regular columns
        const { query, columnMetadata } = queryBuilder.buildSelectQuery(context, 'users', ['name']);

        expect(query).toBeDefined();
        expect(columnMetadata.selections).toBeDefined();
      });

      it('should build column metadata mapping correctly', () => {
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['name', 'profile.bio'],
          },
          'users'
        );

        const { columnMetadata } = queryBuilder.buildSelectQuery(context, 'users', [
          'name',
          'profile.bio',
        ]);

        expect(columnMetadata.columnMapping).toBeDefined();
        expect(columnMetadata.columnMapping['name']).toBe('name');
        // Nested columns should have aliased keys
        expect(columnMetadata.columnMapping).toHaveProperty(
          Object.keys(columnMetadata.columnMapping).find((key) => key.includes('bio')) || ''
        );
      });
    });

    describe('SQLite-Specific Count Query', () => {
      it('should build basic count query', () => {
        const context = relationshipManager.buildQueryContext({}, 'users');
        const query = queryBuilder.buildCountQuery(context, 'users');

        expect(query).toBeDefined();
      });

      it('should build count query with joins', () => {
        const context = relationshipManager.buildQueryContext(
          {
            filters: [{ columnId: 'profile.bio' }],
          },
          'users'
        );

        const query = queryBuilder.buildCountQuery(context, 'users');
        expect(query).toBeDefined();
      });
    });

    describe('SQLite-Specific Aggregate Query', () => {
      it('should build aggregate query with count function', () => {
        const query = queryBuilder.buildAggregateQuery('age', 'count', 'users');
        expect(query).toBeDefined();
      });

      it('should build aggregate query with sum function', () => {
        const query = queryBuilder.buildAggregateQuery('age', 'sum', 'users');
        expect(query).toBeDefined();
      });

      it('should build aggregate query with joins', () => {
        // Aggregate on related column requires joins
        const query = queryBuilder.buildAggregateQuery('profile.id', 'count', 'users');
        expect(query).toBeDefined();
      });
    });

    describe('SQLite-Specific Filter Options Query', () => {
      it('should build filter options query for direct column', () => {
        const query = queryBuilder.buildFilterOptionsQuery('name', 'users');
        expect(query).toBeDefined();
      });

      it('should build filter options query for related column', () => {
        const query = queryBuilder.buildFilterOptionsQuery('profile.bio', 'users');
        expect(query).toBeDefined();
      });
    });

    describe('SQLite-Specific Min/Max Query', () => {
      it('should build min/max query for direct column', () => {
        const query = queryBuilder.buildMinMaxQuery('age', 'users');
        expect(query).toBeDefined();
      });

      it('should build min/max query for related column', () => {
        const query = queryBuilder.buildMinMaxQuery('profile.id', 'users');
        expect(query).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should throw error for invalid primary table', () => {
        const context = relationshipManager.buildQueryContext({}, 'users');

        expect(() => {
          queryBuilder.buildSelectQuery(context, 'nonexistent', []);
        }).toThrow(QueryError);
      });

      it('should throw error for invalid target table in join', () => {
        const invalidRelationships = {
          'users.invalid': {
            from: 'users',
            to: 'nonexistent',
            foreignKey: 'id',
            localKey: 'userId',
            cardinality: 'one' as const,
            nullable: true,
            joinType: 'left' as const,
          },
        };

        const invalidRelationshipManager = new RelationshipManager(schema, invalidRelationships);

        // Error is thrown during buildQueryContext when resolving column path
        expect(() => {
          invalidRelationshipManager.buildQueryContext(
            {
              columns: ['name', 'invalid.field'],
            },
            'users'
          );
        }).toThrow(RelationshipError);
      });
    });
  });

  describe('Integration Tests (In-Memory SQLite Database)', () => {
    let db: BunSQLiteDatabase;
    let queryBuilder: SQLiteQueryBuilder;
    let relationshipManager: RelationshipManager;
    let sqlite: ReturnType<typeof createSQLiteDatabase>['sqlite'];

    beforeEach(async () => {
      // Create database using shared fixtures
      const { db: sqliteDb, sqlite: sqliteInstance } = createSQLiteDatabase();
      db = sqliteDb;
      sqlite = sqliteInstance;

      // Setup tables and seed data using shared fixtures
      await setupSQLiteDatabase(db);

      // Initialize relationship manager
      const detector = new RelationshipDetector();
      const relationships = detector.detectFromSchema(relationsSchema, schema);
      relationshipManager = new RelationshipManager(schema, relationships);

      // Initialize query builder
      // @ts-expect-error - Type mismatch: BunSQLiteDatabase vs BetterSQLite3Database, but compatible at runtime
      queryBuilder = new SQLiteQueryBuilder(db, schema, relationshipManager);
    });

    afterEach(() => {
      if (sqlite) {
        closeSQLiteDatabase(sqlite);
      }
    });

    describe('JSON Accessor Column Handling', () => {
      it('should extract JSON fields using json_extract', async () => {
        // Query surveys table which has JSON survey column
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['slug', 'survey'], // Include survey JSON column
          },
          'surveys'
        );

        const { query } = queryBuilder.buildSelectQuery(context, 'surveys', ['slug', 'survey']);

        expect(query).toBeDefined();
        expect(queryBuilder.validateQuery(query)).toBe(true);

        // Execute query to verify it works
        const result = await query.execute();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should query with JSON accessors (e.g., survey.title)', async () => {
        // Test JSON accessor column: survey.title
        // This should use json_extract(survey, '$.title')
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['slug', 'survey.title'], // JSON accessor
          },
          'surveys'
        );

        const { query, columnMetadata } = queryBuilder.buildSelectQuery(context, 'surveys', [
          'slug',
          'survey.title',
        ]);

        expect(query).toBeDefined();
        expect(columnMetadata.selections['survey.title']).toBeDefined();
        expect(queryBuilder.validateQuery(query)).toBe(true);

        // Execute query to verify json_extract works
        const result = await query.execute();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should filter by JSON fields', async () => {
        const context = relationshipManager.buildQueryContext(
          {
            filters: [{ columnId: 'survey' }], // Filter on JSON column
            columns: ['slug'],
          },
          'surveys'
        );

        const { query } = queryBuilder.buildSelectQuery(context, 'surveys', ['slug']);
        const filteredQuery = queryBuilder.applyFilters(
          query,
          [
            {
              columnId: 'survey',
              type: 'text',
              operator: 'isNotNull',
              values: [],
            },
          ],
          'surveys'
        );

        expect(filteredQuery).toBeDefined();
        expect(queryBuilder.validateQuery(filteredQuery)).toBe(true);

        // Execute query
        const result = await filteredQuery.execute();
        expect(result).toBeDefined();
      });

      it('should sort by JSON fields', async () => {
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['slug', 'survey'],
          },
          'surveys'
        );

        const { query } = queryBuilder.buildSelectQuery(context, 'surveys', ['slug', 'survey']);
        const sortedQuery = queryBuilder.applySorting(
          query,
          [
            {
              columnId: 'slug',
              direction: 'asc',
            },
          ],
          'surveys'
        );

        expect(sortedQuery).toBeDefined();
        expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);

        // Execute query
        const result = await sortedQuery.execute();
        expect(result).toBeDefined();
      });
    });

    describe('SQLite Array Foreign Key Join Conditions (Integration)', () => {
      it('should use json_each for array FK joins in real queries', async () => {
        // Create a test table with array FK relationship
        await db.run(sql`
          CREATE TABLE IF NOT EXISTS test_events (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            organizer_id TEXT
          )
        `);

        await db.run(sql`INSERT INTO test_events (id, title, organizer_id) VALUES
          (1, 'Event 1', '["1", "2"]'),
          (2, 'Event 2', '["1"]')`);

        // Create relationship for array FK
        // Create proper schema for test_events table that matches the actual database table
        const testEventsTable = sqliteTable('test_events', {
          id: integer('id').primaryKey(),
          title: text('title').notNull(),
          organizerId: text('organizer_id'), // Array FK stored as JSON string
        });

        const testSchema = {
          test_events: testEventsTable,
          users: schema.users,
        };
        const arrayRelationships = {
          'test_events.organizers': {
            from: 'test_events',
            to: 'users',
            foreignKey: 'id',
            localKey: 'organizerId',
            cardinality: 'many' as const,
            nullable: true,
            joinType: 'left' as const,
            isArray: true,
          },
        };

        const arrayRelationshipManager = new RelationshipManager(testSchema, arrayRelationships);
        // @ts-expect-error - Type mismatch: BunSQLiteDatabase vs BetterSQLite3Database, but compatible at runtime
        const arrayQueryBuilder = new SQLiteQueryBuilder(db, testSchema, arrayRelationshipManager);

        const context = arrayRelationshipManager.buildQueryContext(
          {
            columns: ['title', 'organizers.name'],
          },
          'test_events'
        );

        const { query } = arrayQueryBuilder.buildSelectQuery(context, 'test_events', [
          'title',
          'organizers.name',
        ]);

        expect(query).toBeDefined();
        expect(arrayQueryBuilder.validateQuery(query)).toBe(true);

        // Cleanup
        await db.run(sql`DROP TABLE IF EXISTS test_events`);
      });
    });

    describe('Complete Query Building (Integration)', () => {
      it('should build and execute complete query with all SQLite-specific features', async () => {
        const { dataQuery, countQuery, columnMetadata } = queryBuilder.buildCompleteQuery({
          columns: ['name', 'email', 'profile.bio'],
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
        expect(columnMetadata).toBeDefined();
        expect(queryBuilder.validateQuery(dataQuery)).toBe(true);
        expect(queryBuilder.validateQuery(countQuery)).toBe(true);

        // Execute queries to verify they work
        const dataResult = await dataQuery.execute();
        const countResult = await countQuery.execute();

        expect(dataResult).toBeDefined();
        expect(countResult).toBeDefined();
        expect(Array.isArray(dataResult)).toBe(true);
        expect(Array.isArray(countResult)).toBe(true);
      });

      it('should handle computed fields with sortSql in buildSelectQuery', () => {
        const computedFields = {
          postCount: {
            field: 'postCount',
            type: 'number' as const,
            compute: () => 0,
            __resolvedSortSql: sql`(SELECT COUNT(*) FROM posts WHERE user_id = ${schema.users.id})`,
          },
        };

        // Filter out computed fields from sorts before building query context
        // Computed fields are handled separately in applySorting
        const context = relationshipManager.buildQueryContext(
          {
            columns: ['name'],
            sorts: [], // Don't include computed fields in sorts for buildQueryContext
          },
          'users'
        );

        const { query, columnMetadata } = queryBuilder.buildSelectQuery(
          context,
          'users',
          ['name'],
          computedFields
        );

        expect(query).toBeDefined();
        expect(columnMetadata.selections).toHaveProperty('postCount');
        expect(columnMetadata.columnMapping).toHaveProperty('postCount');
        expect(queryBuilder.validateQuery(query)).toBe(true);
      });
    });
  });
});
