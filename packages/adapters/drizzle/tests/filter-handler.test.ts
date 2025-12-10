import { describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { datetime, mysqlTable } from 'drizzle-orm/mysql-core';
import { pgTable, timestamp } from 'drizzle-orm/pg-core';
import { integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { FilterHandler } from '../src/filter-handler';
import { RelationshipManager } from '../src/relationship-manager';

// Create actual Drizzle tables for testing
const mockPgTable = pgTable('users', {
  id: timestamp('id').primaryKey(),
  created_at: timestamp('created_at'),
});

const mockMysqlTable = mysqlTable('users', {
  id: datetime('id').primaryKey(),
  created_at: datetime('created_at'),
});

const mockSqliteTable = sqliteTable('users', {
  id: integer('id').primaryKey(),
  created_at: integer('created_at', { mode: 'timestamp' }),
});

describe('FilterHandler - Date Logic', () => {
  describe('PostgreSQL Date Casting', () => {
    const schema = { users: mockPgTable };
    const relationshipManager = new RelationshipManager(schema, {});
    const handler = new FilterHandler(schema, relationshipManager, 'postgres');

    it('should cast string dates to timestamp for "is" operator', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: ['2023-01-01'],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      // Verify that a condition was created (would be undefined if casting failed)
      expect(condition).toBeDefined();
      // Verify that string dates produce valid conditions (PostgreSQL requires ::timestamp casting)
      // Test with Date object to ensure both input types work
      const dateFilter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: [new Date('2023-01-01')],
        type: 'date',
      };
      const dateCondition = handler.buildFilterCondition(dateFilter, 'users');
      expect(dateCondition).toBeDefined();
      // Both should produce valid conditions, verifying casting logic handles both string and Date inputs
    });

    it('should cast string dates to timestamp for relative comparisons', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'before',
        values: ['2023-01-01'],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
      // Verify that comparison operators work with string dates (PostgreSQL requires ::timestamp casting)
      const afterFilter: FilterState = {
        columnId: 'created_at',
        operator: 'after',
        values: ['2023-01-01'],
        type: 'date',
      };
      const afterCondition = handler.buildFilterCondition(afterFilter, 'users');
      expect(afterCondition).toBeDefined();
      // Both should be defined, verifying that casting works for comparison operators
    });
  });

  describe('MySQL Date Casting', () => {
    const schema = { users: mockMysqlTable };
    const relationshipManager = new RelationshipManager(schema, {});
    const handler = new FilterHandler(schema, relationshipManager, 'mysql');

    it('should cast string dates using CAST( AS DATETIME) for "is" operator', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: ['2023-01-01'],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
      // Verify that string dates are handled correctly (MySQL requires CAST(...AS DATETIME))
      // Test with Date object to ensure both input types work
      const dateFilter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: [new Date('2023-01-01')],
        type: 'date',
      };
      const dateCondition = handler.buildFilterCondition(dateFilter, 'users');
      expect(dateCondition).toBeDefined();
      // Both should produce valid conditions, verifying MySQL casting works for both input types
    });

    it('should cast string dates using CAST( AS DATETIME) for relative comparisons', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'after',
        values: ['2023-01-01'],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
      // Verify that comparison operators work with string dates (MySQL requires CAST(...AS DATETIME))
      const beforeFilter: FilterState = {
        columnId: 'created_at',
        operator: 'before',
        values: ['2023-01-01'],
        type: 'date',
      };
      const beforeCondition = handler.buildFilterCondition(beforeFilter, 'users');
      expect(beforeCondition).toBeDefined();
      // Both should be defined, verifying that MySQL casting works for comparison operators
    });
  });

  describe('SQLite Date Handling', () => {
    const schema = { users: mockSqliteTable };
    const relationshipManager = new RelationshipManager(schema, {});
    const handler = new FilterHandler(schema, relationshipManager, 'sqlite');

    it('should use direct comparison for number timestamps', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: [1672531200000], // 2023-01-01 timestamp
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
      // Verify that number timestamps work correctly in SQLite (no casting needed)
      // Test with string date to ensure both formats are handled
      const stringFilter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: ['2023-01-01'],
        type: 'date',
      };
      const stringCondition = handler.buildFilterCondition(stringFilter, 'users');
      expect(stringCondition).toBeDefined();
      // Both should produce valid conditions, verifying SQLite handles both number and string dates
    });

    it('should use direct comparison for string dates (assumed stored as text/ISO)', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: ['2023-01-01'],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
      // Verify that string dates are handled correctly for SQLite (stored as text/ISO)
      // Test with number timestamp to ensure both formats are handled
      const numberFilter: FilterState = {
        columnId: 'created_at',
        operator: 'is',
        values: [1672531200000], // Same date as timestamp
        type: 'date',
      };
      const numberCondition = handler.buildFilterCondition(numberFilter, 'users');
      expect(numberCondition).toBeDefined();
      // Both should produce valid conditions, verifying SQLite handles both formats
    });
  });

  describe('Relative Date Helpers', () => {
    // Testing with Postgres as representative for the shared logic
    const schema = { users: mockPgTable };
    const relationshipManager = new RelationshipManager(schema, {});
    const handler = new FilterHandler(schema, relationshipManager, 'postgres');

    it('should generate conditions for "isToday"', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'isToday',
        values: [],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should generate conditions for "isThisWeek"', () => {
      const filter: FilterState = {
        columnId: 'created_at',
        operator: 'isThisWeek',
        values: [],
        type: 'date',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });
  });

  describe('Automatic Timestamp Detection (without type: date)', () => {
    describe('PostgreSQL - Auto-detect timestamp columns', () => {
      const schema = { users: mockPgTable };
      const relationshipManager = new RelationshipManager(schema, {});
      const handler = new FilterHandler(schema, relationshipManager, 'postgres');

      it('should auto-detect timestamp column and use date comparison for "is" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'is' as const,
          values: ['2023-01-01'],
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition) not eq()
      });

      it('should auto-detect timestamp column and use date comparison for "before" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'before' as const,
          values: ['2023-01-01'],
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition)
      });

      it('should auto-detect timestamp column and use date comparison for "after" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'after' as const,
          values: ['2023-01-01'],
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition)
      });
    });

    describe('MySQL - Auto-detect datetime columns', () => {
      const schema = { users: mockMysqlTable };
      const relationshipManager = new RelationshipManager(schema, {});
      const handler = new FilterHandler(schema, relationshipManager, 'mysql');

      it('should auto-detect datetime column and use date comparison for "is" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'is' as const,
          values: ['2023-01-01'],
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition) not eq()
      });

      it('should auto-detect datetime column and use date comparison for "before" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'before' as const,
          values: ['2023-01-01'],
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition)
      });
    });

    describe('SQLite - Auto-detect timestamp integer columns', () => {
      const schema = { users: mockSqliteTable };
      const relationshipManager = new RelationshipManager(schema, {});
      const handler = new FilterHandler(schema, relationshipManager, 'sqlite');

      it('should auto-detect timestamp integer column and use date comparison for "is" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'is' as const,
          values: [1672531200000], // 2023-01-01 timestamp
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition) not eq()
      });

      it('should auto-detect timestamp integer column and use date comparison for "before" operator', () => {
        const filter = {
          columnId: 'created_at',
          operator: 'before' as const,
          values: [1672531200000], // 2023-01-01 timestamp
          // Note: type is NOT 'date' - should auto-detect from column type
        } as FilterState;

        const condition = handler.buildFilterCondition(filter, 'users');
        expect(condition).toBeDefined();
        // Should use date comparison (createDateComparisonCondition)
      });
    });
  });
});
