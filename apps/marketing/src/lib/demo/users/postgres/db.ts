import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sqlCaptureLogger } from '@/lib/db/sql-capture';
import {
  categoriesRelations,
  commentsRelations,
  postCategoriesRelations,
  postsRelations,
  profilesRelations,
  schema,
  usersRelations,
} from './schema';

// Relations spread under their OWN export names (plan 030, finding 11).
const fullSchema = {
  ...schema,
  usersRelations,
  profilesRelations,
  postsRelations,
  commentsRelations,
  categoriesRelations,
  postCategoriesRelations,
};

function buildDrizzle(client: ReturnType<typeof postgres>) {
  return drizzle(client, {
    schema: fullSchema,
    logger: sqlCaptureLogger,
  });
}

export type PostgresDemoDb = ReturnType<typeof buildDrizzle>;

type PostgresBundle = {
  db: PostgresDemoDb;
  client: ReturnType<typeof postgres>;
};

let bundle: PostgresBundle | null = null;
let initPromise: Promise<void> | null = null;
/** Bumped on close so an in-flight init that finishes later discards its pool. */
let connectionGeneration = 0;

export function getPostgresDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

async function initPostgres(url: string): Promise<PostgresBundle> {
  // Neon pooler URL already includes sslmode=require; postgres.js honors it.
  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  const db = buildDrizzle(client);
  // Cheap connectivity check so a bad URL falls back before first query.
  await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return { db, client };
}

/**
 * Connect to Neon (or any Postgres) via DATABASE_URL.
 * Throws if the URL is missing or the connection/probe fails — caller falls back to SQLite.
 */
export async function getPostgresDatabase(): Promise<PostgresBundle> {
  const url = getPostgresDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!initPromise) {
    const generation = connectionGeneration;
    initPromise = initPostgres(url)
      .then(async (next) => {
        // Closed while connecting — discard the pool so it cannot leak.
        if (generation !== connectionGeneration) {
          await next.client.end({ timeout: 5 });
          return;
        }
        bundle = next;
      })
      .catch((error) => {
        initPromise = null;
        bundle = null;
        // Log every failed attempt (retries clear initPromise) so intermittent
        // DATABASE_URL issues stay visible in server logs.
        // biome-ignore lint/suspicious/noConsole: demo bootstrap diagnostic
        console.warn(
          '[demo/users/postgres] DATABASE_URL connection failed; homepage will use SQLite fallback.',
          error instanceof Error ? error.message : error
        );
        throw error;
      });
  }

  await initPromise;
  if (!bundle) {
    throw new Error('Postgres demo database failed to initialize');
  }
  return bundle;
}

/** Close the pool (tests / hot reset). Does not drop remote data. */
export async function closePostgresDatabase() {
  connectionGeneration += 1;
  const pending = initPromise;
  if (pending) {
    try {
      await pending;
    } catch {
      // Init failed — nothing to close beyond clearing state below.
    }
  }
  if (bundle?.client) {
    await bundle.client.end({ timeout: 5 });
  }
  bundle = null;
  initPromise = null;
}
