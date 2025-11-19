/**
 * SQLite Integration Tests for DrizzleAdapter
 *
 * These tests verify the full integration of the DrizzleAdapter with SQLite,
 * including CRUD operations, filtering, sorting, pagination, and relationship handling.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterOperator } from '@better-tables/core';
import type { UserWithRelations } from './helpers';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('DrizzleAdapter - SQLite Integration', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    sqlite = sqliteDb;

    await setupTestDatabase(db);
    adapter = createTestAdapter(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  describe('Basic CRUD Operations', () => {
    it('should fetch data without filters', async () => {
      const result = await adapter.fetchData({});

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('email');
    });

    it('should apply pagination', async () => {
      const result = await adapter.fetchData({
        pagination: { page: 1, limit: 2 },
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination?.hasNext).toBe(true);
      expect(result.pagination?.hasPrev).toBe(false);
    });

    it('should apply sorting', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'desc' }],
      });

      expect((result.data[0] as UserWithRelations).age).toBe(35);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(25);
    });
  });

  describe('Filtering Operations', () => {
    it('should filter by text contains', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'contains',
            values: ['John'],
          },
        ],
      });

      expect(result.data).toHaveLength(2);
      const names = result.data.map((r: UserWithRelations) => r.name).sort();
      expect(names).toContain('John Doe');
      expect(names).toContain('Bob Johnson');
    });

    it('should filter by number greater than', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'age',
            type: 'number',
            operator: 'greaterThan',
            values: [25],
          },
        ],
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((u: UserWithRelations) => (u.age ?? 0) > 25)).toBe(true);
    });

    it('should filter by text equals', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'equals',
            values: ['John Doe'],
          },
        ],
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by number between', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'age',
            type: 'number',
            operator: 'between',
            values: [25, 30],
          },
        ],
      });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Relationship Handling', () => {
    it('should fetch data with one-to-one relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'profile.bio'],
      });

      expect(result.data).toHaveLength(3);
      expect(result.data[0] as UserWithRelations).toHaveProperty('profile');
      expect((result.data[0] as UserWithRelations).profile).toHaveProperty('bio');
    });

    it('should fetch data with one-to-many relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'posts.title'],
      });

      expect(result.data).toHaveLength(3);
      expect(result.data[0] as UserWithRelations).toHaveProperty('posts');
      expect(Array.isArray((result.data[0] as UserWithRelations).posts)).toBe(true);
    });

    it('should filter across relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        filters: [
          {
            columnId: 'profile.bio',
            type: 'text',
            operator: 'contains',
            values: ['developer'],
          },
        ],
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid column IDs', async () => {
      await expect(
        adapter.fetchData({
          columns: ['invalid.column'],
        })
      ).rejects.toThrow();
    });

    it('should handle invalid filter operators gracefully', async () => {
      // The adapter may handle invalid operators gracefully or ignore them
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'invalidOperator' as FilterOperator,
            values: ['test'],
          },
        ],
      });
      // Should return results without crashing
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});
