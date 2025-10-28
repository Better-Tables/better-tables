/** biome-ignore-all lint/suspicious/noExplicitAny: Multiple drizzle versions and readonly schema cause type conflicts */
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import { getDatabase } from './db';
import { relationsSchema as relations, schema } from './db/schema';

// Module-level cache for the adapter instance
let adapterInstance: any = null;

export async function getAdapter() {
  // Return cached instance if it exists
  if (adapterInstance) {
    return adapterInstance;
  }

  const { db } = await getDatabase();

  adapterInstance = new DrizzleAdapter({
    db: db as any,
    schema: schema as any,
    relations: relations as any,
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
