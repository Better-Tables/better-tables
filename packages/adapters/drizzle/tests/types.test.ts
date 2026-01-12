/**
 * Tests for type definitions in the Drizzle adapter
 *
 * This test suite verifies:
 * - ColumnOrExpression type works correctly with both columns and SQL expressions
 * - Type compatibility with Drizzle ORM functions
 */

import { describe, expect, it } from 'bun:test';
import { eq, ilike, isNull, relations, sql } from 'drizzle-orm';
import { jsonb as pgJsonb, pgTable, text as pgText } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  ColumnOrExpression,
  ComputedFieldConfig,
  DrizzleAdapterConfig,
  DrizzleDatabase,
  ExtractSchemaFromDB,
  FilterTablesFromSchema,
} from '../src/types';
import { filterTablesFromSchema } from '../src/utils/schema-extractor';

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

describe('ComputedFieldConfig Type', () => {
  it('should accept valid computed field configuration', () => {
    const computedField: ComputedFieldConfig<{ id: string; name: string }> = {
      field: 'fullName',
      type: 'text',
      compute: (row) => `${row.name} (${row.id})`,
    };

    expect(computedField.field).toBe('fullName');
    expect(computedField.type).toBe('text');
    expect(computedField.compute).toBeDefined();
  });

  it('should accept computed field with filter function', () => {
    const computedField: ComputedFieldConfig<{ id: string }> = {
      field: 'count',
      type: 'number',
      compute: () => 0,
      filter: async (filter) => {
        return [
          {
            columnId: 'id',
            operator: 'equals',
            values: [String(filter.values[0])],
            type: 'text',
          },
        ];
      },
    };

    expect(computedField.filter).toBeDefined();
  });

  it('should accept computed field with includeByDefault flag', () => {
    const computedField: ComputedFieldConfig = {
      field: 'alwaysIncluded',
      type: 'text',
      compute: () => 'value',
      includeByDefault: true,
    };

    expect(computedField.includeByDefault).toBe(true);
  });

  it('should accept computed field with requiresColumn flag', () => {
    const computedField: ComputedFieldConfig<{ age: number }> = {
      field: 'ageDisplay',
      type: 'text',
      requiresColumn: true,
      compute: (row) => {
        // This computed field needs access to the underlying 'age' column
        const age = row.age;
        return age !== null && age !== undefined ? `Age: ${age}` : 'Unknown';
      },
    };

    expect(computedField.requiresColumn).toBe(true);
    expect(computedField.compute).toBeDefined();
  });

  it('should accept computed field with sortSql function', () => {
    const computedField: ComputedFieldConfig = {
      field: 'userCount',
      type: 'number',
      compute: () => 0,
      sortSql: async () => {
        // Return a SQL expression for sorting
        // Using a simple SQL expression that doesn't reference schema properties
        // In real usage, you would access context.schema with proper typing
        return sql`(SELECT COUNT(*) FROM user_segment_mappings)`;
      },
    };

    expect(computedField.sortSql).toBeDefined();
    expect(typeof computedField.sortSql).toBe('function');
  });

  it('should accept computed field with synchronous sortSql function', () => {
    const computedField: ComputedFieldConfig = {
      field: 'displayName',
      type: 'text',
      compute: () => '',
      sortSql: () => {
        // Synchronous SQL expression
        // Using a simple SQL expression that doesn't reference schema properties
        // In real usage, you would access context.schema with proper typing
        return sql`LOWER('test')`;
      },
    };

    expect(computedField.sortSql).toBeDefined();
    expect(typeof computedField.sortSql).toBe('function');
  });
});

describe('DrizzleAdapterConfig with ComputedFields', () => {
  // Create a simple test schema
  const testSchema = {
    users: mockTable,
  };

  it('should accept valid computedFields configuration', () => {
    const mockDb = {} as DrizzleDatabase<'postgres'>;
    const config: DrizzleAdapterConfig<typeof testSchema, 'postgres'> = {
      db: mockDb,
      schema: testSchema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'fullName',
            type: 'text',
            compute: (row) => row.email,
          },
        ],
      },
    };

    expect(config.computedFields).toBeDefined();
    expect(config.computedFields?.users).toHaveLength(1);
  });

  it('should accept empty computedFields', () => {
    const mockDb = {} as DrizzleDatabase<'postgres'>;
    const config: DrizzleAdapterConfig<typeof testSchema, 'postgres'> = {
      db: mockDb,
      schema: testSchema,
      driver: 'postgres',
      computedFields: {},
    };

    expect(config.computedFields).toBeDefined();
    expect(Object.keys(config.computedFields || {})).toHaveLength(0);
  });

  it('should accept undefined computedFields', () => {
    const mockDb = {} as DrizzleDatabase<'postgres'>;
    const config: DrizzleAdapterConfig<typeof testSchema, 'postgres'> = {
      db: mockDb,
      schema: testSchema,
      driver: 'postgres',
    };

    expect(config.computedFields).toBeUndefined();
  });

  it('should accept multiple computed fields for a table', () => {
    const mockDb = {} as DrizzleDatabase<'postgres'>;
    const config: DrizzleAdapterConfig<typeof testSchema, 'postgres'> = {
      db: mockDb,
      schema: testSchema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'fullName',
            type: 'text',
            compute: (row) => row.email,
          },
          {
            field: 'isActive',
            type: 'option',
            compute: () => true,
          },
        ],
      },
    };

    expect(config.computedFields?.users).toHaveLength(2);
  });
});

describe('FilterTablesFromSchema Type and Runtime Function', () => {
  // Create test tables
  const usersTable = pgTable('users', {
    id: pgText('id').primaryKey(),
    email: pgText('email').notNull(),
  });

  const profilesTable = pgTable('profiles', {
    id: pgText('id').primaryKey(),
    userId: pgText('user_id').notNull(),
    bio: pgText('bio'),
  });

  // Create test relations
  const usersRelations = relations(usersTable, ({ one }) => ({
    profile: one(profilesTable, {
      fields: [usersTable.id],
      references: [profilesTable.userId],
    }),
  }));

  const profilesRelations = relations(profilesTable, ({ one }) => ({
    user: one(usersTable, {
      fields: [profilesTable.userId],
      references: [usersTable.id],
    }),
  }));

  describe('filterTablesFromSchema runtime function', () => {
    it('should filter out relations and keep only tables', () => {
      const schemaWithRelations = {
        users: usersTable,
        profiles: profilesTable,
        usersRelations,
        profilesRelations,
      };

      const filtered = filterTablesFromSchema(schemaWithRelations);

      // Should only contain tables, not relations
      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('profiles');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('profilesRelations');
      expect(Object.keys(filtered)).toHaveLength(2);
    });

    it('should handle schema with only tables', () => {
      const schemaWithOnlyTables = {
        users: usersTable,
        profiles: profilesTable,
      };

      const filtered = filterTablesFromSchema(schemaWithOnlyTables);

      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('profiles');
      expect(Object.keys(filtered)).toHaveLength(2);
    });

    it('should handle schema with only relations', () => {
      const schemaWithOnlyRelations = {
        usersRelations,
        profilesRelations,
      };

      const filtered = filterTablesFromSchema(schemaWithOnlyRelations);

      // Should return empty object since there are no tables
      expect(Object.keys(filtered)).toHaveLength(0);
    });

    it('should handle empty schema', () => {
      const emptySchema = {};

      const filtered = filterTablesFromSchema(emptySchema);

      expect(Object.keys(filtered)).toHaveLength(0);
    });

    it('should handle schema with mixed valid and invalid entries', () => {
      const mixedSchema = {
        users: usersTable,
        invalidEntry: null,
        anotherInvalid: 'not an object',
        profiles: profilesTable,
        usersRelations,
      };

      const filtered = filterTablesFromSchema(mixedSchema);

      // Should only contain valid tables
      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('profiles');
      expect(filtered).not.toHaveProperty('invalidEntry');
      expect(filtered).not.toHaveProperty('anotherInvalid');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(Object.keys(filtered)).toHaveLength(2);
    });
  });

  describe('FilterTablesFromSchema type', () => {
    it('should filter relation types from schema type', () => {
      const schemaWithRelations = {
        users: usersTable,
        profiles: profilesTable,
        usersRelations,
        profilesRelations,
      };

      // Type-level test: FilterTablesFromSchema should exclude relations
      type FilteredSchema = FilterTablesFromSchema<typeof schemaWithRelations>;

      // These should compile without errors, indicating the type works correctly
      const _test1: FilteredSchema = {
        users: usersTable,
        profiles: profilesTable,
      };

      // This should cause a type error if uncommented (relations should be excluded)
      // const _test2: FilteredSchema = {
      //   users: usersTable,
      //   profiles: profilesTable,
      //   usersRelations, // Should cause type error
      // };

      expect(_test1).toBeDefined();
      expect(_test1.users).toBe(usersTable);
      expect(_test1.profiles).toBe(profilesTable);
    });

    it('should preserve all properties when schema has no relations', () => {
      const schemaWithoutRelations = {
        users: usersTable,
        profiles: profilesTable,
      };

      type FilteredSchema = FilterTablesFromSchema<typeof schemaWithoutRelations>;

      const _test: FilteredSchema = schemaWithoutRelations;

      expect(_test).toBeDefined();
      expect(_test.users).toBe(usersTable);
      expect(_test.profiles).toBe(profilesTable);
    });
  });

  describe('ExtractSchemaFromDB type', () => {
    it('should extract and filter schema from PostgresJsDatabase type', () => {
      // Create a mock database type with schema including relations
      const schemaWithRelations = {
        users: usersTable,
        profiles: profilesTable,
        usersRelations,
        profilesRelations,
      };

      // Simulate a PostgresJsDatabase type
      type MockDB = PostgresJsDatabase<typeof schemaWithRelations>;
      type ExtractedSchema = ExtractSchemaFromDB<MockDB>;

      // The extracted schema should only contain tables, not relations
      const _test: ExtractedSchema = {
        users: usersTable,
        profiles: profilesTable,
      };

      expect(_test).toBeDefined();
      expect(_test.users).toBe(usersTable);
      expect(_test.profiles).toBe(profilesTable);
    });
  });
});
