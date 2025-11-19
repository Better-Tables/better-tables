/**
 * Shared test fixtures for database setup and teardown across all database types
 */

import { sql } from 'drizzle-orm';
import { type BetterSQLite3Database, drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import mysql from 'mysql2/promise';
import postgres from 'postgres';
import type { DrizzleAdapter } from '../../drizzle-adapter';
import { DrizzleAdapter as DrizzleAdapterClass } from '../../drizzle-adapter';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../../types';
import BunSQLiteCompat, { type Database } from './bun-sqlite-compat';
import { relationsSchema, schema } from './test-schema';

/**
 * ============================================================================
 * SQLite Test Fixtures
 * ============================================================================
 */

/**
 * Create an in-memory SQLite database for testing
 */
export function createSQLiteDatabase(): {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database;
} {
  const sqlite = new BunSQLiteCompat(':memory:');
  // Type assertion needed because Drizzle expects better-sqlite3 Database,
  // but at runtime Bun's SQLite should work similarly
  // @ts-expect-error - Drizzle expects better-sqlite3 Database, but Bun's SQLite is compatible at runtime
  const db = drizzleSQLite(sqlite) as unknown as BetterSQLite3Database<typeof schema>;
  return { db, sqlite };
}

/**
 * Setup SQLite test database with tables and initial data
 */
export async function setupSQLiteDatabase(db: BetterSQLite3Database<typeof schema>): Promise<void> {
  // Create tables
  await db.run(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    age INTEGER,
    created_at INTEGER
  )`);

  await db.run(sql`CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bio TEXT,
    avatar TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.run(sql`CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    published INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.run(sql`CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Insert test data
  await db.run(sql`INSERT INTO users (id, name, email, age, created_at) VALUES 
    (1, 'John Doe', 'john@example.com', 30, ${Date.now()}),
    (2, 'Jane Smith', 'jane@example.com', 25, ${Date.now()}),
    (3, 'Bob Johnson', 'bob@example.com', 35, ${Date.now()})`);

  await db.run(sql`INSERT INTO profiles (id, user_id, bio, avatar) VALUES 
    (1, 1, 'Software developer', 'avatar1.jpg'),
    (2, 2, 'Designer', 'avatar2.jpg')`);

  await db.run(sql`INSERT INTO posts (id, user_id, title, content, published) VALUES 
    (1, 1, 'First Post', 'Content 1', 1),
    (2, 1, 'Second Post', 'Content 2', 0),
    (3, 2, 'Design Tips', 'Content 3', 1)`);

  await db.run(sql`INSERT INTO comments (id, post_id, user_id, content) VALUES 
    (1, 1, 2, 'Great post!'),
    (2, 1, 3, 'I agree'),
    (3, 3, 1, 'Nice design tips')`);
}

/**
 * Create a Drizzle adapter configured for SQLite testing
 */
export function createSQLiteAdapter(
  db: BetterSQLite3Database<typeof schema>
): DrizzleAdapter<typeof schema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema,
    driver: 'sqlite',
    autoDetectRelationships: true,
    relations: relationsSchema,
  };

  return new DrizzleAdapterClass(config);
}

/**
 * Close SQLite database connection
 */
export function closeSQLiteDatabase(sqlite: Database): void {
  if (sqlite) {
    sqlite.close();
  }
}

/**
 * ============================================================================
 * PostgreSQL Test Fixtures
 * ============================================================================
 */

/**
 * Create a PostgreSQL database connection for testing
 */
export function createPostgresDatabase(connectionString: string): {
  db: PostgresJsDatabase<typeof schema>;
  client: ReturnType<typeof postgres>;
} {
  const client = postgres(connectionString, {
    max: 1,
    // Suppress NOTICE messages (e.g., "table does not exist, skipping" during DROP TABLE IF EXISTS)
    onnotice: () => {},
  });
  const db = drizzlePostgres(client) as PostgresJsDatabase<typeof schema>;
  return { db, client };
}

/**
 * Setup PostgreSQL test database with tables and initial data
 */
export async function setupPostgresDatabase(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  // Drop tables if they exist (for clean test runs)
  await db.execute(sql`DROP TABLE IF EXISTS comments CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS posts CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS profiles CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);

  // Create tables
  await db.execute(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    age INTEGER
  )`);

  await db.execute(sql`CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    bio TEXT,
    avatar TEXT
  )`);

  await db.execute(sql`CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE
  )`);

  await db.execute(sql`CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL
  )`);

  // Insert test data
  await db.execute(sql`INSERT INTO users (id, name, email, age) VALUES 
    (1, 'John Doe', 'john@example.com', 30),
    (2, 'Jane Smith', 'jane@example.com', 25),
    (3, 'Bob Johnson', 'bob@example.com', 35)`);

  await db.execute(sql`INSERT INTO profiles (id, user_id, bio, avatar) VALUES 
    (1, 1, 'Software developer', 'avatar1.jpg'),
    (2, 2, 'Designer', 'avatar2.jpg')`);

  await db.execute(sql`INSERT INTO posts (id, user_id, title, content, published) VALUES 
    (1, 1, 'First Post', 'Content 1', TRUE),
    (2, 1, 'Second Post', 'Content 2', FALSE),
    (3, 2, 'Design Tips', 'Content 3', TRUE)`);

  await db.execute(sql`INSERT INTO comments (id, post_id, user_id, content) VALUES 
    (1, 1, 2, 'Great post!'),
    (2, 1, 3, 'I agree'),
    (3, 3, 1, 'Nice design tips')`);
}

/**
 * Create a Drizzle adapter configured for PostgreSQL testing
 */
export function createPostgresAdapter(
  db: PostgresJsDatabase<typeof schema>
): DrizzleAdapter<typeof schema, 'postgres'> {
  const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
    db: db as unknown as DrizzleDatabase<'postgres'>,
    schema,
    driver: 'postgres',
    autoDetectRelationships: true,
    relations: relationsSchema,
  };

  return new DrizzleAdapterClass(config);
}

/**
 * Close PostgreSQL database connection
 */
export async function closePostgresDatabase(client: ReturnType<typeof postgres>): Promise<void> {
  if (client) {
    await client.end();
  }
}

/**
 * ============================================================================
 * MySQL Test Fixtures
 * ============================================================================
 */

/**
 * Create a MySQL database connection for testing
 */
export async function createMySQLDatabase(connectionString: string): Promise<{
  db: MySql2Database<typeof schema>;
  connection: mysql.Connection;
}> {
  const connection = await mysql.createConnection({
    uri: connectionString,
  });

  // Create database if it doesn't exist - use query for DDL
  await connection.query('CREATE DATABASE IF NOT EXISTS better_tables_test');
  await connection.query('USE better_tables_test');

  const db = drizzleMysql(connection) as MySql2Database<typeof schema>;
  return { db, connection };
}

/**
 * Setup MySQL test database with tables and initial data
 */
export async function setupMySQLDatabase(connection: mysql.Connection): Promise<void> {
  // Drop tables if they exist (for clean test runs) - use query for DDL
  await connection.query('DROP TABLE IF EXISTS comments');
  await connection.query('DROP TABLE IF EXISTS posts');
  await connection.query('DROP TABLE IF EXISTS profiles');
  await connection.query('DROP TABLE IF EXISTS users');

  // Create tables - use query for DDL
  await connection.query(`CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    age INT
  )`);

  await connection.query(`CREATE TABLE profiles (
    id INT PRIMARY KEY,
    user_id INT NOT NULL,
    bio TEXT,
    avatar VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await connection.query(`CREATE TABLE posts (
    id INT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await connection.query(`CREATE TABLE comments (
    id INT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Insert test data
  await connection.query(`INSERT INTO users (id, name, email, age) VALUES 
    (1, 'John Doe', 'john@example.com', 30),
    (2, 'Jane Smith', 'jane@example.com', 25),
    (3, 'Bob Johnson', 'bob@example.com', 35)`);

  await connection.query(`INSERT INTO profiles (id, user_id, bio, avatar) VALUES 
    (1, 1, 'Software developer', 'avatar1.jpg'),
    (2, 2, 'Designer', 'avatar2.jpg')`);

  await connection.query(`INSERT INTO posts (id, user_id, title, content, published) VALUES 
    (1, 1, 'First Post', 'Content 1', TRUE),
    (2, 1, 'Second Post', 'Content 2', FALSE),
    (3, 2, 'Design Tips', 'Content 3', TRUE)`);

  await connection.query(`INSERT INTO comments (id, post_id, user_id, content) VALUES 
    (1, 1, 2, 'Great post!'),
    (2, 1, 3, 'I agree'),
    (3, 3, 1, 'Nice design tips')`);
}

/**
 * Create a Drizzle adapter configured for MySQL testing
 */
export function createMySQLAdapter(
  db: MySql2Database<typeof schema>
): DrizzleAdapter<typeof schema, 'mysql'> {
  const config: DrizzleAdapterConfig<typeof schema, 'mysql'> = {
    db: db as unknown as DrizzleDatabase<'mysql'>,
    schema,
    driver: 'mysql',
    autoDetectRelationships: true,
    relations: relationsSchema,
  };

  return new DrizzleAdapterClass(config);
}

/**
 * Close MySQL database connection
 */
export async function closeMySQLDatabase(connection: mysql.Connection): Promise<void> {
  if (connection) {
    await connection.end();
  }
}

/**
 * ============================================================================
 * Legacy Aliases (for backward compatibility with existing tests)
 * ============================================================================
 */

export const createTestDatabase = createSQLiteDatabase;
export const setupTestDatabase = setupSQLiteDatabase;
export const createTestAdapter = createSQLiteAdapter;
export const closeDatabase = closeSQLiteDatabase;
