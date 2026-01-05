import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { relationsSchema, schema } from './db/schema';
import { db } from './db/db';

// Module-level cache for the adapter instance
let adapterInstance: ReturnType<typeof drizzleAdapter> | null = null;

export async function getAdapter() {
  // Return cached instance if it exists
  if (adapterInstance) {
    return adapterInstance;
  }

  // Pass schema and relations separately - don't spread relationsSchema as it will overwrite tables
  adapterInstance = drizzleAdapter(db, {
    schema,
    relations: relationsSchema,
    driver: 'postgres',
  });

  return adapterInstance;
}
