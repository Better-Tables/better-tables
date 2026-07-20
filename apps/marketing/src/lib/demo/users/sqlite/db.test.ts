/**
 * Bun cannot load `better-sqlite3`'s native binding (see fetch-tickets.test.ts).
 * Mock the driver stack and assert the in-flight promise memo: concurrent
 * `getSqliteDatabase()` calls must share one SQLite instance and one seed.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test';

const sqliteInstances: unknown[] = [];
const seedDatabase = mock(async () => {});

mock.module('better-sqlite3', () => ({
  default: class MockDatabase {
    constructor(_path: string) {
      sqliteInstances.push(this);
    }
    exec(_sql: string) {}
    close() {}
  },
}));

mock.module('drizzle-orm/better-sqlite3', () => ({
  drizzle: () => ({
    run: async () => {},
  }),
}));

mock.module('./seed', () => ({
  seedDatabase,
}));

const { getSqliteDatabase, resetSqliteDatabase } = await import('./db');

describe('getSqliteDatabase singleton', () => {
  afterEach(async () => {
    sqliteInstances.length = 0;
    seedDatabase.mockClear();
    await resetSqliteDatabase();
  });

  it('memoizes the in-flight promise so concurrent callers share one seed', async () => {
    const [first, second] = await Promise.all([getSqliteDatabase(), getSqliteDatabase()]);

    expect(first.sqlite).toBe(second.sqlite);
    expect(first.db).toBe(second.db);
    expect(sqliteInstances).toHaveLength(1);
    expect(seedDatabase).toHaveBeenCalledTimes(1);
  });
});
