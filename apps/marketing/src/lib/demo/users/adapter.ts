import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import { dialectMeta, type UsersDialect } from './dialect';
import { closePostgresDatabase, getPostgresDatabase } from './postgres/db';
import { getSqliteDatabase, resetSqliteDatabase, type SqliteDemoDb } from './sqlite/db';

/**
 * Flagship typing surface for `defineTable<UsersTables>()` — Postgres schema.
 * The SQLite fallback mirrors the same column/relation names at runtime;
 * its betterTables instance is cast to this type at the selector boundary.
 */
function buildPostgresAdapter(db: Awaited<ReturnType<typeof getPostgresDatabase>>['db']) {
  return drizzleAdapter(db, {
    options: { defaultPrimaryTable: 'users' },
  });
}

function buildSqliteAdapter(db: SqliteDemoDb) {
  return drizzleAdapter(db, {
    options: { defaultPrimaryTable: 'users' },
  });
}

function buildUsersTables(adapter: ReturnType<typeof buildPostgresAdapter>) {
  return betterTables({ database: adapter });
}

export type UsersAdapter = ReturnType<typeof buildPostgresAdapter>;
export type UsersTables = ReturnType<typeof buildUsersTables>;

type ResolvedBackend = {
  dialect: UsersDialect;
  adapter: UsersAdapter;
  tables: UsersTables;
};

let resolved: ResolvedBackend | null = null;
let resolvePromise: Promise<void> | null = null;

async function resolveBackend(): Promise<ResolvedBackend> {
  const preferPostgres = Boolean(process.env.DATABASE_URL?.trim());

  if (preferPostgres) {
    try {
      const { db } = await getPostgresDatabase();
      const adapter = buildPostgresAdapter(db);
      return { dialect: 'postgres', adapter, tables: buildUsersTables(adapter) };
    } catch (error) {
      // Connection failures already warn inside getPostgresDatabase; still log
      // here so adapter/tables construction bugs are not a silent SQLite fallback.
      // biome-ignore lint/suspicious/noConsole: demo bootstrap diagnostic
      console.warn(
        '[demo/users] Postgres backend unavailable; using SQLite fallback.',
        error instanceof Error ? error.message : error
      );
    }
  }

  const { db } = await getSqliteDatabase();
  const adapter = buildSqliteAdapter(db);
  // Same column/relation names as Postgres; cast keeps defineTable on the flagship type.
  return {
    dialect: 'sqlite',
    adapter: adapter as unknown as UsersAdapter,
    tables: buildUsersTables(adapter as unknown as UsersAdapter),
  };
}

async function ensureResolved(): Promise<ResolvedBackend> {
  if (!resolvePromise) {
    resolvePromise = resolveBackend()
      .then((next) => {
        resolved = next;
      })
      .catch((error) => {
        resolvePromise = null;
        throw error;
      });
  }
  await resolvePromise;
  if (!resolved) {
    throw new Error('Users demo backend failed to initialize');
  }
  return resolved;
}

/** Effective dialect after connection (may be sqlite even when DATABASE_URL is set). */
export async function getUsersDialect(): Promise<UsersDialect> {
  const { dialect } = await ensureResolved();
  return dialect;
}

export async function getUsersBackendMeta() {
  const dialect = await getUsersDialect();
  return dialectMeta(dialect);
}

export function resetAdapterCaches() {
  resolved = null;
  resolvePromise = null;
}

export async function getTables(): Promise<UsersTables> {
  const { tables } = await ensureResolved();
  return tables;
}

/** Underlying drizzle adapter — used by `/api/tables/users` for resolveCellWriteTarget. */
export async function getUsersDatabaseAdapter(): Promise<UsersAdapter> {
  const { adapter } = await ensureResolved();
  return adapter;
}

/**
 * Reset is SQLite-only. Closes the in-memory DB so the next request re-seeds.
 * No-op-safe to call after checking supportsReset.
 */
export async function resetUsersDatabase() {
  const dialect = await getUsersDialect();
  if (dialect !== 'sqlite') {
    throw new Error('Reset is only supported for the in-memory SQLite fallback');
  }
  await resetSqliteDatabase();
  resetAdapterCaches();
}

/** Test helper — drop both backends' caches/connections. */
export async function resetUsersBackendForTests() {
  resetAdapterCaches();
  await resetSqliteDatabase();
  await closePostgresDatabase();
}
