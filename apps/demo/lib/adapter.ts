import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { getDatabase } from './db';
import { relationsSchema as relations, schema } from './db/schema';

export async function getAdapter() {
  const { db } = await getDatabase();

  return new DrizzleAdapter({
    db,
    schema,
    relations,
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
}
