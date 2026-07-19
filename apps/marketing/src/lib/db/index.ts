import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { postsRelations, profilesRelations, schema, usersRelations } from './schema';
import { seedDatabase } from './seed';
import { sqlCaptureLogger } from './sql-capture';

type DatabaseBundle = {
  db: ReturnType<typeof drizzle>;
  sqlite: Database.Database;
};

// Singleton pattern for in-memory database — memoize the in-flight promise
// synchronously so concurrent cold-start callers share one seed (plan 051).
let dbInstance: DatabaseBundle | null = null;
let initPromise: Promise<void> | null = null;

async function initDatabase(): Promise<DatabaseBundle> {
  // Create in-memory SQLite database
  const sqlite = new Database(':memory:');

  // Enable foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON;');

  // Relations spread under their OWN export names. Spreading a
  // TABLE-NAME-KEYED relations map here instead (`{ users: usersRelations }`)
  // would silently overwrite every real table object with its same-named
  // `Relations` object -- object spread, later keys win (plan 030, finding 11).
  const db = drizzle(sqlite, {
    schema: { ...schema, usersRelations, profilesRelations, postsRelations },
    // Feeds the homepage's live "generated SQL" readout; no-op outside a
    // withSqlCapture scope.
    logger: sqlCaptureLogger,
  });

  // Create tables
  await db.run(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    age INTEGER,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  )`);

  await db.run(sql`CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bio TEXT,
    avatar TEXT,
    website TEXT,
    location TEXT,
    github TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.run(sql`CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    published INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Seed the database
  await seedDatabase(db);

  return { db, sqlite };
}

export async function getDatabase(): Promise<DatabaseBundle> {
  if (!initPromise) {
    initPromise = initDatabase()
      .then((bundle) => {
        dbInstance = bundle;
      })
      .catch((error) => {
        initPromise = null;
        throw error;
      });
  }

  await initPromise;
  if (!dbInstance) {
    throw new Error('Database failed to initialize');
  }
  return dbInstance;
}

export async function resetDatabase() {
  if (dbInstance?.sqlite) {
    dbInstance.sqlite.close();
  }
  dbInstance = null;
  initPromise = null;
}
