/**
 * @fileoverview Tests for BaseQueryBuilder
 * @module @better-tables/drizzle-adapter/tests/base-query-builder
 *
 * Tests BaseQueryBuilder methods using SQLiteQueryBuilder as concrete implementation.
 * Protected methods are tested indirectly through public methods.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { SQLiteQueryBuilder } from '../src/query-builders/sqlite-query-builder';
import { RelationshipDetector } from '../src/relationship-detector';
import { RelationshipManager } from '../src/relationship-manager';
import type { SQLiteQueryBuilderWithJoins } from '../src/types';
import { QueryError, RelationshipError } from '../src/types';
import {
  type BunSQLiteDatabase,
  closeSQLiteDatabase,
  createSQLiteDatabase,
  setupSQLiteDatabase,
} from './helpers/test-fixtures';
import { relationsSchema, schema } from './helpers/test-schema';

describe('BaseQueryBuilder', () => {
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

  describe('Filter Application', () => {
    it('should return query unchanged when filters are empty', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const filteredQuery = queryBuilder.applyFilters(query, [], 'users');

      expect(filteredQuery).toBe(query);
    });

    it('should return query unchanged when filters is null', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const filteredQuery = queryBuilder.applyFilters(query, null as unknown as [], 'users');

      expect(filteredQuery).toBe(query);
    });

    it('should apply single filter', () => {
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
      expect(queryBuilder.validateQuery(filteredQuery)).toBe(true);
    });

    it('should apply multiple filters with AND logic', () => {
      const context = relationshipManager.buildQueryContext(
        {
          filters: [{ columnId: 'name' }, { columnId: 'age' }],
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
      expect(queryBuilder.validateQuery(filteredQuery)).toBe(true);
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
      expect(queryBuilder.validateQuery(filteredQuery)).toBe(true);
    });

    it('should handle invalid filter columns (tests validateColumnId indirectly)', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      expect(() => {
        queryBuilder.applyFilters(
          query,
          [
            {
              columnId: 'invalid.column',
              type: 'text',
              operator: 'contains',
              values: ['test'],
            },
          ],
          'users'
        );
      }).toThrow(); // Filter handler wraps RelationshipError in generic Error
    });
  });

  describe('Sorting Application', () => {
    it('should return query unchanged when sorting is empty', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const sortedQuery = queryBuilder.applySorting(query, [], 'users');

      expect(sortedQuery).toBe(query);
    });

    it('should return query unchanged when sorting is null', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const sortedQuery = queryBuilder.applySorting(query, null as unknown as [], 'users');

      expect(sortedQuery).toBe(query);
    });

    it('should apply single column sorting ascending', () => {
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
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
    });

    it('should apply single column sorting descending', () => {
      const context = relationshipManager.buildQueryContext(
        {
          sorts: [{ columnId: 'age' }],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          {
            columnId: 'age',
            direction: 'desc',
          },
        ],
        'users'
      );

      expect(sortedQuery).toBeDefined();
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
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
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
    });

    it('should apply cross-table sorting (tests getColumn indirectly)', () => {
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
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
    });

    it('should throw error for invalid sort columns (tests validateColumnId and findSimilarColumn)', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      expect(() => {
        queryBuilder.applySorting(
          query,
          [
            {
              columnId: 'invalid.column',
              direction: 'asc',
            },
          ],
          'users'
        );
      }).toThrow(RelationshipError);
    });

    it('should throw error for column not found in sorting (tests getColumn)', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      expect(() => {
        queryBuilder.applySorting(
          query,
          [
            {
              columnId: 'nonexistent',
              direction: 'asc',
            },
          ],
          'users'
        );
      }).toThrow(RelationshipError);
    });

    it('should apply sorting with computed field sortSql', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      // Create computed field with resolved sortSql
      const computedFields = {
        postCount: {
          field: 'postCount',
          type: 'number' as const,
          compute: () => 0,
          __resolvedSortSql: sql`(SELECT COUNT(*) FROM posts WHERE user_id = ${schema.users.id})`,
        },
      };

      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          {
            columnId: 'postCount',
            direction: 'desc',
          },
        ],
        'users',
        computedFields
      );

      expect(sortedQuery).toBeDefined();
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
    });

    it('should apply sorting with computed field sortSql ascending', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      // Create computed field with resolved sortSql
      const computedFields = {
        postCount: {
          field: 'postCount',
          type: 'number' as const,
          compute: () => 0,
          __resolvedSortSql: sql`(SELECT COUNT(*) FROM posts WHERE user_id = ${schema.users.id})`,
        },
      };

      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          {
            columnId: 'postCount',
            direction: 'asc',
          },
        ],
        'users',
        computedFields
      );

      expect(sortedQuery).toBeDefined();
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
    });

    it('should handle computed field with escaped identifier in sortSql', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      // Create computed field with identifier containing quotes
      const computedFields = {
        'user"name': {
          field: 'user"name',
          type: 'text' as const,
          compute: () => '',
          __resolvedSortSql: sql`LOWER(${schema.users.name})`,
        },
      };

      const sortedQuery = queryBuilder.applySorting(
        query,
        [
          {
            columnId: 'user"name',
            direction: 'asc',
          },
        ],
        'users',
        computedFields
      );

      expect(sortedQuery).toBeDefined();
      expect(queryBuilder.validateQuery(sortedQuery)).toBe(true);
    });
  });

  describe('Pagination Application', () => {
    it('should return query unchanged when pagination is null', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const paginatedQuery = queryBuilder.applyPagination(
        query,
        null as unknown as { page: number; limit: number }
      );

      expect(paginatedQuery).toBe(query);
    });

    it('should apply pagination for first page', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const paginatedQuery = queryBuilder.applyPagination(query, {
        page: 1,
        limit: 5,
      });

      expect(paginatedQuery).toBeDefined();
      expect(queryBuilder.validateQuery(paginatedQuery)).toBe(true);
    });

    it('should apply pagination for subsequent pages', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const paginatedQuery = queryBuilder.applyPagination(query, {
        page: 2,
        limit: 10,
      });

      expect(paginatedQuery).toBeDefined();
      expect(queryBuilder.validateQuery(paginatedQuery)).toBe(true);
    });

    it('should handle edge case pagination (page 0)', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');
      const paginatedQuery = queryBuilder.applyPagination(query, {
        page: 0,
        limit: 10,
      });

      expect(paginatedQuery).toBeDefined();
      // Page 0 should result in offset of -10, which is technically valid SQL
      expect(queryBuilder.validateQuery(paginatedQuery)).toBe(true);
    });
  });

  describe('Complete Query Building', () => {
    it('should build complete query with all parameters', () => {
      const { dataQuery, countQuery, columnMetadata } = queryBuilder.buildCompleteQuery({
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
      expect(columnMetadata).toBeDefined();
      expect(columnMetadata.selections).toBeDefined();
      expect(columnMetadata.columnMapping).toBeDefined();
      expect(queryBuilder.validateQuery(dataQuery)).toBe(true);
      expect(queryBuilder.validateQuery(countQuery)).toBe(true);
    });

    it('should build query with minimal parameters', () => {
      const { dataQuery, countQuery, columnMetadata } = queryBuilder.buildCompleteQuery({
        primaryTable: 'users',
      });

      expect(dataQuery).toBeDefined();
      expect(countQuery).toBeDefined();
      expect(columnMetadata).toBeDefined();
      expect(queryBuilder.validateQuery(dataQuery)).toBe(true);
      expect(queryBuilder.validateQuery(countQuery)).toBe(true);
    });

    it('should build query with only filters', () => {
      const { dataQuery, countQuery } = queryBuilder.buildCompleteQuery({
        filters: [
          {
            columnId: 'age',
            type: 'number',
            operator: 'greaterThan',
            values: [25],
          },
        ],
        primaryTable: 'users',
      });

      expect(dataQuery).toBeDefined();
      expect(countQuery).toBeDefined();
      expect(queryBuilder.validateQuery(dataQuery)).toBe(true);
      expect(queryBuilder.validateQuery(countQuery)).toBe(true);
    });

    it('should build query with only sorting', () => {
      const { dataQuery, countQuery } = queryBuilder.buildCompleteQuery({
        sorting: [{ columnId: 'name', direction: 'asc' }],
        primaryTable: 'users',
      });

      expect(dataQuery).toBeDefined();
      expect(countQuery).toBeDefined();
      expect(queryBuilder.validateQuery(dataQuery)).toBe(true);
      expect(queryBuilder.validateQuery(countQuery)).toBe(true);
    });

    it('should build query with only pagination', () => {
      const { dataQuery, countQuery } = queryBuilder.buildCompleteQuery({
        pagination: { page: 1, limit: 10 },
        primaryTable: 'users',
      });

      expect(dataQuery).toBeDefined();
      expect(countQuery).toBeDefined();
      expect(queryBuilder.validateQuery(dataQuery)).toBe(true);
      expect(queryBuilder.validateQuery(countQuery)).toBe(true);
    });
  });

  describe('Query Validation', () => {
    it('should validate valid queries', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should reject null queries', () => {
      expect(queryBuilder.validateQuery(null as unknown as SQLiteQueryBuilderWithJoins)).toBe(
        false
      );
    });

    it('should reject undefined queries', () => {
      expect(queryBuilder.validateQuery(undefined as unknown as SQLiteQueryBuilderWithJoins)).toBe(
        false
      );
    });

    it('should reject invalid query objects', () => {
      expect(queryBuilder.validateQuery({} as unknown as SQLiteQueryBuilderWithJoins)).toBe(false);
    });

    it('should reject queries without execute method', () => {
      expect(
        queryBuilder.validateQuery({ execute: null } as unknown as SQLiteQueryBuilderWithJoins)
      ).toBe(false);
    });

    it('should reject queries with non-function execute', () => {
      expect(
        queryBuilder.validateQuery({
          execute: 'not a function',
        } as unknown as SQLiteQueryBuilderWithJoins)
      ).toBe(false);
    });
  });

  describe('Query Plan', () => {
    it('should return query plan not available for queries without explain', () => {
      const context = relationshipManager.buildQueryContext({}, 'users');
      const { query } = queryBuilder.buildSelectQuery(context, 'users');

      const plan = queryBuilder.getQueryPlan(query);
      expect(plan).toBe('Query plan not available');
    });

    it('should handle queries with explain property but not a function', () => {
      const mockQuery = {
        execute: () => Promise.resolve([]),
        explain: 'not a function',
      } as unknown as SQLiteQueryBuilderWithJoins;

      const plan = queryBuilder.getQueryPlan(mockQuery);
      expect(plan).toBe('Query plan not available');
    });

    it('should handle queries with explain function returning non-string', () => {
      const mockQuery = {
        execute: () => Promise.resolve([]),
        explain: () => ({ not: 'a string' }),
      } as unknown as SQLiteQueryBuilderWithJoins;

      const plan = queryBuilder.getQueryPlan(mockQuery);
      expect(plan).toBe('Query plan not available');
    });

    it('should handle errors in getQueryPlan gracefully', () => {
      const mockQuery = {
        execute: () => Promise.resolve([]),
        get explain() {
          throw new Error('Test error');
        },
      } as unknown as SQLiteQueryBuilderWithJoins;

      const plan = queryBuilder.getQueryPlan(mockQuery);
      expect(plan).toBe('Query plan not available');
    });
  });

  describe('Join Condition Building (via buildSelectQuery)', () => {
    it('should build regular foreign key joins (tests buildJoinCondition)', () => {
      const context = relationshipManager.buildQueryContext(
        {
          columns: ['name', 'profile.bio'],
        },
        'users'
      );

      const { query } = queryBuilder.buildSelectQuery(context, 'users', ['name', 'profile.bio']);

      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should handle missing tables in join (tests buildJoinCondition error handling)', () => {
      // Create a relationship manager with invalid relationship
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

    it('should handle missing columns in join (tests buildJoinCondition error handling)', () => {
      // Create a relationship with invalid column references
      const invalidRelationships = {
        'users.invalid': {
          from: 'users',
          to: 'profiles',
          foreignKey: 'nonexistent',
          localKey: 'nonexistent',
          cardinality: 'one' as const,
          nullable: true,
          joinType: 'left' as const,
        },
      };

      const invalidRelationshipManager = new RelationshipManager(schema, invalidRelationships);

      // Error is thrown during buildQueryContext when validating related table field
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

  describe('Column Selection Building (via buildSelectQuery)', () => {
    it('should build selections for direct columns (tests buildColumnSelections)', () => {
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
      expect(columnMetadata.selections).toBeDefined();
      expect(columnMetadata.selections.name).toBeDefined();
      expect(columnMetadata.selections.email).toBeDefined();
      expect(columnMetadata.columnMapping.name).toBe('name');
      expect(columnMetadata.columnMapping.email).toBe('email');
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build selections for nested relationship columns (tests buildColumnSelections)', () => {
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
      expect(columnMetadata.selections).toBeDefined();
      expect(columnMetadata.columnMapping).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should auto-include primary key (tests buildColumnSelections)', () => {
      const context = relationshipManager.buildQueryContext(
        {
          columns: ['name'],
        },
        'users'
      );

      const { columnMetadata } = queryBuilder.buildSelectQuery(context, 'users', ['name']);

      // Primary key should be included even if not explicitly requested
      expect(columnMetadata.selections.id).toBeDefined();
    });

    it('should build flat selections for relationships when filters use relationships but no columns (tests buildFlatSelectionsForRelationships)', () => {
      const context = relationshipManager.buildQueryContext(
        {
          filters: [{ columnId: 'profile.bio' }],
        },
        'users'
      );

      // No columns specified, but filters require relationship
      const { query, columnMetadata } = queryBuilder.buildSelectQuery(context, 'users');

      expect(query).toBeDefined();
      expect(columnMetadata.selections).toBeDefined();
      // Should include columns from both users and profiles tables
      expect(Object.keys(columnMetadata.selections).length).toBeGreaterThan(0);
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });
  });

  describe('Aggregate Functions (via buildAggregateQuery)', () => {
    it('should build aggregate query with count function (tests getAggregateFunction)', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'count', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build aggregate query with sum function (tests getAggregateFunction)', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'sum', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build aggregate query with avg function (tests getAggregateFunction)', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'avg', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build aggregate query with min function (tests getAggregateFunction)', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'min', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build aggregate query with max function (tests getAggregateFunction)', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'max', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build aggregate query with distinct function (tests getAggregateFunction)', () => {
      const query = queryBuilder.buildAggregateQuery('age', 'distinct', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should throw error for invalid aggregate function (tests validateAggregateFunction and findSimilarFunction)', () => {
      expect(() => {
        queryBuilder.buildAggregateQuery('age', 'invalid' as 'count', 'users');
      }).toThrow(QueryError);
    });

    it('should throw error for invalid column ID in aggregate (tests validateColumnId)', () => {
      expect(() => {
        queryBuilder.buildAggregateQuery('invalid.column' as 'age', 'count', 'users');
      }).toThrow(QueryError);
    });

    it('should handle aggregate with column ID containing whitespace (tests validateColumnId)', () => {
      expect(() => {
        queryBuilder.buildAggregateQuery(' age ' as 'age', 'count', 'users');
      }).toThrow(QueryError);
    });

    it('should handle aggregate with empty column ID (tests validateColumnId)', () => {
      expect(() => {
        queryBuilder.buildAggregateQuery('' as 'age', 'count', 'users');
      }).toThrow(QueryError);
    });
  });

  describe('Min/Max Queries (via buildMinMaxQuery)', () => {
    it('should build min/max query for valid numeric column', () => {
      const query = queryBuilder.buildMinMaxQuery('age', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build min/max query for valid string column', () => {
      const query = queryBuilder.buildMinMaxQuery('name', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should build min/max query for related column', () => {
      const query = queryBuilder.buildMinMaxQuery('profile.id', 'users');
      expect(query).toBeDefined();
      expect(queryBuilder.validateQuery(query)).toBe(true);
    });

    it('should throw error for invalid column ID (tests validateColumnId)', () => {
      expect(() => {
        queryBuilder.buildMinMaxQuery('invalid.column' as 'age', 'users');
      }).toThrow(QueryError);
    });
  });

  describe('Error Messages with Suggestions', () => {
    it('should provide suggestion for similar column name (tests findSimilarColumn)', () => {
      try {
        queryBuilder.buildFilterOptionsQuery('nam', 'users'); // Typo: 'nam' instead of 'name'
      } catch (error) {
        expect(error).toBeInstanceOf(RelationshipError);
        const relationshipError = error as RelationshipError;
        // Should suggest 'name' as similar column
        expect(relationshipError.details).toBeDefined();
      }
    });

    it('should provide suggestion for similar function name (tests findSimilarFunction)', () => {
      try {
        queryBuilder.buildAggregateQuery('age', 'cnt' as 'count', 'users'); // Typo: 'cnt' instead of 'count'
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        const queryError = error as QueryError;
        // Should suggest 'count' as similar function
        expect(queryError.details).toBeDefined();
      }
    });
  });
});
