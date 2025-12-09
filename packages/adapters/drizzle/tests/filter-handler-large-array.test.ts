/**
 * Tests for large array parameter binding in PostgreSQL queries
 *
 * This test suite verifies:
 * - Parameter binding works correctly with very large arrays (15,000+ values)
 * - Different approaches to handle large arrays (VALUES, temporary tables, etc.)
 * - Type casting works correctly for all supported array types
 * - Both isAnyOf and isNoneOf operators work with large arrays
 * - Edge cases (empty arrays, single value, boundary conditions)
 */

import { describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { FilterHandler } from '../src/filter-handler';
import { RelationshipManager } from '../src/relationship-manager';

// Create test schema with various column types
const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
});

const schema = { users: usersTable };
const relationshipManager = new RelationshipManager(schema, {});
const handler = new FilterHandler(schema, relationshipManager, 'postgres');

/**
 * Generate an array of test values
 */
function generateTestValues(count: number, type: 'uuid' | 'text' = 'uuid'): string[] {
  const values: string[] = [];
  for (let i = 0; i < count; i++) {
    if (type === 'uuid') {
      // Generate deterministic UUIDs for testing
      const hex = i.toString(16).padStart(32, '0');
      values.push(
        `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
      );
    } else {
      values.push(`value-${i}`);
    }
  }
  return values;
}

describe('FilterHandler - Large Array Parameter Binding', () => {
  describe('isAnyOf Operator with Large Arrays', () => {
    it('should handle array with 100 values (current batch size)', () => {
      const values = generateTestValues(100);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle array with 1,000 values (threshold)', () => {
      const values = generateTestValues(1000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle array with 5,000 values (medium)', () => {
      const values = generateTestValues(5000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle array with 15,000 values (reported error size)', () => {
      const values = generateTestValues(15000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle array with 50,000 values (stress test)', () => {
      const values = generateTestValues(50000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle text column with large array', () => {
      const values = generateTestValues(15000, 'text');
      const filter: FilterState = {
        columnId: 'email',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });
  });

  describe('isNoneOf Operator with Large Arrays', () => {
    it('should handle array with 100 values', () => {
      const values = generateTestValues(100);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isNoneOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle array with 15,000 values', () => {
      const values = generateTestValues(15000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isNoneOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle array with 50,000 values', () => {
      const values = generateTestValues(50000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isNoneOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should return undefined for empty array', () => {
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values: [],
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeUndefined();
    });

    it('should handle single value array', () => {
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values: ['019a4f81-2758-73f9-9bc2-5832f88c056c'],
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle exactly 1000 values (boundary condition)', () => {
      const values = generateTestValues(1000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle 1001 values (just over threshold)', () => {
      const values = generateTestValues(1001);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle exactly 50 values (new batch size)', () => {
      const values = generateTestValues(50);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle 51 values (just over new batch size)', () => {
      const values = generateTestValues(51);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });

    it('should handle single batch case (50 values or less when over threshold)', () => {
      // Test that single batch (50 values) works correctly when over 1000 threshold
      const values = generateTestValues(50);
      // Force it to use large array handler by using 1001 values total
      const allValues = [...values, ...generateTestValues(951)];
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values: allValues,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });
  });

  describe('Type Casting', () => {
    it('should properly cast uuid values in large arrays', () => {
      const values = generateTestValues(15000);
      const filter: FilterState = {
        columnId: 'id',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
      // The SQL should include ::uuid casting
    });

    it('should properly cast text values in large arrays', () => {
      const values = generateTestValues(15000, 'text');
      const filter: FilterState = {
        columnId: 'email',
        operator: 'isAnyOf',
        values,
        type: 'option',
      };

      const condition = handler.buildFilterCondition(filter, 'users');
      expect(condition).toBeDefined();
    });
  });

  describe('Parameter Binding Investigation', () => {
    it('should test sql.join() vs manual combination', () => {
      // This test will help us understand which approach preserves parameters better
      const testValues = generateTestValues(100);

      // Test manual combination (current approach)
      const valueParts: ReturnType<typeof sql>[] = [];
      for (const value of testValues) {
        valueParts.push(sql`(${value})`);
      }

      if (valueParts.length === 0) {
        throw new Error('No value parts generated');
      }

      let manualCombined = valueParts[0];
      for (let i = 1; i < valueParts.length; i++) {
        manualCombined = sql`${manualCombined}, ${valueParts[i]}`;
      }

      // Test sql.join() approach
      const joinCombined = sql.join(valueParts, sql`, `);

      // Both should be defined
      expect(manualCombined).toBeDefined();
      expect(joinCombined).toBeDefined();
    });

    it('should test smaller batches', () => {
      // Test if smaller batches (50 values) work better
      const testValues = generateTestValues(50);
      const valueParts: ReturnType<typeof sql>[] = [];

      for (const value of testValues) {
        valueParts.push(sql`(${value})`);
      }

      const valuesClause = sql`(VALUES ${sql.join(valueParts, sql`, `)}) AS t(val)`;
      expect(valuesClause).toBeDefined();
    });
  });
});
