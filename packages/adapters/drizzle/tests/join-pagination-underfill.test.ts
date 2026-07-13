/**
 * Plan 020 (ADAPTER-03): fix page under-fill on one-to-many joins.
 *
 * `buildCountQuery` has counted `DISTINCT` primary keys since plan 003, but
 * until this plan the *data* query still applied LIMIT/OFFSET to the
 * row-multiplied flat join result. Under a one-to-many join, a "page of
 * `limit`" flat rows can be fewer than `limit` distinct primary rows (or,
 * worse, a single primary row's related rows split across two pages,
 * silently truncating its nested array). These tests build a SKEWED
 * fixture -- one user with many more posts than the others -- specifically
 * to make that truncation observable, then assert the invariant plan 020
 * restores: for every page, `rows.length === min(limit, total - offset)`,
 * no primary row is duplicated across pages, every nested array is
 * complete (never split across a page boundary), and the union of all
 * pages' primary keys equals the full filtered set.
 *
 * Fixture (`setupTestDatabase` plus extra posts added below):
 *   users:  1 John Doe    (age 30) -- 6 posts (ids 1,2,4,5,6,7)
 *           2 Jane Smith  (age 25) -- 1 post  (id 3)
 *           3 Bob Johnson (age 35) -- 0 posts
 * Sorting by `name` descending therefore orders the flat join rows as:
 * John's 6 rows, then Jane's 1 row, then Bob's 1 (null-post) row -- the
 * worst case for a naive flat-query LIMIT/OFFSET, since a `limit: 2`
 * page-1 query would otherwise return only 2 of John's 6 post rows and
 * never reach Jane or Bob at all.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { UserWithRelations } from './helpers';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('DrizzleAdapter - fan-out join pagination (plan 020, ADAPTER-03)', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    testDb = db;
    sqlite = sqliteDb;

    await setupTestDatabase(db);

    // Skew: give John Doe (user 1) four more posts on top of the fixture's
    // two, so he has 6 total -- far more than Jane's 1 or Bob's 0.
    await testDb.run(`
      INSERT INTO posts (id, user_id, title, content, published) VALUES
        (4, 1, 'Third Post', 'Content 4', 1),
        (5, 1, 'Fourth Post', 'Content 5', 0),
        (6, 1, 'Fifth Post', 'Content 6', 1),
        (7, 1, 'Sixth Post', 'Content 7', 0);
    `);

    adapter = createTestAdapter(testDb);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('sanity: the skewed fixture has the expected per-user post counts', async () => {
    const full = await adapter.fetchData({ columns: ['name', 'posts.title'] });
    expect(full.total).toBe(3);

    const byName = new Map(
      (full.data as UserWithRelations[]).map((u) => [u.name, u.posts?.length ?? 0])
    );
    expect(byName.get('John Doe')).toBe(6);
    expect(byName.get('Jane Smith')).toBe(1);
    expect(byName.get('Bob Johnson')).toBe(0);
  });

  it("page 1 fills to the full limit and never truncates a fanned-out user's posts", async () => {
    const page1 = await adapter.fetchData({
      columns: ['name', 'posts.title'],
      sorting: [{ columnId: 'name', direction: 'desc' }],
      pagination: { page: 1, limit: 2 },
    });

    expect(page1.total).toBe(3);
    // min(limit, total - offset) = min(2, 3 - 0) = 2
    expect(page1.data).toHaveLength(2);

    const john = (page1.data as UserWithRelations[]).find((u) => u.name === 'John Doe');
    expect(john).toBeDefined();
    // The core regression check: John's full 6-post set must be present on
    // whichever page he lands on, never split/truncated by LIMIT/OFFSET
    // operating on the row-multiplied flat join result.
    expect(john?.posts).toHaveLength(6);

    const jane = (page1.data as UserWithRelations[]).find((u) => u.name === 'Jane Smith');
    expect(jane).toBeDefined();
    expect(jane?.posts).toHaveLength(1);
  });

  it('page 2 correctness: offset lands on the remaining under-filled page with the right count', async () => {
    const page2 = await adapter.fetchData({
      columns: ['name', 'posts.title'],
      sorting: [{ columnId: 'name', direction: 'desc' }],
      pagination: { page: 2, limit: 2 },
    });

    expect(page2.total).toBe(3);
    // min(limit, total - offset) = min(2, 3 - 2) = 1
    expect(page2.data).toHaveLength(1);

    const bob = page2.data[0] as UserWithRelations;
    expect(bob.name).toBe('Bob Johnson');
    expect(bob.posts).toHaveLength(0);
  });

  it('empty page past the end returns no rows and issues no empty IN () query', async () => {
    const page3 = await adapter.fetchData({
      columns: ['name', 'posts.title'],
      sorting: [{ columnId: 'name', direction: 'desc' }],
      pagination: { page: 3, limit: 2 },
    });

    expect(page3.total).toBe(3);
    expect(page3.data).toHaveLength(0);
  });

  it('sort by a joined column: page fill holds and every nested array stays complete', async () => {
    const full = await adapter.fetchData({ columns: ['id', 'name', 'posts.title'] });
    const fullIds = new Set((full.data as Array<{ id: number }>).map((r) => r.id));
    const postCountById = new Map(
      (full.data as UserWithRelations[]).map((u) => [
        (u as unknown as { id: number }).id,
        u.posts?.length ?? 0,
      ])
    );

    const seenIds = new Set<number>();
    let page = 1;
    let hasNext = true;
    while (hasNext) {
      const pageResult = await adapter.fetchData({
        columns: ['id', 'name', 'posts.title'],
        sorting: [{ columnId: 'posts.title', direction: 'asc' }],
        pagination: { page, limit: 2 },
      });

      expect(pageResult.total).toBe(full.total);
      const expectedLength = Math.min(2, full.total - (page - 1) * 2);
      expect(pageResult.data).toHaveLength(expectedLength);

      for (const row of pageResult.data as UserWithRelations[]) {
        const id = (row as unknown as { id: number }).id;
        // No primary row duplicated across pages.
        expect(seenIds.has(id)).toBe(false);
        seenIds.add(id);
        // Every nested posts array is complete on whichever page it lands,
        // never split by the fan-out join's LIMIT/OFFSET.
        expect(row.posts).toHaveLength(postCountById.get(id) ?? -1);
      }

      hasNext = pageResult.pagination?.hasNext ?? false;
      page += 1;
    }

    // The union of all pages' primary keys equals the full filtered set.
    expect(seenIds).toEqual(fullIds);
  });

  it('count/data agreement: walking every page collects exactly `total` distinct users', async () => {
    const seenIds = new Set<number>();
    let page = 1;
    let hasNext = true;
    let total = -1;

    while (hasNext) {
      const pageResult = await adapter.fetchData({
        columns: ['id', 'name'],
        sorting: [{ columnId: 'name', direction: 'desc' }],
        pagination: { page, limit: 2 },
      });

      total = pageResult.total;
      for (const row of pageResult.data as Array<{ id: number }>) {
        seenIds.add(row.id);
      }
      hasNext = pageResult.pagination?.hasNext ?? false;
      page += 1;
    }

    expect(total).toBe(3);
    expect(seenIds.size).toBe(total);
  });

  it('no-fan-out control: a many-to-one join (profile) keeps the single-query path and still paginates correctly', async () => {
    // users -> profile is one-to-one (cardinality 'one'); the fan-out gate
    // (see base-query-builder.test.ts's dedicated gate tests) reports false
    // for it, so this exercises the untouched, pre-existing single-query
    // pagination path end-to-end -- a page never contains more or fewer
    // than min(limit, total - offset) distinct users even though it's a
    // join, because a many-to-one join never row-multiplies.
    const page1 = await adapter.fetchData({
      columns: ['name', 'profile.bio'],
      sorting: [{ columnId: 'name', direction: 'asc' }],
      pagination: { page: 1, limit: 2 },
    });

    expect(page1.total).toBe(3);
    expect(page1.data).toHaveLength(2);
    expect((page1.data[0] as UserWithRelations).name).toBe('Bob Johnson');
    expect((page1.data[1] as UserWithRelations).name).toBe('Jane Smith');

    const page2 = await adapter.fetchData({
      columns: ['name', 'profile.bio'],
      sorting: [{ columnId: 'name', direction: 'asc' }],
      pagination: { page: 2, limit: 2 },
    });

    expect(page2.data).toHaveLength(1);
    expect((page2.data[0] as UserWithRelations).name).toBe('John Doe');
  });
});
