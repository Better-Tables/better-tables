/**
 * Page-size clamp tests for DrizzleAdapter.
 *
 * `pagination.limit` is frequently URL-driven (`?limit=…`), so `fetchData`
 * clamps an oversized limit down to `options.maxPageSize` (default
 * `DEFAULT_MAX_PAGE_SIZE`) before the query runs. This keeps a crafted request
 * from pulling an unbounded result set out of the database and forcing the
 * client to render tens of thousands of rows. The clamped value is reflected in
 * the returned `pagination.limit` too, so paging math stays consistent.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DEFAULT_MAX_PAGE_SIZE } from '@better-tables/core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../src/types';
import {
  closeDatabase,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';
import { relationsSchema, schema } from './helpers/test-schema';

function makeAdapter(
  db: ReturnType<typeof createTestDatabase>['db'],
  maxPageSize?: number
): DrizzleAdapter<typeof schema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema,
    driver: 'sqlite',
    autoDetectRelationships: true,
    relations: relationsSchema,
    options: {
      defaultPrimaryTable: 'users',
      ...(maxPageSize !== undefined && { maxPageSize }),
    },
  };
  return new DrizzleAdapter(config);
}

describe('DrizzleAdapter - page-size clamp', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const created = createTestDatabase();
    db = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('clamps an oversized limit to the default max page size', async () => {
    const adapter = makeAdapter(db);
    const result = await adapter.fetchData({ pagination: { page: 1, limit: 100_000 } });

    // The returned metadata reflects the clamp even when fewer rows exist, so
    // totalPages/hasNext are computed against the real cap, not the request.
    expect(result.pagination?.limit).toBe(DEFAULT_MAX_PAGE_SIZE);
    // Never returns more rows than the cap (the fixture seeds only a few).
    expect(result.data.length).toBeLessThanOrEqual(DEFAULT_MAX_PAGE_SIZE);
  });

  it('clamps to a custom maxPageSize option', async () => {
    const adapter = makeAdapter(db, 2);
    const result = await adapter.fetchData({ pagination: { page: 1, limit: 1000 } });

    expect(result.pagination?.limit).toBe(2);
    expect(result.data.length).toBe(2);
  });

  it('leaves an at-or-under-cap limit untouched', async () => {
    const adapter = makeAdapter(db, 200);
    const result = await adapter.fetchData({ pagination: { page: 1, limit: 2 } });

    expect(result.pagination?.limit).toBe(2);
    expect(result.data.length).toBe(2);
  });

  it('disables the clamp when maxPageSize is non-positive', async () => {
    const adapter = makeAdapter(db, 0);
    const result = await adapter.fetchData({ pagination: { page: 1, limit: 100_000 } });

    // No clamp: the requested (absurd) limit is echoed back unchanged.
    expect(result.pagination?.limit).toBe(100_000);
  });
});
