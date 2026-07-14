/**
 * Row-set tests for auto-embedding relations referenced only in
 * filters/sorting (plan 030, finding 10 -- maintainer decision: auto-embed,
 * not warn-only).
 *
 * Before this fix, `buildSelectQuery` (base-query-builder.ts) drove
 * projection ONLY from `columns`, even though `RelationshipManager.buildQueryContext`
 * already knew about every relation a filter or sort touched (it plans the
 * JOIN for the WHERE/ORDER BY). Filtering by `profile.bio` with `profile`
 * not in `columns` therefore joined `profiles` to evaluate the filter, but
 * never selected or nested it -- the filter narrowed the result set
 * correctly, yet the matching relation data silently vanished from the
 * response.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('DrizzleAdapter - auto-embed relations referenced only in filters/sorting', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: Database;

  beforeEach(async () => {
    const created = createTestDatabase();
    testDb = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(testDb);
    adapter = createTestAdapter(testDb);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('filtering by a to-one relation column not in `columns` still embeds that relation in every row', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['name'],
      filters: [
        { columnId: 'profile.bio', operator: 'contains', values: ['developer'], type: 'text' },
      ],
    });

    expect(result.data.length).toBeGreaterThan(0);
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row).toHaveProperty('name');
      expect(row.profile).toBeDefined();
      expect(row.profile).not.toBeNull();
      expect((row.profile as { bio: string }).bio).toContain('developer');
    }

    // A relation neither filtered, sorted, nor selected (posts, comments)
    // must stay absent -- no over-fetch of the world.
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty('posts');
      expect(row).not.toHaveProperty('comments');
    }
  });

  it('sorting by a to-one relation column not in `columns` still embeds that relation in every row', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['name'],
      sorting: [{ columnId: 'profile.bio', direction: 'asc' }],
    });

    expect(result.data.length).toBeGreaterThan(0);
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty('posts');
    }
  });

  it('a relation already explicitly requested via `columns` is unaffected (same code path, no duplicate embedding)', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['name', 'profile.bio'],
      filters: [
        { columnId: 'profile.bio', operator: 'contains', values: ['developer'], type: 'text' },
      ],
    });

    expect(result.data.length).toBeGreaterThan(0);
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row.profile).toBeDefined();
    }
  });

  it('no filter/sort on any relation -- no relation is embedded (baseline, unchanged)', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['name'],
    });

    expect(result.data.length).toBeGreaterThan(0);
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty('profile');
      expect(row).not.toHaveProperty('posts');
    }
  });

  it('filtering by a one-to-many relation column not in `columns` embeds the related rows', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['name'],
      filters: [{ columnId: 'posts.title', operator: 'contains', values: ['Post'], type: 'text' }],
    });

    expect(result.data.length).toBeGreaterThan(0);
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row.posts).toBeDefined();
      expect(Array.isArray(row.posts)).toBe(true);
      const posts = row.posts as Array<{ published: unknown; title: unknown }>;
      expect(posts.length).toBeGreaterThan(0);
      // Full related row, not just the filtered field -- matches what an
      // explicit `columns: ['posts.title']` request would already embed.
      for (const post of posts) {
        expect(post.title).toBeDefined();
      }
    }
  });
});
