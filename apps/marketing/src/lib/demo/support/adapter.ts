import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { getSupportDatabase } from './db';

let supportAdapterInstance: ReturnType<typeof drizzleAdapter> | null = null;

export async function getSupportAdapter() {
  if (supportAdapterInstance) {
    return supportAdapterInstance;
  }

  const { db } = await getSupportDatabase();
  supportAdapterInstance = drizzleAdapter(db);

  return supportAdapterInstance;
}
