import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { getDatabase } from './db';
import { relationsSchema, schema } from './db/schema';

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
    relations: relationsSchema as unknown as Record<string, unknown>,
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
