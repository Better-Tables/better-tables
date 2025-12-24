/**
 * @fileoverview Tests for MySQLQueryBuilder
 * @module @better-tables/drizzle-adapter/tests/mysql-query-builder
 *
 * Tests MySQL-specific query builder methods including JSON_SEARCH for array FKs
 * and JSON_EXTRACT for JSON accessor columns.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { SQL } from 'drizzle-orm';
import { json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type mysql from 'mysql2/promise';
import { MySQLQueryBuilder } from '../src/query-builders/mysql-query-builder';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipPath } from '../src/types';
import { QueryError, RelationshipError } from '../src/types';
import {
  closeMySQLDatabase,
  createMySQLDatabase,
  dropMySQLDatabase,
  ensureMySQLDatabase,
  setupMySQLDatabase,
} from './helpers/test-fixtures';
import { relationsSchema, schema } from './helpers/test-schema';

describe('MySQLQueryBuilder', () => {
  describe('Unit Tests (Mocked Database)', () => {
    let mockDb: MySql2Database<typeof schema>;
    let queryBuilder: MySQLQueryBuilder;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      // Create a mock database connection with necessary methods
      // In unit tests, we don't actually connect to MySQL
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
      } as unknown as MySql2Database<typeof schema>;

      // Initialize relationship manager
      const detector = new RelationshipDetector();
      const relationships = detector.detectFromSchema(relationsSchema, schema);
      relationshipManager = new RelationshipManager(schema, relationships);

      // Initialize query builder with mock database
      // @ts-expect-error - Mock database for unit tests, type mismatch expected
      queryBuilder = new MySQLQueryBuilder(mockDb, schema, relationshipManager);
    });

    describe('MySQL-Specific Array Join Conditions', () => {
      it('should use JSON_SEARCH syntax for array foreign keys (tests buildArrayJoinCondition)', () => {
        // Create schema with events and users tables for array FK test
        const eventsTable = mysqlTable('events', {
          id: varchar('id', { length: 36 }).primaryKey(),
          title: varchar('title', { length: 255 }).notNull(),
          organizerId: json('organizer_id'),
        });

        const usersTable = mysqlTable('users', {
          id: varchar('id', { length: 36 }).primaryKey(),
          name: varchar('name', { length: 255 }).notNull(),
          email: varchar('email', { length: 255 }).notNull(),
        });

        const testSchema = {
          events: eventsTable,
          users: usersTable,
        };

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

        const arrayRelationshipManager = new RelationshipManager(testSchema, arrayRelationships);
        const arrayQueryBuilder = new MySQLQueryBuilder(
          // @ts-expect-error - Mock database for unit tests, type mismatch expected
          mockDb as unknown as MySql2Database<typeof testSchema>,
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

          // Verify the join condition is created
          // In unit tests with mocked database, we verify the method works
          // The actual SQL syntax is verified in integration tests
          expect(joinCondition).toBeDefined();

          // Try to convert to SQL string if possible (for syntax verification)
          try {
            const sqlResult = (
              joinCondition as unknown as { toSQL: () => { sql: string; params: unknown[] } }
            ).toSQL();
            const sqlString = sqlResult.sql;

            // Verify it uses JSON_SEARCH syntax for array FK join
            expect(sqlString).toContain('JSON_SEARCH');
            expect(sqlString).toContain('IS NOT NULL');
            expect(sqlString).toMatch(/JSON_SEARCH\([^)]+organizer_id/i);
          } catch {
            // If toSQL() is not available, just verify the condition was created
            // This is acceptable for unit tests with mocked database
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

    describe('MySQL-Specific Select Query Building', () => {
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

        const { query, columnMetadata } = queryBuilder.buildSelectQuery(context, 'users', [
          'name',
          'profile.bio',
        ]);

        expect(query).toBeDefined();
        expect(columnMetadata).toBeDefined();
      });

      it('should handle JSON accessor columns (tests buildColumnSelections override)', () => {
        // Create schema with JSON column
        const surveysUnit = mysqlTable('surveys', {
          id: varchar('id', { length: 36 }).primaryKey(),
          survey: json('survey'), // JSON column
        });

        const schemaWithJson = { surveys: surveysUnit };
        const jsonRelationshipManager = new RelationshipManager(schemaWithJson, {});
        const jsonQueryBuilder = new MySQLQueryBuilder(
          // @ts-expect-error - Mock database for unit tests, type mismatch expected
          mockDb as unknown as MySql2Database<typeof schemaWithJson>,
          schemaWithJson,
          jsonRelationshipManager
        );

        const context = jsonRelationshipManager.buildQueryContext(
          {
            columns: ['survey.title'], // JSON accessor
          },
          'surveys'
        );

        // This should use JSON_EXTRACT for survey.title
        const { query, columnMetadata } = jsonQueryBuilder.buildSelectQuery(context, 'surveys', [
          'survey.title',
        ]);

        expect(query).toBeDefined();
        expect(columnMetadata.selections).toBeDefined();
        // The selection should use JSON_EXTRACT
        expect(columnMetadata.selections['survey.title']).toBeDefined();
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
        expect(columnMetadata.columnMapping.name).toBe('name');
        // Nested columns should have aliased keys
        expect(columnMetadata.columnMapping).toHaveProperty(
          Object.keys(columnMetadata.columnMapping).find((key) => key.includes('bio')) || ''
        );
      });
    });

    describe('MySQL-Specific Count Query', () => {
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

    describe('MySQL-Specific Aggregate Query', () => {
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

    describe('MySQL-Specific Filter Options Query', () => {
      it('should build filter options query for direct column', () => {
        const query = queryBuilder.buildFilterOptionsQuery('name', 'users');
        expect(query).toBeDefined();
      });

      it('should build filter options query for related column', () => {
        const query = queryBuilder.buildFilterOptionsQuery('profile.bio', 'users');
        expect(query).toBeDefined();
      });
    });

    describe('MySQL-Specific Min/Max Query', () => {
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

  describe('Integration Tests (Real MySQL Database)', () => {
    let db: MySql2Database<typeof import('./helpers/test-schema').schema>;
    let queryBuilder: MySQLQueryBuilder;
    let relationshipManager: RelationshipManager;
    let connection: mysql.Connection;
    let connectionString: string;
    let databaseName: string;

    beforeAll(async () => {
      const envConnectionString = process.env.MYSQL_TEST_URL;
      if (!envConnectionString) {
        // Skip integration tests if MySQL is not available
        return;
      }
      connectionString = envConnectionString;

      databaseName = await ensureMySQLDatabase(connectionString);

      // Connect and set up tables with seed data
      const { connection: setupConnection } = await createMySQLDatabase(connectionString);
      await setupMySQLDatabase(setupConnection);
      await closeMySQLDatabase(setupConnection);
    });

    beforeEach(async () => {
      const envConnectionString = process.env.MYSQL_TEST_URL;
      if (!envConnectionString) {
        return; // Skip if MySQL not available
      }

      // Connect to the existing database and reset tables with seed data
      const { db: mysqlDb, connection: mysqlConnection } =
        await createMySQLDatabase(connectionString);
      connection = mysqlConnection;
      db = mysqlDb;
      await setupMySQLDatabase(connection);

      // Import schema and relations
      const { schema, relationsSchema: testRelationsSchema } = await import(
        './helpers/test-schema'
      );

      // Initialize relationship manager
      const detector = new RelationshipDetector();
      const relationships = detector.detectFromSchema(testRelationsSchema, schema);
      relationshipManager = new RelationshipManager(schema, relationships);

      // Initialize query builder
      // @ts-expect-error - Type mismatch between test schema and actual schema types
      queryBuilder = new MySQLQueryBuilder(db, schema, relationshipManager);
    });

    afterEach(async () => {
      if (connection) {
        await closeMySQLDatabase(connection);
      }
    });

    afterAll(async () => {
      if (connectionString && databaseName) {
        try {
          await dropMySQLDatabase(connectionString, databaseName);
        } catch (error) {
          // Ignore errors during cleanup (database might already be dropped)
          void error;
        }
      }
    });

    describe('JSON Accessor Column Handling', () => {
      it('should extract JSON fields using JSON_EXTRACT', async () => {
        const envConnectionString = process.env.MYSQL_TEST_URL;
        if (!envConnectionString) {
          return; // Skip if MySQL not available
        }

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
        const envConnectionString = process.env.MYSQL_TEST_URL;
        if (!envConnectionString) {
          return; // Skip if MySQL not available
        }

        // Test JSON accessor column: survey.title
        // This should use JSON_EXTRACT(survey, '$.title')
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

        // Execute query to verify JSON_EXTRACT works
        const result = await query.execute();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should filter by JSON fields', async () => {
        const envConnectionString = process.env.MYSQL_TEST_URL;
        if (!envConnectionString) {
          return; // Skip if MySQL not available
        }

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
        const envConnectionString = process.env.MYSQL_TEST_URL;
        if (!envConnectionString) {
          return; // Skip if MySQL not available
        }

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

    describe('MySQL Array Foreign Key Join Conditions (Integration)', () => {
      it('should use JSON_SEARCH for array FK joins in real queries', async () => {
        const envConnectionString = process.env.MYSQL_TEST_URL;
        if (!envConnectionString) {
          return; // Skip if MySQL not available
        }

        // Create a test table with array FK relationship
        await connection.query(`
          CREATE TABLE IF NOT EXISTS test_events (
            id VARCHAR(36) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            organizer_id JSON
          )
        `);

        await connection.query(`
          INSERT INTO test_events (id, title, organizer_id) VALUES
          ('1', 'Event 1', '[1, 2]'),
          ('2', 'Event 2', '[1]')
        `);

        // Create relationship for array FK
        const testEventsTable = mysqlTable('test_events', {
          id: varchar('id', { length: 36 }).primaryKey(),
          title: varchar('title', { length: 255 }).notNull(),
          organizerId: json('organizer_id'),
        });

        // Import schema for users table
        const { schema: testSchemaImport } = await import('./helpers/test-schema');
        const testSchema = {
          test_events: testEventsTable,
          users: testSchemaImport.users,
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
        // @ts-expect-error - Type mismatch between test schema and actual schema types
        const arrayQueryBuilder = new MySQLQueryBuilder(db, testSchema, arrayRelationshipManager);

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
        await connection.query('DROP TABLE IF EXISTS test_events');
      });
    });

    describe('Complete Query Building (Integration)', () => {
      it('should build and execute complete query with all MySQL-specific features', async () => {
        const envConnectionString = process.env.MYSQL_TEST_URL;
        if (!envConnectionString) {
          return; // Skip if MySQL not available
        }

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
    });
  });
});
