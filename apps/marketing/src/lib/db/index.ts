import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { relationsSchema, schema } from './schema';
import { seedDatabase } from './seed';

// Singleton pattern for in-memory database
let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database.Database | null = null;

export async function getDatabase() {
  if (dbInstance && sqliteInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }

  // Create in-memory SQLite database
  const sqlite = new Database(':memory:');

  // Enable foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsSchema } });

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

  // Seed the database with thousands of users
  try {
    await seedDatabase(db);
    // Verify data was seeded
    const userCount = await db.select().from(schema.users).limit(1);
    if (userCount.length === 0) {
      console.warn('Warning: Database seeded but no users found. Seed may have failed silently.');
    } else {
      console.log(`Database seeded successfully. Found ${userCount.length} user(s) in sample.`);
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    // Don't throw - allow the app to continue even if seeding fails
    // The table will just show empty data
  }

  // Store instances
  dbInstance = db;
  sqliteInstance = sqlite;

  return { db, sqlite };
}

export async function resetDatabase() {
  if (sqliteInstance) {
    sqliteInstance.close();
  }
  dbInstance = null;
  sqliteInstance = null;
}
