/**
 * Plan 020 review follow-up: reconcile phase-2 row order with phase-1 key
 * order in the two-phase fan-out pagination path (`buildFanOutPaginatedDataQuery`
 * / `FanOutPaginatedQuery` in `base-query-builder.ts`).
 *
 * Phase 1 selects the page of primary keys via `GROUP BY pk, ORDER BY
 * MIN/MAX(sortColumn) [, pk asc]`. Phase 2 re-fetches every joined row for
 * exactly those keys and re-applies plain `applySorting` on the raw
 * (non-aggregated) sort columns, with no primary-key tiebreaker and no
 * awareness of phase 1's key order. The final primary-row order returned to
 * callers is the first-seen order of primary keys in the flat phase-2
 * result (`DataTransformer.groupByMainTableKey`), which can silently
 * disagree with phase 1's authoritative page order in three ways:
 *
 *  1. Multi-column sorts over fan-out columns: aggregating MIN/MAX per
 *     sort column (phase 1) is not equivalent to sorting raw per-row values
 *     (phase 2), so intra-page order can contradict cross-page order.
 *  2. Sort-value ties: phase 1 tiebreaks by `pk asc`; phase 2 has no
 *     tiebreaker at all, so tied rows come out in a nondeterministic
 *     (SQLite: e.g. join/scan-order-dependent) sequence.
 *  3. Empty `sorting`: phase 1 falls back to `ORDER BY pk asc`; phase 2 has
 *     no `ORDER BY` at all.
 *
 * The fix makes phase 1's key array authoritative: after phase 2 returns,
 * `FanOutPaginatedQuery.execute()` reorders the flat rows (stable sort) so
 * that grouping by primary key (first-seen order) reproduces phase 1's key
 * order exactly, regardless of what phase 2's own `ORDER BY` produced.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { UserWithRelations } from './helpers';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('fan-out pagination: phase-2 order reconciled with phase-1 key order', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    testDb = db;
    sqlite = sqliteDb;
    await setupTestDatabase(db);
    adapter = createTestAdapter(testDb);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  describe('multi-column sort over a fan-out column', () => {
    beforeEach(async () => {
      // Fixture (plan 020 review repro):
      //   John (1): posts (published=0,title='e'), (published=1,title='z')
      //   Jane (2): posts (published=0,title='m')
      //   Bob  (3): no posts (NULLs from LEFT JOIN)
      // Sort: posts.published asc, posts.title desc.
      // Phase 1 aggregates: Bob (NULL first asc), John (MAX title 'z'),
      // Jane (MAX title 'm') -> Bob, John, Jane.
      // Unfixed phase 2 (raw row order, no pk tiebreaker) would yield the
      // first-seen order Bob, Jane, John instead -- contradicting phase 1.
      await testDb.run('DELETE FROM comments;');
      await testDb.run('DELETE FROM posts;');
      await testDb.run(`
        INSERT INTO posts (id, user_id, title, content, published) VALUES
          (1, 1, 'e', 'c', 0),
          (2, 1, 'z', 'c', 1),
          (3, 2, 'm', 'c', 0);
      `);
    });

    const sorting = [
      { columnId: 'posts.published', direction: 'asc' as const },
      { columnId: 'posts.title', direction: 'desc' as const },
    ];

    it('single-page order equals the page-by-page (limit 1) walk order', async () => {
      const onePage = await adapter.fetchData({
        columns: ['id', 'name', 'posts.title'],
        sorting,
        pagination: { page: 1, limit: 3 },
      });
      const singlePageOrder = (onePage.data as UserWithRelations[]).map((r) => r.name);

      const paged: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await adapter.fetchData({
          columns: ['id', 'name', 'posts.title'],
          sorting,
          pagination: { page, limit: 1 },
        });
        for (const row of res.data as UserWithRelations[]) paged.push(row.name);
      }

      expect(singlePageOrder).toEqual(paged);
      // Phase 1's own aggregate ordering is the ground truth: Bob (NULL
      // sorts first), John (max title 'z'), Jane (max title 'm').
      expect(singlePageOrder).toEqual(['Bob Johnson', 'John Doe', 'Jane Smith']);
    });
  });

  describe('sort-value ties', () => {
    beforeEach(async () => {
      // All three users' posts share the same (published, title) values, so
      // every primary key ties on the requested sort. Phase 1 breaks the
      // tie with `pk asc`; phase 2 must now agree instead of falling back
      // to whatever order the flat join happens to produce.
      await testDb.run('DELETE FROM comments;');
      await testDb.run('DELETE FROM posts;');
      await testDb.run(`
        INSERT INTO posts (id, user_id, title, content, published) VALUES
          (1, 3, 'same', 'c', 1),
          (2, 1, 'same', 'c', 1),
          (3, 2, 'same', 'c', 1);
      `);
    });

    const sorting = [{ columnId: 'posts.published', direction: 'desc' as const }];

    it('ties resolve deterministically by primary key, identically across page sizes', async () => {
      const singlePage = await adapter.fetchData({
        columns: ['id', 'name'],
        sorting,
        pagination: { page: 1, limit: 3 },
      });
      const singlePageOrder = (singlePage.data as UserWithRelations[]).map((r) => r.name);

      // Deterministic pk-asc tiebreak: user 1 (John), 2 (Jane), 3 (Bob).
      expect(singlePageOrder).toEqual(['John Doe', 'Jane Smith', 'Bob Johnson']);

      const paged: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await adapter.fetchData({
          columns: ['id', 'name'],
          sorting,
          pagination: { page, limit: 1 },
        });
        for (const row of res.data as UserWithRelations[]) paged.push(row.name);
      }
      expect(paged).toEqual(singlePageOrder);

      // Re-running with a different page size must be stable, not just
      // "some" deterministic order.
      const twoPerPage: string[] = [];
      for (let page = 1; page <= 2; page++) {
        const res = await adapter.fetchData({
          columns: ['id', 'name'],
          sorting,
          pagination: { page, limit: 2 },
        });
        for (const row of res.data as UserWithRelations[]) twoPerPage.push(row.name);
      }
      expect(twoPerPage).toEqual(singlePageOrder);
    });
  });

  describe('empty sorting', () => {
    beforeEach(async () => {
      await testDb.run('DELETE FROM comments;');
      await testDb.run('DELETE FROM posts;');
      await testDb.run(`
        INSERT INTO posts (id, user_id, title, content, published) VALUES
          (1, 3, 'a', 'c', 0),
          (2, 1, 'b', 'c', 1),
          (3, 2, 'c', 'c', 0);
      `);
    });

    it('order equals phase-1 primary-key order (pk asc) and is stable across page sizes', async () => {
      const singlePage = await adapter.fetchData({
        columns: ['id', 'name', 'posts.title'],
        sorting: [],
        pagination: { page: 1, limit: 3 },
      });
      const singlePageOrder = (singlePage.data as UserWithRelations[]).map((r) => r.name);

      // No sorting requested -> phase 1 falls back to `ORDER BY pk asc`:
      // user 1 (John), 2 (Jane), 3 (Bob).
      expect(singlePageOrder).toEqual(['John Doe', 'Jane Smith', 'Bob Johnson']);

      const paged: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await adapter.fetchData({
          columns: ['id', 'name', 'posts.title'],
          sorting: [],
          pagination: { page, limit: 1 },
        });
        for (const row of res.data as UserWithRelations[]) paged.push(row.name);
      }
      expect(paged).toEqual(singlePageOrder);
    });
  });
});
