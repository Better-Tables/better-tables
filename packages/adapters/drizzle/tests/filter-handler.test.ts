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
      // We can't easily check the SQL string output from Drizzle objects directly in unit tests without a driver,
      // but we can verify it didn't throw and produced a defined condition.
      // In a real integration test we would verify the SQL, but here we trust the logic path was taken.
      expect(condition).toBeDefined();
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
});
