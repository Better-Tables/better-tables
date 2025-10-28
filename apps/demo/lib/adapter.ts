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
}
