/**
 * Date-operator row-set tests against a SQLite `integer('...', { mode:
 * 'timestamp' })` column.
 *
 * Regression coverage for the bug where every RANGE-shaped date operator
 * (`is`, `isNot`, `isToday`/`isThisWeek`/…, `between`/`notBetween`) crashed
 * with `value.getTime is not a function`, and the COMPARISON operators
 * (`before`/`after`) silently returned wrong results. Root cause: the emitter
 * pre-converted the bound Date to `getTime()` and handed the raw number to
 * Drizzle's typed `gte`/`lte` helpers, whose `mode: 'timestamp'` column mapper
 * expects a Date (and stores Unix SECONDS, not the millisecond value the
 * emitter produced). The fix binds Date objects and lets the column mapper
 * convert units. `between`/`notBetween` were additionally dropped entirely for
 * date columns (missing from the router's supported-operator list + dispatch).
 *
 * These assert real row COUNTS, not SQL shape — a shape test would pass on the
 * wrong-unit semantics that shipped before.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { Database } from 'bun:sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { drizzleAdapter } from '../src/factory';

const events = sqliteTable('events', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
});

const schema = { events };

// Five events, one per day, all in the same ISO week/month/year so the
// relative operators have a stable anchor regardless of when the suite runs
// is not assumed — relative-operator tests below only assert "does not throw".
const SEED = [
  { id: 1, name: 'a', occurredAt: new Date('2026-03-08T09:00:00Z') },
  { id: 2, name: 'b', occurredAt: new Date('2026-03-09T09:00:00Z') },
  { id: 3, name: 'c', occurredAt: new Date('2026-03-10T09:00:00Z') },
  { id: 4, name: 'd', occurredAt: new Date('2026-03-11T09:00:00Z') },
  { id: 5, name: 'e', occurredAt: new Date('2026-03-12T09:00:00Z') },
];

function dateFilter(operator: string, values: unknown[]): FilterState {
  return { columnId: 'occurredAt', type: 'date', operator, values } as unknown as FilterState;
}

describe('DrizzleAdapter — date operators on a timestamp column', () => {
  let sqlite: Database;
  let adapter: ReturnType<typeof drizzleAdapter>;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    db.run(
      sql`CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT NOT NULL, occurred_at INTEGER NOT NULL)`
    );
    await db.insert(events).values(SEED);
    adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      options: { defaultPrimaryTable: 'events' },
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  const fetch = (filter: FilterState) =>
    adapter.fetchData({
      pagination: { page: 1, limit: 50 },
      primaryTable: 'events',
      columns: ['name', 'occurredAt'],
      filters: [filter],
    });

  it('`is` matches the single day, accepting a Date, an ISO string, or an epoch-ms number', async () => {
    const day = new Date('2026-03-10T00:00:00Z');
    for (const value of [day, '2026-03-10T00:00:00Z', new Date('2026-03-10T09:00:00Z').getTime()]) {
      const res = await fetch(dateFilter('is', [value]));
      expect(res.total).toBe(1);
      expect((res.data[0] as { name: string }).name).toBe('c');
    }
  });

  it('`isNot` is the complement of `is`', async () => {
    const res = await fetch(dateFilter('isNot', ['2026-03-10T00:00:00Z']));
    expect(res.total).toBe(4);
  });

  it('`before` / `after` split the set at day granularity', async () => {
    const before = await fetch(dateFilter('before', ['2026-03-10T00:00:00Z']));
    expect(before.total).toBe(2); // 03-08, 03-09
    const after = await fetch(dateFilter('after', ['2026-03-10T23:59:59Z']));
    expect(after.total).toBe(2); // 03-11, 03-12
  });

  it('`between` is inclusive of both endpoint days; `notBetween` is its complement', async () => {
    const between = await fetch(
      dateFilter('between', ['2026-03-09T00:00:00Z', '2026-03-11T23:59:59Z'])
    );
    expect(between.total).toBe(3); // 03-09, 03-10, 03-11
    const notBetween = await fetch(
      dateFilter('notBetween', ['2026-03-09T00:00:00Z', '2026-03-11T23:59:59Z'])
    );
    expect(notBetween.total).toBe(2); // 03-08, 03-12
    expect(between.total + notBetween.total).toBe(SEED.length);
  });

  it('relative operators execute without throwing (the original crash)', async () => {
    for (const op of ['isToday', 'isYesterday', 'isThisWeek', 'isThisMonth', 'isThisYear']) {
      const res = await fetch(dateFilter(op, []));
      expect(res.total).toBeGreaterThanOrEqual(0); // no `value.getTime is not a function`
    }
  });

  it('advertises between/notBetween as supported date operators', () => {
    const dateOps = adapter.meta.supportedOperators?.date ?? [];
    expect(dateOps).toContain('between');
    expect(dateOps).toContain('notBetween');
  });
});
