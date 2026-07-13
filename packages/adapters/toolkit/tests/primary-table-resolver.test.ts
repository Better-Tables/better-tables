import { describe, expect, it } from 'bun:test';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PrimaryTableResolver } from '../src/primary-table-resolver';
import type { RelationshipMap } from '../src/types';
import { SchemaError } from '../src/types';

/**
 * Primary Table Resolver Tests
 *
 * Tests for the PrimaryTableResolver class that handles primary table determination
 * with explicit specification and improved heuristics.
 */
describe('PrimaryTableResolver', () => {
  // Create test schemas
  const surveysTable = pgTable('surveys', {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    status: text('status'),
    survey: jsonb('survey'), // Contains nested { title: string }
    totalResponses: integer('total_responses'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  });

  const assignmentsTable = pgTable('assignments', {
    id: uuid('id').primaryKey(),
    title: text('title').notNull(), // Has a 'title' field
    description: text('description'),
    status: text('status'),
    createdAt: timestamp('created_at'),
  });

  const usersTable = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    age: integer('age'),
  });

  const schema = {
    surveys: surveysTable,
    assignments: assignmentsTable,
    users: usersTable,
  };

  const relationships = {};

  describe('Explicit Primary Table', () => {
    it('should use explicit primary table when provided', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      const primaryTable = resolver.resolve(['title', 'slug'], 'surveys');

      expect(primaryTable).toBe('surveys');
    });

    it('should use explicit primary table even when columns match other tables', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // 'title' exists in assignments, but we explicitly want surveys
      const primaryTable = resolver.resolve(['title', 'slug'], 'surveys');

      expect(primaryTable).toBe('surveys');
    });

    it('should throw error if explicit primary table does not exist', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);

      expect(() => {
        resolver.resolve(['title', 'slug'], 'nonexistent');
      }).toThrow(SchemaError);
    });
  });

  describe('Automatic Determination - Direct Columns', () => {
    it('should select table with most matching direct columns', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // 'slug' and 'status' match surveys, 'title' matches assignments
      // surveys should win with 2 matches
      const primaryTable = resolver.resolve(['slug', 'status', 'title']);

      expect(primaryTable).toBe('surveys');
    });

    it('should select table when all columns match', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      const primaryTable = resolver.resolve(['id', 'slug', 'status']);

      expect(primaryTable).toBe('surveys');
    });

    it('should handle single column correctly', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      const primaryTable = resolver.resolve(['slug']);

      expect(primaryTable).toBe('surveys');
    });
  });

  describe('Automatic Determination - JSONB Accessor Columns', () => {
    it('should prefer table with most direct column matches when accessor columns present', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // 'title' doesn't match surveys directly (it's in JSONB), but 'slug' and 'status' do
      // surveys should win with 2 direct matches
      const primaryTable = resolver.resolve(['title', 'slug', 'status']);

      expect(primaryTable).toBe('surveys');
    });

    it('should select table when column matches even if intended for accessor', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // 'title' matches assignments table directly
      // Even if it's intended to be from JSONB accessor, resolver will find the direct match
      const primaryTable = resolver.resolve(['title']);

      expect(primaryTable).toBe('assignments'); // Has direct 'title' column
    });

    it('should fallback to first table when no columns match any table', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // Column that doesn't exist in any table
      const primaryTable = resolver.resolve(['nonexistentColumn']);

      expect(primaryTable).toBe('surveys'); // First table in schema (fallback)
    });

    it('should handle mixed direct and accessor columns correctly', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // 'slug' is direct, 'title' is accessor-based
      // Should prefer surveys because it has 'slug'
      const primaryTable = resolver.resolve(['title', 'slug']);

      expect(primaryTable).toBe('surveys');
    });
  });

  describe('Automatic Determination - Ambiguous Scenarios', () => {
    it('should handle columns matching multiple tables', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // 'status' exists in both surveys and assignments
      // Should prefer the one with more matches
      const primaryTable = resolver.resolve(['status', 'slug']); // slug only in surveys

      expect(primaryTable).toBe('surveys');
    });

    it('should handle tie-breaking when multiple tables have same match count', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // Both surveys and assignments have 'status'
      // If only 'status' is provided, should fallback to first table
      const primaryTable = resolver.resolve(['status']);

      // Should fallback to first table when ambiguous
      expect(['surveys', 'assignments']).toContain(primaryTable);
    });
  });

  describe('Relationship Columns', () => {
    it('should handle relationship columns correctly', () => {
      const relationshipsWithRel: RelationshipMap = {
        'surveys.profile': {
          from: 'surveys',
          to: 'users',
          foreignKey: 'id',
          localKey: 'userId',
          cardinality: 'one' as const,
        },
      };

      const resolver = new PrimaryTableResolver(schema, relationshipsWithRel);
      // 'profile.email' should count towards surveys (source table)
      const primaryTable = resolver.resolve(['slug', 'profile.email']);

      expect(primaryTable).toBe('surveys');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty columns array', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      const primaryTable = resolver.resolve([]);

      expect(primaryTable).toBe('surveys'); // First table
    });

    it('should handle undefined columns', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      const primaryTable = resolver.resolve(undefined);

      expect(primaryTable).toBe('surveys'); // First table
    });

    it('should throw error if schema is empty', () => {
      const resolver = new PrimaryTableResolver({}, {});

      expect(() => {
        resolver.resolve(['title']);
      }).toThrow(SchemaError);
    });

    it('should handle columns with empty strings', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // Should skip empty strings and still work
      const primaryTable = resolver.resolve(['slug', '', 'status']);

      expect(primaryTable).toBe('surveys');
    });
  });

  describe('Real-world Scenario from Issue #29', () => {
    it('should correctly identify surveys table when title is JSONB accessor', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // Scenario: 'title' is accessed via accessor from survey.survey.title (JSONB)
      // 'slug' is a direct column in surveys
      // Should select surveys, not assignments (which has direct 'title')
      const primaryTable = resolver.resolve(['title', 'slug']);

      expect(primaryTable).toBe('surveys');
    });

    it('should work with explicit primaryTable for JSONB columns', () => {
      const resolver = new PrimaryTableResolver(schema, relationships);
      // Explicit specification solves the ambiguity
      const primaryTable = resolver.resolve(['title', 'slug'], 'surveys');

      expect(primaryTable).toBe('surveys');
    });
  });
});
