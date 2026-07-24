/**
 * Plan 063 Step 3 — Tier 2 growth-ratio gates for the Drizzle adapter
 * (SQLite, bun:sqlite).
 *
 * Gates scale BEHAVIOR, not machine speed: the same operation runs against
 * 1,000 and 10,000 seeded rows and the assertion bounds the 10k/1k RATIO
 * (ratios cancel host speed; an accidental O(n²) shows up as ~100×). The
 * only absolute number is a catastrophic ceiling wide enough to never
 * flake on a slow shared runner.
 *
 * Method (per plan 063): `performance.now()`, median of 5 BATCHED samples
 * after 1 discarded warm-up batch — each sample runs the op `BATCH` (20)
 * times so even the fast 1k case measures well above timer resolution, so the
 * 10k/1k ratio needs no denominator floor (BATCH cancels out of the ratio).
 * The absolute catastrophic ceiling is therefore on the BATCH total, not a
 * single op (noted at the assertion). Plan 040's LRU cache is explicitly
 * DISABLED on these adapters — with the default-on cache every timed run
 * after the warm-up would be a 0-query cache hit and the ratio would measure
 * the cache, not the database.
 *
 * Bun caveat (plan 063 Step 3): this bun version has a `.rejects`/pending-
 * promise matcher bug — everything here is plain async/await over promises
 * that always settle, with expect() on computed numbers only.
 */

import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleAdapter } from '../src/factory';

const events = sqliteTable('events', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  amount: integer('amount').notNull(),
});

const schema = { events };

/**
 * Deterministic fixture at a given row count. Seeding uses the RAW
 * bun:sqlite handle with one prepared INSERT inside a single transaction
 * (11k total rows seed in well under 1 s). `status` is deliberately NOT
 * indexed here: the filtered-count gate below wants the linear-ish scan
 * so the ratio bound is exercised honestly (index-usage guarantees live
 * in query-count.test.ts, on an indexed fixture).
 */
function createSeededFixture(rowCount: number) {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL
    );
  `);
  const statuses = ['active', 'archived', 'draft', 'active'] as const;
  const insert = sqlite.prepare(
    'INSERT INTO events (id, title, status, amount) VALUES (?, ?, ?, ?)'
  );
  const seedAll = sqlite.transaction(() => {
    for (let i = 1; i <= rowCount; i++) {
      insert.run(i, `Event ${i}`, statuses[(i - 1) % 4] as string, ((i - 1) * 37) % 1000);
    }
  });
  seedAll();

  const db = drizzle(sqlite, { schema });
  const adapter = drizzleAdapter(db, {
    driver: 'sqlite',
    schema,
    options: {
      defaultPrimaryTable: 'events',
      // See file header: growth must measure the DB, not plan 040's LRU.
      cache: { enabled: false, ttl: 0 },
    },
  });
  return { sqlite, adapter };
}

// Run the op BATCH times inside each timed sample so even the fast 1k case
// measures well above timer resolution — the 10k/1k ratio then never needs a
// denominator floor (which could otherwise mask a real regression when the 1k
// time dips into sub-millisecond noise). BATCH cancels out of the ratio.
const BATCH = 20;

/** Median of 5 batched runs after 1 discarded warm-up batch (plan 063 method). */
async function medianBatchMs(run: () => Promise<unknown>): Promise<number> {
  for (let i = 0; i < BATCH; i++) await run(); // warm-up batch, discarded
  const samples: number[] = [];
  for (let s = 0; s < 5; s++) {
    const start = performance.now();
    for (let i = 0; i < BATCH; i++) await run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[2] as number;
}

const ratioOf = (t10k: number, t1k: number): number => t10k / t1k;

describe('DrizzleAdapter — 10k/1k growth ratios (plan 063 Step 3)', () => {
  let small: ReturnType<typeof createSeededFixture>;
  let large: ReturnType<typeof createSeededFixture>;

  beforeAll(() => {
    small = createSeededFixture(1_000);
    large = createSeededFixture(10_000);
  });

  afterAll(() => {
    small.sqlite.close();
    large.sqlite.close();
  });

  it("page-1 LIMIT'd fetchData stays near-flat: 10k ≤ 8× the 1k time, and < 2 s absolute", async () => {
    const pageFetch = (fixture: ReturnType<typeof createSeededFixture>) => () =>
      fixture.adapter.fetchData({
        columns: ['title', 'status', 'amount'],
        pagination: { page: 1, limit: 50 },
      });

    const t1k = await medianBatchMs(pageFetch(small));
    const t10k = await medianBatchMs(pageFetch(large));
    const ratio = ratioOf(t10k, t1k);
    console.log(
      `[scale-growth] page-1 fetchData: 1k=${t1k.toFixed(3)}ms 10k=${t10k.toFixed(3)}ms ratio=${ratio.toFixed(2)}`
    );

    // A LIMIT 50 page reads 50 rows regardless of table size; the only
    // size-dependent statement is the parallel `count(*)`, which SQLite
    // resolves via a rowid scan — cheap at both scales. 8× is wide slack
    // over "near-flat"; an O(n) data path would already land ~10×.
    expect(ratio).toBeLessThanOrEqual(8);
    // Catastrophic ceiling only (never a wall-time budget): BATCH page fetches
    // over 10k in-memory rows taking 2 s (≈100 ms each) means something is
    // pathological.
    expect(t10k).toBeLessThan(2_000);
  }, 30_000);

  it('filtered fetchData (WHERE + COUNT over the un-indexed status column) grows ≤ 15×', async () => {
    const filteredFetch = (fixture: ReturnType<typeof createSeededFixture>) => () =>
      fixture.adapter.fetchData({
        columns: ['title', 'status', 'amount'],
        filters: [{ columnId: 'status', type: 'option', operator: 'isAnyOf', values: ['active'] }],
        pagination: { page: 1, limit: 50 },
      });

    // Sanity that the filter actually selects (half the rows are
    // 'active'), so the timed COUNT below does real filtered work.
    const sanity = await large.adapter.fetchData({
      columns: ['title', 'status', 'amount'],
      filters: [{ columnId: 'status', type: 'option', operator: 'isAnyOf', values: ['active'] }],
      pagination: { page: 1, limit: 50 },
    });
    expect(sanity.total).toBe(5_000);

    const t1k = await medianBatchMs(filteredFetch(small));
    const t10k = await medianBatchMs(filteredFetch(large));
    const ratio = ratioOf(t10k, t1k);
    console.log(
      `[scale-growth] filtered fetchData+count: 1k=${t1k.toFixed(3)}ms 10k=${t10k.toFixed(3)}ms ratio=${ratio.toFixed(2)}`
    );

    // The filtered `count(*)` must scan every matching row (no index on
    // status here by design) → linear-ish, ideal ratio ~10×. 15× is the
    // plan's slack for that; a quadratic regression would be ~100×.
    expect(ratio).toBeLessThanOrEqual(15);
  }, 30_000);
});
