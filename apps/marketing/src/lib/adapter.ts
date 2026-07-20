import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import { type DemoDb, getDatabase } from './db';

/**
 * Typed build functions, split out so their RETURN TYPES can be captured at
 * module scope. `UsersTables` is what `defineTable<UsersTables>()` needs to
 * type every column path (own columns AND relation paths like
 * `profile.bio`) from the Drizzle schema — the runtime instances stay lazy
 * behind the async getters below.
 */
function buildUsersAdapter(db: DemoDb) {
  // The demo schema has three tables (users, profiles, posts); this adapter
  // only ever serves the users table. `defaultPrimaryTable` names it so a
  // parameterless read resolves unambiguously instead of throwing the
  // multi-table SchemaError (plan 030, finding 9).
  return drizzleAdapter(db, {
    options: { defaultPrimaryTable: 'users' },
  });
}

function buildUsersTables(adapter: UsersAdapter) {
  return betterTables({ database: adapter });
}

export type UsersAdapter = ReturnType<typeof buildUsersAdapter>;
export type UsersTables = ReturnType<typeof buildUsersTables>;

let adapterInstance: UsersAdapter | null = null;
let adapterPromise: Promise<void> | null = null;

let tablesInstance: UsersTables | null = null;
let tablesPromise: Promise<void> | null = null;

/**
 * Discard objects tied to the current in-memory SQLite connection.
 *
 * `resetDatabase()` cannot call this directly: adapter.ts imports db/index.ts,
 * so importing this module back into db/index.ts would create a circular
 * dependency. The reset API route calls this after resetting the database.
 */
export function resetAdapterCaches() {
  adapterInstance = null;
  adapterPromise = null;
  tablesInstance = null;
  tablesPromise = null;
}

export async function getAdapter(): Promise<UsersAdapter> {
  if (!adapterPromise) {
    adapterPromise = getDatabase()
      .then(({ db }) => {
        adapterInstance = buildUsersAdapter(db);
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
export async function getTables(): Promise<UsersTables> {
  if (!tablesPromise) {
    tablesPromise = getAdapter()
      .then((adapter) => {
        tablesInstance = buildUsersTables(adapter);
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
