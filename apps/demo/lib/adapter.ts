import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { getDatabase } from './db';
import { schema } from './db/schema';

// biome-ignore lint/suspicious/noExplicitAny: DrizzleAdapter type is complex
let adapterInstance: any = null;

export async function getAdapter() {
  if (adapterInstance) {
    return adapterInstance;
  }

  const { db } = await getDatabase();

  adapterInstance = new DrizzleAdapter({
    db,
    // biome-ignore lint/suspicious/noExplicitAny: Schema type inference is complex with Drizzle
    schema: schema as any,
    mainTable: 'users',
    driver: 'sqlite',
    autoDetectRelationships: true,
    options: {
      optimization: {
        maxJoins: 5,
        enableBatching: true,
        batchSize: 1000,
      },
      logging: {
        enabled: true,
        level: 'info',
        logQueries: true,
      },
      performance: {
        trackTiming: true,
        maxQueryTime: 5000,
      },
    },
  });

  return adapterInstance;
}
