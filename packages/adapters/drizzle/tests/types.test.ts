/**
 * Tests for type definitions in the Drizzle adapter
 *
 * This test suite verifies:
 * - ColumnOrExpression type works correctly with both columns and SQL expressions
 * - Type compatibility with Drizzle ORM functions
 */

import { describe, expect, it } from 'bun:test';
import { eq, ilike, isNull, sql } from 'drizzle-orm';
import { jsonb as pgJsonb, pgTable, text as pgText } from 'drizzle-orm/pg-core';
import type { ColumnOrExpression } from '../src/types';

// Create test schema
const mockTable = pgTable('users', {
  id: pgText('id').primaryKey(),
  email: pgText('email').notNull(),
  metadata: pgJsonb('metadata'),
});

describe('ColumnOrExpression Type', () => {
  it('should accept direct column references', () => {
    const column: ColumnOrExpression = mockTable.email;

    // Should work with Drizzle functions that accept columns
    const condition = eq(column, 'test@example.com');
    expect(condition).toBeDefined();
  });

  it('should accept SQL expressions from sql template', () => {
    const expression: ColumnOrExpression = sql`${mockTable.metadata}->>'title'`;

    // Should work with Drizzle functions that accept SQL expressions
    const condition = sql`${expression} IS NOT NULL`;
    expect(condition).toBeDefined();
  });

  it('should work with JSONB extraction expressions', () => {
    // Simulate JSONB extraction expression
    const jsonbExpression: ColumnOrExpression = sql`${mockTable.metadata}->>'title'`;

    // Should be usable in SQL conditions
    const condition = sql`${jsonbExpression} ILIKE ${'%test%'}`;
    expect(condition).toBeDefined();
  });

  it('should work with Drizzle functions that accept ColumnOrExpression', () => {
    // Test with direct column
    const columnCondition = eq(mockTable.email, 'test@example.com');
    expect(columnCondition).toBeDefined();

    // Test with SQL expression
    const expression = sql`${mockTable.metadata}->>'title'`;
    const expressionCondition = sql`${expression} = ${'test'}`;
    expect(expressionCondition).toBeDefined();
  });

  it('should work with null checks for both columns and expressions', () => {
    // Direct column
    const columnNullCheck = isNull(mockTable.email);
    expect(columnNullCheck).toBeDefined();

    // SQL expression
    const expression = sql`${mockTable.metadata}->>'title'`;
    const expressionNullCheck = sql`${expression} IS NULL`;
    expect(expressionNullCheck).toBeDefined();
  });

  it('should work with case-insensitive LIKE for both types', () => {
    // Direct column
    const columnLike = ilike(mockTable.email, '%test%');
    expect(columnLike).toBeDefined();

    // SQL expression - use LOWER() pattern
    const expression = sql`${mockTable.metadata}->>'title'`;
    const expressionLike = sql`LOWER(${expression}) LIKE LOWER(${'%test%'})`;
    expect(expressionLike).toBeDefined();
  });

  it('should maintain type safety when used in filter conditions', () => {
    // This test verifies that ColumnOrExpression maintains type safety
    // when used in actual filter handler scenarios
    const column: ColumnOrExpression = mockTable.email;
    const expression: ColumnOrExpression = sql`${mockTable.metadata}->>'title'`;

    // Both should be assignable to the same type
    const conditions: ColumnOrExpression[] = [column, expression];
    expect(conditions).toHaveLength(2);
  });
});
