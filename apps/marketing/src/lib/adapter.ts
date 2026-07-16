import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import { getDatabase } from './db';

// Module-level cache for the adapter instance
let adapterInstance: ReturnType<typeof drizzleAdapter> | null = null;
let tablesInstance: ReturnType<typeof betterTables> | null = null;

export async function getAdapter() {
  // Return cached instance if it exists
  if (adapterInstance) {
    return adapterInstance;
  }

  const { db } = await getDatabase();

  // The demo schema has three tables (users, profiles, posts); this adapter
  // only ever serves the users table. `defaultPrimaryTable` names it so a
  // parameterless read resolves unambiguously instead of throwing the
  // multi-table SchemaError (plan 030, finding 9).
  adapterInstance = drizzleAdapter(db, {
    options: { defaultPrimaryTable: 'users' },
  });

  return adapterInstance;
}

/**
 * The `betterTables()` instance for the homepage demo. Callers use its
 * table-scoped read surface (`tables.fetchData(usersTable, ...)`), which
 * injects `primaryTable` and returns rows typed as the table's own row --
 * no cast (findings 9 + 16).
 */
export async function getTables() {
  if (tablesInstance) {
    return tablesInstance;
  }

  tablesInstance = betterTables({ database: await getAdapter() });
  return tablesInstance;
}
