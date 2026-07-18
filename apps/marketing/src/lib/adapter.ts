import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import { getDatabase } from './db';

type AdapterInstance = ReturnType<typeof drizzleAdapter>;
type TablesInstance = ReturnType<typeof betterTables>;

let adapterInstance: AdapterInstance | null = null;
let adapterPromise: Promise<void> | null = null;

let tablesInstance: TablesInstance | null = null;
let tablesPromise: Promise<void> | null = null;

export async function getAdapter(): Promise<AdapterInstance> {
  if (!adapterPromise) {
    adapterPromise = getDatabase()
      .then(({ db }) => {
        // The demo schema has three tables (users, profiles, posts); this adapter
        // only ever serves the users table. `defaultPrimaryTable` names it so a
        // parameterless read resolves unambiguously instead of throwing the
        // multi-table SchemaError (plan 030, finding 9).
        adapterInstance = drizzleAdapter(db, {
          options: { defaultPrimaryTable: 'users' },
        });
      })
      .catch((error) => {
        adapterPromise = null;
        throw error;
      });
  }

  await adapterPromise;
  if (!adapterInstance) {
    throw new Error('Adapter failed to initialize');
  }
  return adapterInstance;
}

/**
 * The `betterTables()` instance for the homepage demo. Callers use its
 * table-scoped read surface (`tables.fetchData(usersTable, ...)`), which
 * injects `primaryTable` and returns rows typed as the table's own row --
 * no cast (findings 9 + 16).
 */
export async function getTables(): Promise<TablesInstance> {
  if (!tablesPromise) {
    tablesPromise = getAdapter()
      .then((adapter) => {
        tablesInstance = betterTables({ database: adapter });
      })
      .catch((error) => {
        tablesPromise = null;
        throw error;
      });
  }

  await tablesPromise;
  if (!tablesInstance) {
    throw new Error('Tables failed to initialize');
  }
  return tablesInstance;
}
