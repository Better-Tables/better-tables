/**
 * Plan 040: bounded LRU cache + facet LIMIT default top-100.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getTableColumns } from '../src/utils/drizzle-schema-utils';
import { drizzleAdapter } from '../src/factory';

const items = sqliteTable('items', {
  id: integer('id').primaryKey(),
  category: text('category').notNull(),
});

const schema = { items };

describe('Plan 040 — getTableColumns memoization', () => {
  it('returns the same array reference for the same table object', () => {
    const a = getTableColumns(items);
    const b = getTableColumns(items);
    expect(a).toBe(b);
  });
});

describe('Plan 040 — bounded LRU cache', () => {
  let sqlite: Database;
  let adapter: ReturnType<typeof drizzleAdapter>;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    db.run(sql`CREATE TABLE items (id INTEGER PRIMARY KEY, category TEXT NOT NULL)`);
    await db.insert(items).values([
      { id: 1, category: 'a' },
      { id: 2, category: 'b' },
    ]);
    adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      options: {
        defaultPrimaryTable: 'items',
        cache: { enabled: true, ttl: 60_000, maxSize: 3 },
      },
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('evicts least-recently-used entries when over maxSize', async () => {
    for (let i = 0; i < 5; i++) {
      await adapter.fetchData({
        primaryTable: 'items',
        columns: ['category'],
        pagination: { page: 1, limit: 10 },
        // Distinct filter values → distinct cache keys.
        filters: [
          {
            columnId: 'category',
            type: 'text',
            operator: 'equals',
            values: [`key-${i}`],
          },
        ],
      });
    }
    expect(adapter.getCacheSizeForTests()).toBeLessThanOrEqual(3);
  });

  it('deletes expired entries on access', async () => {
    const shortTtl = drizzleAdapter(
      drizzle(sqlite, { schema }),
      {
        driver: 'sqlite',
        schema,
        options: {
          defaultPrimaryTable: 'items',
          cache: { enabled: true, ttl: 1, maxSize: 10 },
        },
      }
    );
    await shortTtl.fetchData({
      primaryTable: 'items',
      columns: ['category'],
      pagination: { page: 1, limit: 10 },
    });
    expect(shortTtl.getCacheSizeForTests()).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    await shortTtl.fetchData({
      primaryTable: 'items',
      columns: ['category'],
      pagination: { page: 1, limit: 10 },
    });
    // Expired entry deleted on access; a fresh entry may be written.
    expect(shortTtl.getCacheSizeForTests()).toBeLessThanOrEqual(1);
  });
});

describe('Plan 040 — facet LIMIT top-100 default', () => {
  let sqlite: Database;
  let adapter: ReturnType<typeof drizzleAdapter>;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    db.run(sql`CREATE TABLE items (id INTEGER PRIMARY KEY, category TEXT NOT NULL)`);
    const rows = Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      // First 20 categories appear twice (higher count); rest once.
      category: i < 20 ? `dup-${i}` : `uniq-${i}`,
    }));
    // Duplicate the first 20 to give them count=2
    const extra = Array.from({ length: 20 }, (_, i) => ({
      id: 200 + i,
      category: `dup-${i}`,
    }));
    await db.insert(items).values([...rows, ...extra]);
    adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      options: { defaultPrimaryTable: 'items', cache: { enabled: false, ttl: 0 } },
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('defaults to top 100 by count desc', async () => {
    const facets = await adapter.getFacetedValues('category');
    expect(facets.size).toBe(100);
    // Highest counts first: the 20 dup-* rows (count 2) should all be present.
    for (let i = 0; i < 20; i++) {
      expect(facets.get(`dup-${i}`)).toBe(2);
    }
  });

  it('limit: null returns all distinct values', async () => {
    const facets = await adapter.getFacetedValues('category', { limit: null });
    expect(facets.size).toBe(120);
  });

  it('limit: 5 returns five values', async () => {
    const facets = await adapter.getFacetedValues('category', { limit: 5 });
    expect(facets.size).toBe(5);
  });
});
