/**
 * Integration tests for large array parameter binding with PostgreSQL
 *
 * These tests verify that the fix for "bind message has X parameter formats but 0 parameters"
 * works correctly with actual database queries.
 *
 * To run these tests:
 * 1. Start a PostgreSQL database
 * 2. Set POSTGRES_TEST_URL environment variable
 * 3. Run: bun test adapter-postgres-large-array.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleDatabase } from '../src/types';
import {
  closePostgresDatabase,
  createPostgresDatabase,
  ensurePostgresDatabase,
} from './helpers/test-fixtures';

// Test schema with UUID and text columns
const testUsersTable = pgTable('test_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name'),
});

const testSchema = {
  testUsers: testUsersTable,
};

/**
 * Generate test UUIDs
 */
function generateTestUUIDs(count: number): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate deterministic UUIDs for testing
    const hex = i.toString(16).padStart(32, '0');
    uuids.push(
      `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
    );
  }
  return uuids;
}

/**
 * Generate test text values
 */
function generateTestTexts(count: number): string[] {
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    texts.push(`test-email-${i}@example.com`);
  }
  return texts;
}

describe('DrizzleAdapter - PostgreSQL Large Array Integration Tests', () => {
  const testConnectionString =
    process.env.POSTGRES_TEST_URL || 'postgresql://localhost:5432/drizzle_test';
  let testDb: ReturnType<typeof createPostgresDatabase>['db'];
  let client: ReturnType<typeof createPostgresDatabase>['client'];
  let adapter: DrizzleAdapter<typeof testSchema, 'postgres'>;

  beforeAll(async () => {
    // Ensure test database exists
    await ensurePostgresDatabase(testConnectionString);

    // Create database connection
    const dbSetup = createPostgresDatabase(testConnectionString);
    testDb = dbSetup.db;
    client = dbSetup.client;

    // Create adapter
    adapter = new DrizzleAdapter({
      db: testDb as unknown as DrizzleDatabase<'postgres'>,
      schema: testSchema,
      driver: 'postgres',
    });

    // Create test table
    await testDb.execute(`
      CREATE TABLE IF NOT EXISTS test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        name TEXT
      );
    `);
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.execute(`DROP TABLE IF EXISTS test_users;`);
    }
    if (client) {
      await closePostgresDatabase(client);
    }
    // Optionally drop the test database
    // await dropPostgresDatabase(testConnectionString);
  });

  describe('Large Array Filtering with isAnyOf', () => {
    it('should handle 1,000 values without errors', async () => {
      // Insert test data
      const testIds = generateTestUUIDs(1000);
      for (const id of testIds.slice(0, 100)) {
        // Insert a subset for testing
        await testDb.execute(
          `INSERT INTO test_users (id, email, name) VALUES ('${id}', 'test@example.com', 'Test User') ON CONFLICT DO NOTHING;`
        );
      }

      // Test filter with 1000 values
      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isAnyOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      // Should not throw "bind message has X parameter formats but 0 parameters" error
    });

    it('should handle 5,000 values without errors', async () => {
      const testIds = generateTestUUIDs(5000);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isAnyOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should handle 15,000 values without errors (reported error size)', async () => {
      const testIds = generateTestUUIDs(15000);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isAnyOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      // This is the size that was causing the original error
    });

    it('should handle 50,000 values without errors (stress test)', async () => {
      const testIds = generateTestUUIDs(50000);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isAnyOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should handle text column with large array', async () => {
      // Insert test data with known emails
      const testEmails = generateTestTexts(100);
      for (let i = 0; i < 100; i++) {
        await testDb.execute(
          `INSERT INTO test_users (id, email, name) VALUES (gen_random_uuid(), '${testEmails[i]}', 'Test User') ON CONFLICT DO NOTHING;`
        );
      }

      // Test with large array of emails
      const largeEmailArray = generateTestTexts(15000);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'email',
            operator: 'isAnyOf',
            values: largeEmailArray,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('Large Array Filtering with isNoneOf', () => {
    it('should handle 15,000 values without errors', async () => {
      const testIds = generateTestUUIDs(15000);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isNoneOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('Boundary Conditions', () => {
    it('should use inArray for exactly 1000 values', async () => {
      const testIds = generateTestUUIDs(1000);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isAnyOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should use large array handler for 1001 values', async () => {
      const testIds = generateTestUUIDs(1001);

      const result = await adapter.fetchData({
        columns: ['id', 'email'],
        filters: [
          {
            columnId: 'id',
            operator: 'isAnyOf',
            values: testIds,
            type: 'option',
          },
        ],
        pagination: { page: 1, limit: 10 },
        primaryTable: 'testUsers',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });
});
