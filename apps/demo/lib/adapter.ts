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
      // Cache configuration
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes in milliseconds
        maxSize: 1000, // Maximum number of cached results
      },
      // Query optimization settings
      optimization: {
        maxJoins: 10, // Maximum number of joins per query
        enableBatching: true, // Enable query result batching for large datasets
        batchSize: 1000, // Batch size for large queries
      },
      // Primary key configuration
      primaryKey: {
        mainTableKey: 'id', // Custom primary key for main table (defaults to 'id')
        tableKeys: {
          // Map specific table names to their primary key column names
          // Example: 'users': 'userId', 'profiles': 'profileId'
        },
      },
      // Logging configuration
      logging: {
        enabled: true,
        level: 'debug', // 'debug' | 'info' | 'warn' | 'error'
        logQueries: true, // Log SQL queries
      },
      // Performance monitoring
      performance: {
        trackTiming: true, // Track query execution times
        maxQueryTime: 5000, // Maximum query execution time in milliseconds before warning
      },
    },
  });

  return adapterInstance;
}
