import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { getDatabase } from './db';

// Module-level cache for the adapter instance
let adapterInstance: ReturnType<typeof drizzleAdapter> | null = null;

export async function getAdapter() {
  // Return cached instance if it exists
  if (adapterInstance) {
    return adapterInstance;
  }

  const { db } = await getDatabase();

  adapterInstance = drizzleAdapter(db);

  return adapterInstance;
}
