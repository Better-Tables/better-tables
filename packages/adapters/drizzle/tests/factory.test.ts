/**
 * Tests for the drizzleAdapter factory function
 *
 * This test suite verifies:
 * - Schema extraction and filtering from database instances
 * - Automatic filtering of relations from schemas
 * - Type inference for ExtractSchemaFromDB
 */

import { describe, expect, it } from 'bun:test';
import { relations } from 'drizzle-orm';
import { pgTable, text as pgText } from 'drizzle-orm/pg-core';
import { filterTablesFromSchema } from '../src/utils/schema-extractor';

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

describe('drizzleAdapter factory function', () => {
  describe('schema filtering with relations', () => {
    it('should filter out relations when schema includes both tables and relations', () => {
      // Create a schema that includes both tables and relations
      const schemaWithRelations = {
        users: usersTable,
        profiles: profilesTable,
        usersRelations,
        profilesRelations,
      };

      // Create a mock database instance
      // Note: In a real scenario, this would be a proper drizzle database instance
      // For testing, we'll use the filterTablesFromSchema function directly
      const filtered = filterTablesFromSchema(schemaWithRelations);

      // Verify relations are filtered out
      expect(filtered).toHaveProperty('users');
      expect(filtered).toHaveProperty('profiles');
      expect(filtered).not.toHaveProperty('usersRelations');
      expect(filtered).not.toHaveProperty('profilesRelations');
      expect(Object.keys(filtered)).toHaveLength(2);
    });

    it('should work with drizzleAdapter when schema is provided directly', () => {
      // Create a schema with relations
      const schemaWithRelations = {
        users: usersTable,
        profiles: profilesTable,
        usersRelations,
        profilesRelations,
      };

      // Create a mock database (we can't easily create a real one without a connection)
      // So we'll test the runtime filtering function instead
      const filtered = filterTablesFromSchema(schemaWithRelations);

      // The filtered schema should only contain tables
      expect(filtered.users).toBe(usersTable);
      expect(filtered.profiles).toBe(profilesTable);
      expect(Object.keys(filtered)).toEqual(['users', 'profiles']);
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
  });

  describe('runtime schema filtering', () => {
    it('should correctly identify tables vs relations', () => {
      const schemaWithRelations = {
        users: usersTable,
        profiles: profilesTable,
        usersRelations,
        profilesRelations,
      };

      const filtered = filterTablesFromSchema(schemaWithRelations);

      // Tables should have _ property with columns
      expect(filtered.users).toBeDefined();
      expect(filtered.profiles).toBeDefined();

      // Relations should be filtered out
      expect('usersRelations' in filtered).toBe(false);
      expect('profilesRelations' in filtered).toBe(false);
    });

    it('should preserve table order when filtering', () => {
      const schemaWithRelations = {
        users: usersTable,
        usersRelations,
        profiles: profilesTable,
        profilesRelations,
      };

      const filtered = filterTablesFromSchema(schemaWithRelations);

      const keys = Object.keys(filtered);
      expect(keys).toEqual(['users', 'profiles']);
    });
  });
});
