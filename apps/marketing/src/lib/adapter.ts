import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { getDatabase } from './db';
import { relationsSchema, schema } from './db/schema';

// Module-level cache for the adapter instance
let adapterInstance: ReturnType<typeof drizzleAdapter> | null = null;

export async function getAdapter() {
  // Return cached instance if it exists
  if (adapterInstance) {
    return adapterInstance;
  }

  const { db } = await getDatabase();

  // Pass schema and relations separately - don't spread relationsSchema as it will overwrite tables
  adapterInstance = drizzleAdapter(db, {
    schema,
    relations: relationsSchema,
    driver: 'sqlite',
  });

  return adapterInstance;
}
