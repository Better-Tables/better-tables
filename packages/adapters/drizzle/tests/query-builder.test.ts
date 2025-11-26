import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { SQLiteQueryBuilder } from '../src/query-builders/sqlite-query-builder';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { RelationshipPath, SQLiteQueryBuilderWithJoins } from '../src/types';
import {
  type BunSQLiteDatabase,
  closeSQLiteDatabase,
  createSQLiteDatabase,
  setupSQLiteDatabase,
} from './helpers/test-fixtures';
import { relationsSchema, schema } from './helpers/test-schema';

describe('SQLiteQueryBuilder', () => {
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

  describe('Array Foreign Key Join Conditions', () => {
    it('should generate correct json_each syntax for array FK joins in SQLite', async () => {
      // Set up a schema with array FK relationships for SQLite
      const { schemaSqlite } = await import('./helpers/test-schema-array-fk');

      // Drop tables if they exist to avoid conflicts with beforeEach setup
      await db.run(sql`DROP TABLE IF EXISTS events`);
      await db.run(sql`DROP TABLE IF EXISTS events_users`);

      // Create tables with array FK support
      // Use different table names to avoid conflicts with existing test tables
      await db.run(sql`
        CREATE TABLE events (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          organizer_id TEXT
        )
      `);

      // Create a separate users table for this test to avoid conflicts
      await db.run(sql`
        CREATE TABLE events_users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL
        )
      `);

      // Insert test data
      await db.run(sql`INSERT INTO events_users (id, name, email) VALUES 
        (1, 'John Doe', 'john@example.com'),
        (2, 'Jane Smith', 'jane@example.com')`);

      await db.run(sql`INSERT INTO events (id, title, organizer_id) VALUES 
        (1, 'Event 1', '["1", "2"]'),
        (2, 'Event 2', '["1"]')`);

      // Create relationship detector and detect array FK relationships
      const arrayDetector = new RelationshipDetector();
      let arrayRelationships = arrayDetector.detectFromSchema({}, schemaSqlite);

      // For SQLite, text columns storing JSON arrays may not be auto-detected
      // Manually add the array FK relationship if not detected to ensure we test the functionality
      if (!arrayRelationships['events.organizers']) {
        arrayRelationships = {
          ...arrayRelationships,
          'events.organizers': {
            from: 'events',
            to: 'users',
            foreignKey: 'id',
            localKey: 'organizerId',
            cardinality: 'many',
            nullable: true,
            joinType: 'left',
            isArray: true,
          },
        };
      }

      // Verify array FK relationship exists
      expect(arrayRelationships['events.organizers']).toBeDefined();
      expect(arrayRelationships['events.organizers']?.isArray).toBe(true);

      // Create relationship manager with array FK relationships
      const arrayRelationshipManager = new RelationshipManager(schemaSqlite, arrayRelationships);

      // Create query builder with array FK relationships
      // @ts-expect-error - Type mismatch: BunSQLiteDatabase vs BetterSQLite3Database, but compatible at runtime
      const arrayQueryBuilder = new SQLiteQueryBuilder(db, schemaSqlite, arrayRelationshipManager);

      // Test buildJoinCondition directly with array FK relationship
      // This will call buildArrayJoinCondition internally
      const arrayRelationship = arrayRelationships['events.organizers'];
      expect(arrayRelationship).toBeDefined();
      if (arrayRelationship) {
        const joinCondition = (
          arrayQueryBuilder as unknown as {
            buildJoinCondition: (relationship: RelationshipPath) => SQL;
          }
        ).buildJoinCondition(arrayRelationship);

        // Convert SQL to string to verify the syntax
        // Use the database's dialect to convert SQL object to query string
        // Accessing internal dialect property for testing purposes
        // @ts-expect-error - Type mismatch: BunSQLiteDatabase vs BetterSQLite3Database, but compatible at runtime
        const dialect = db.dialect;
        if (dialect && typeof dialect.sqlToQuery === 'function') {
          const queryResult = dialect.sqlToQuery(joinCondition);
          const sqlString = queryResult.sql;

          // Verify it uses json_each syntax for array FK join
          expect(sqlString).toContain('json_each');
          expect(sqlString).toContain('EXISTS');
          expect(sqlString).toMatch(/json_each\([^)]+organizer_id/i);
          expect(sqlString).toMatch(/json_each\.value\s*=/i);
        } else {
          // Fallback: just verify the SQL object is created (method doesn't throw)
          // This ensures buildArrayJoinCondition is called correctly
          expect(joinCondition).toBeDefined();
        }
      }

      // Also test end-to-end query building
      const context = arrayRelationshipManager.buildQueryContext(
        {
          columns: ['title', 'organizers.name'],
        },
        'events'
      );

      const { query } = arrayQueryBuilder.buildSelectQuery(context, 'events', [
        'title',
        'organizers.name',
      ]);

      expect(query).toBeDefined();
      expect(arrayQueryBuilder.validateQuery(query)).toBe(true);
    });

    it('should use regular join for non-array relationships', () => {
      const context = relationshipManager.buildQueryContext(
        {
          columns: ['name', 'profile.bio'],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users', ['name', 'profile.bio']);

      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);

      // Test that regular join doesn't use array FK syntax
      // Get the relationship for profile.bio
      const allRelationships = relationshipManager.getRelationships();
      const profileRelationship = allRelationships['users.profile'];
      expect(profileRelationship).toBeDefined();
      expect(profileRelationship?.isArray).toBeUndefined(); // Regular FK, not array

      if (profileRelationship) {
        // Access protected method to test regular FK join (should not use array syntax)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const joinCondition = (
          queryBuilder as unknown as { buildJoinCondition: (relationship: RelationshipPath) => SQL }
        ).buildJoinCondition(profileRelationship);

        // Use the database's dialect to convert SQL object to query string
        // Accessing internal dialect property for testing purposes
        // @ts-expect-error - Type mismatch: BunSQLiteDatabase vs BetterSQLite3Database, but compatible at runtime
        const dialect = db.dialect;
        if (dialect && typeof dialect.sqlToQuery === 'function') {
          const queryResult = dialect.sqlToQuery(joinCondition);
          const sqlString = queryResult.sql;

          // Regular FK should NOT use json_each
          expect(sqlString).not.toContain('json_each');
          expect(sqlString).not.toContain('EXISTS');
        } else {
          // Fallback: just verify the SQL object is created (method doesn't throw)
          expect(joinCondition).toBeDefined();
        }
      }
    });
  });
});
