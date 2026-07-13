/**
 * Filter-group rejection tests (plan 016 Step 2b, design
 * `plans/design/core-contract-v2.md` §1.5).
 *
 * Contract v2 widened `FetchDataParams.filters` to
 * `FilterState[] | FilterGroupNode`, but this adapter does not translate
 * AND/OR group trees yet. Per §1.5 it must REJECT a group loudly (silently
 * flattening OR into AND would return a wrong, narrower result set with no
 * signal) and advertise the limitation via
 * `meta.supportsFilterGroups: false`.
 *
 * Plan 017 (Drizzle group translation) is expected to FLIP these tests when
 * the recursive `buildNodeCondition` walk lands.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterGroupNode } from '@better-tables/core';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('DrizzleAdapter - filter-group rejection (until plan 017 translation lands)', () => {
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

  it('rejects filter groups until translation lands (plan 017 flips this)', async () => {
    const group: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        { columnId: 'age', type: 'number', operator: 'greaterThan', values: [30] },
      ],
    };

    await expect(adapter.fetchData({ filters: group })).rejects.toThrow(
      /filter groups are not yet supported/i
    );

    // The rejection is the typed QueryError, not an incidental crash.
    try {
      await adapter.fetchData({ filters: group });
      expect.unreachable('fetchData must reject a FilterGroupNode');
    } catch (error) {
      expect((error as Error).name).toBe('QueryError');
      expect((error as Error).message).toContain('supportsFilterGroups: false');
    }
  });

  it('advertises supportsFilterGroups: false until translation lands (plan 017 flips this)', () => {
    expect(adapter.meta.supportsFilterGroups).toBe(false);
  });
});
