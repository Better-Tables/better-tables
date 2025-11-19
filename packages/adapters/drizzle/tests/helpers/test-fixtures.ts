/**
 * Shared test fixtures for database setup and teardown across all database types
 */

import { Database } from 'bun:sqlite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleSQLite } from 'drizzle-orm/bun-sqlite';

import type { MySql2Database } from 'drizzle-orm/mysql2';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';

import mysql from 'mysql2/promise';
import postgres from 'postgres';

import type { DrizzleAdapter } from '../../src/drizzle-adapter';
import { DrizzleAdapter as DrizzleAdapterClass } from '../../src/drizzle-adapter';

import type { DrizzleAdapterConfig, DrizzleDatabase } from '../../src/types';
import { relationsSchema, schema } from './test-schema';

/**
 * Bun SQLite Drizzle type
 */
export type BunSQLiteDatabase = ReturnType<typeof drizzleSQLite<typeof schema>>;

/**
 * =============================================================================
 * SQLite Test Fixtures
 * =============================================================================
 */

export function createSQLiteDatabase(): {
  db: BunSQLiteDatabase;
  sqlite: Database;
} {
  const sqlite = new Database(':memory:');

  // Key: explicitly use generic — no casting needed!
  const db = drizzleSQLite<typeof schema>(sqlite, { schema });

  return { db, sqlite };
}

export async function setupSQLiteDatabase(db: BunSQLiteDatabase): Promise<void> {
  await db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      age INTEGER,
      created_at INTEGER
    );
  `);

  await db.run(`
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      bio TEXT,
      avatar TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.run(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      published INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.run(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const now = Date.now();

  await db.run(`
    INSERT INTO users (id, name, email, age, created_at) VALUES
      (1, 'John Doe', 'john@example.com', 30, ${now}),
      (2, 'Jane Smith', 'jane@example.com', 25, ${now}),
      (3, 'Bob Johnson', 'bob@example.com', 35, ${now});
  `);

  await db.run(`
    INSERT INTO profiles (id, user_id, bio, avatar) VALUES
      (1, 1, 'Software developer', 'avatar1.jpg'),
      (2, 2, 'Designer', 'avatar2.jpg');
  `);

  await db.run(`
    INSERT INTO posts (id, user_id, title, content, published) VALUES
      (1, 1, 'First Post', 'Content 1', 1),
      (2, 1, 'Second Post', 'Content 2', 0),
      (3, 2, 'Design Tips', 'Content 3', 1);
  `);

  await db.run(`
    INSERT INTO comments (id, post_id, user_id, content) VALUES
      (1, 1, 2, 'Great post!'),
      (2, 1, 3, 'I agree'),
      (3, 3, 1, 'Nice design tips');
  `);
}

export function createSQLiteAdapter(
  db: BunSQLiteDatabase
): DrizzleAdapter<typeof schema, 'sqlite'> {
  /**
   * ⚠️ NOTE ABOUT THIS CAST
   * ---------------------------------------------------------------
   * The Drizzle adapter typing currently assumes that the "sqlite"
   * driver always uses BetterSQLite3 (drizzle-orm/better-sqlite3).
   *
   * However, in the test suite we use Bun's SQLite implementation
   * (`bun:sqlite` + `drizzle-orm/bun-sqlite`), which produces a different
   * database instance type.
   *
   * To keep the adapter typing compatible — without modifying the
   * adapter's public API — we cast the Bun SQLite database to the
   * BetterSQLite3-based `DrizzleDatabase<'sqlite'>` type.
   *
   * This is safe **only** because:
   *  - the tests exercise high-level Drizzle operations
   *  - Drizzle provides the same query API for both drivers
   *  - no driver-specific methods are used
   *
   * If in the future we add first-class support for Bun SQLite to the
   * adapter, this cast should be removed and replaced with a dedicated
   * `bun_sqlite` driver type in DatabaseTypeMap.
   */
  const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema,
    driver: 'sqlite',
    autoDetectRelationships: true,
    relations: relationsSchema,
  };

  return new DrizzleAdapterClass(config);
}


export function closeSQLiteDatabase(sqlite: Database): void {
  sqlite.close();
}


/**
 * ============================================================================
 * PostgreSQL Test Fixtures
 * ============================================================================
 */

/**
 * Parse PostgreSQL connection string to extract database name
 */
function parsePostgresConnectionString(connectionString: string): {
  database: string;
  baseUrl: string;
} {
  const url = new URL(connectionString);
  const database = url.pathname.slice(1) || 'postgres';
  url.pathname = '/postgres'; // Connect to default postgres database first
  return { database, baseUrl: url.toString() };
}

/**
 * Escape PostgreSQL identifier (database name, table name, etc.)
 * Simple escaping for test purposes - wraps in double quotes
 */
function escapeIdentifier(identifier: string): string {
  // Replace double quotes with escaped double quotes and wrap in quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Ensure PostgreSQL database exists (drops if exists, then creates)
 * Returns the database name
 */
export async function ensurePostgresDatabase(connectionString: string): Promise<string> {
  const { database: databaseName, baseUrl } = parsePostgresConnectionString(connectionString);

  // Connect to default postgres database to manage the test database
  const adminClient = postgres(baseUrl, {
    max: 1,
    onnotice: () => {},
  });

  try {
    // Terminate all connections to the database before dropping
    await adminClient`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = ${databaseName}
        AND pid <> pg_backend_pid()
    `.catch(() => {
      // Ignore errors if database doesn't exist or has no connections
    });

    // Drop database if it exists (clean slate)
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${escapeIdentifier(databaseName)}`);

    // Create the database
    await adminClient.unsafe(`CREATE DATABASE ${escapeIdentifier(databaseName)}`);
  } finally {
    await adminClient.end();
  }

  return databaseName;
}

/**
 * Create a PostgreSQL database connection for testing
 * Assumes the database already exists (use ensurePostgresDatabase first)
 */
export function createPostgresDatabase(connectionString: string): {
  db: PostgresJsDatabase<typeof schema>;
  client: ReturnType<typeof postgres>;
  databaseName: string;
} {
  const { database: databaseName } = parsePostgresConnectionString(connectionString);

  // Connect to the test database
  const client = postgres(connectionString, {
    max: 1,
    // Suppress NOTICE messages (e.g., "table does not exist, skipping" during DROP TABLE IF EXISTS)
    onnotice: () => {},
  });
  const db = drizzlePostgres(client) as PostgresJsDatabase<typeof schema>;
  return { db, client, databaseName };
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
    age INTEGER,
    created_at TIMESTAMP
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
  const now = new Date();
  // Convert Date to ISO string for PostgreSQL compatibility
  const nowTimestamp = now.toISOString();
  await db.execute(sql`INSERT INTO users (id, name, email, age, created_at) VALUES 
    (1, 'John Doe', 'john@example.com', 30, ${nowTimestamp}),
    (2, 'Jane Smith', 'jane@example.com', 25, ${nowTimestamp}),
    (3, 'Bob Johnson', 'bob@example.com', 35, ${nowTimestamp})`);

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
 * Drop PostgreSQL test database (cleanup after all tests)
 */
export async function dropPostgresDatabase(
  connectionString: string,
  databaseName: string
): Promise<void> {
  const { baseUrl } = parsePostgresConnectionString(connectionString);
  const adminClient = postgres(baseUrl, {
    max: 1,
    onnotice: () => {},
  });

  try {
    // Terminate all connections to the database before dropping
    await adminClient`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = ${databaseName}
        AND pid <> pg_backend_pid()
    `;

    // Drop the database
    // Note: DROP DATABASE cannot be parameterized, so we escape the identifier
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${escapeIdentifier(databaseName)}`);
  } finally {
    await adminClient.end();
  }
}

/**
 * ============================================================================
 * MySQL Test Fixtures
 * ============================================================================
 */

/**
 * Parse MySQL connection string to extract database name
 */
function parseMySQLConnectionString(connectionString: string): {
  database: string;
  baseUrl: string;
} {
  const url = new URL(connectionString);
  const database = url.pathname.slice(1) || 'mysql';
  // Create base URL without database name (connect to default mysql database)
  url.pathname = '';
  const baseUrl = url.toString().replace(/\/$/, '');
  return { database, baseUrl };
}

/**
 * Escape MySQL identifier (database name, table name, etc.)
 * Simple escaping for test purposes - wraps in backticks
 */
function escapeMySQLIdentifier(identifier: string): string {
  // Replace backticks with escaped backticks and wrap in backticks
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * Ensure MySQL database exists (drops if exists, then creates)
 * Returns the database name
 */
export async function ensureMySQLDatabase(connectionString: string): Promise<string> {
  const { database: databaseName, baseUrl } = parseMySQLConnectionString(connectionString);

  // Connect without specifying database to manage it
  const adminConnection = await mysql.createConnection({
    uri: baseUrl,
  });

  try {
    // Drop database if it exists (clean slate)
    await adminConnection.query(`DROP DATABASE IF EXISTS ${escapeMySQLIdentifier(databaseName)}`);

    // Create the database
    await adminConnection.query(`CREATE DATABASE ${escapeMySQLIdentifier(databaseName)}`);
  } finally {
    await adminConnection.end();
  }

  return databaseName;
}

/**
 * Create a MySQL database connection for testing
 * Assumes the database already exists (use ensureMySQLDatabase first)
 */
export async function createMySQLDatabase(connectionString: string): Promise<{
  db: MySql2Database<typeof schema>;
  connection: mysql.Connection;
  databaseName: string;
}> {
  const { database: databaseName } = parseMySQLConnectionString(connectionString);

  // Connect to the specific database
  const connection = await mysql.createConnection({
    uri: connectionString,
  });

  // Use the database
  await connection.query(`USE ${escapeMySQLIdentifier(databaseName)}`);

  const db = drizzleMysql(connection) as MySql2Database<typeof schema>;
  return { db, connection, databaseName };
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
    age INT,
    created_at TIMESTAMP
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
  const now = new Date();
  const nowTimestamp = now.toISOString().slice(0, 19).replace('T', ' '); // MySQL datetime format
  await connection.query(`INSERT INTO users (id, name, email, age, created_at) VALUES 
    (1, 'John Doe', 'john@example.com', 30, '${nowTimestamp}'),
    (2, 'Jane Smith', 'jane@example.com', 25, '${nowTimestamp}'),
    (3, 'Bob Johnson', 'bob@example.com', 35, '${nowTimestamp}')`);

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
 * Drop MySQL test database (cleanup after all tests)
 */
export async function dropMySQLDatabase(
  connectionString: string,
  databaseName: string
): Promise<void> {
  const { baseUrl } = parseMySQLConnectionString(connectionString);
  const adminConnection = await mysql.createConnection({
    uri: baseUrl,
  });

  try {
    // Drop the database
    await adminConnection.query(`DROP DATABASE IF EXISTS ${escapeMySQLIdentifier(databaseName)}`);
  } finally {
    await adminConnection.end();
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
