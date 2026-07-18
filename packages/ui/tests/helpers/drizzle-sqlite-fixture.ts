/**
 * Minimal bun:sqlite + DrizzleAdapter fixture for UI↔adapter integration tests
 * (plan 043). Mirrors the marketing/drizzle bun:sqlite pattern: construct
 * `DrizzleAdapter` directly (factory driver detection rejects bun:sqlite).
 *
 * Plan 055 adds relations: a single-valued `users.team` (joined-table
 * editing) and a one-to-many `users.notes` (must stay read-only).
 */
import { Database } from 'bun:sqlite';
import type { DrizzleAdapterConfig } from '@better-tables/adapters-drizzle';
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { relations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  // Enum-typed text: same TEXT storage, but the schema knows the choices —
  // exercised by describeColumns/auto-columns inference (plan 054).
  status: text('status', { enum: ['active', 'inactive'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  teamId: integer('team_id'),
});

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
}));

export const schema = { users, teams, notes };

const relationsSchema = { users: usersRelations, notes: notesRelations };

type TestDB = ReturnType<typeof drizzle<typeof schema>>;
type PublicDrizzleDatabase = DrizzleAdapterConfig<typeof schema, 'sqlite'>['db'];

/** Fixed epoch ms — 2024-06-15T12:00:00.000Z — for deterministic date cells. */
export const SEEDED_CREATED_AT = new Date('2024-06-15T12:00:00.000Z');

export async function createIntegrationAdapter(): Promise<DrizzleAdapter<typeof schema, 'sqlite'>> {
  const sqlite = new Database(':memory:');
  const db: TestDB = drizzle(sqlite, { schema });

  await db.run(sql`CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    team_id INTEGER
  )`);

  await db.run(sql`CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL
  )`);

  await db.insert(teams).values([
    { id: 1, name: 'Platform' },
    { id: 2, name: 'Support' },
  ]);

  await db.insert(users).values([
    { id: 1, name: 'Alice', status: 'active', createdAt: SEEDED_CREATED_AT, teamId: 1 },
    { id: 2, name: 'Bob', status: 'active', createdAt: SEEDED_CREATED_AT, teamId: 1 },
    { id: 3, name: 'Carol', status: 'inactive', createdAt: SEEDED_CREATED_AT, teamId: null },
  ]);

  await db.insert(notes).values([
    { id: 1, userId: 1, body: 'first note' },
    { id: 2, userId: 1, body: 'second note' },
  ]);

  const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
    db: db as unknown as PublicDrizzleDatabase,
    schema,
    driver: 'sqlite',
    autoDetectRelationships: true,
    relations: relationsSchema,
    // Multi-table schema (plan 055): mutations need a default target for
    // capability advertising; explicit per-call `options.table` (what the
    // table components and joined writes use) always wins over it.
    options: { defaultPrimaryTable: 'users', defaultMutationTable: 'users' },
  };
  return new DrizzleAdapter(config);
}
