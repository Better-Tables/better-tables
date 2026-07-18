/**
 * Minimal bun:sqlite + DrizzleAdapter fixture for UI↔adapter integration tests
 * (plan 043). Mirrors the marketing/drizzle bun:sqlite pattern: construct
 * `DrizzleAdapter` directly (factory driver detection rejects bun:sqlite).
 */
import { Database } from 'bun:sqlite';
import type { DrizzleAdapterConfig } from '@better-tables/adapters-drizzle';
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/bun-sqlite';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const schema = { users };

type TestDB = ReturnType<typeof drizzle<typeof schema>>;
type PublicDrizzleDatabase = DrizzleAdapterConfig<typeof schema, 'sqlite'>['db'];

/** Fixed epoch ms — 2024-06-15T12:00:00.000Z — for deterministic date cells. */
export const SEEDED_CREATED_AT = new Date('2024-06-15T12:00:00.000Z');

export async function createIntegrationAdapter(): Promise<
  DrizzleAdapter<typeof schema, 'sqlite'>
> {
  const sqlite = new Database(':memory:');
  const db: TestDB = drizzle(sqlite, { schema });

  await db.run(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  await db.insert(users).values([
    { id: 1, name: 'Alice', status: 'active', createdAt: SEEDED_CREATED_AT },
    { id: 2, name: 'Bob', status: 'active', createdAt: SEEDED_CREATED_AT },
    { id: 3, name: 'Carol', status: 'inactive', createdAt: SEEDED_CREATED_AT },
  ]);

  const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
    db: db as unknown as PublicDrizzleDatabase,
    schema,
    driver: 'sqlite',
    options: { defaultPrimaryTable: 'users' },
  };
  return new DrizzleAdapter(config);
}
