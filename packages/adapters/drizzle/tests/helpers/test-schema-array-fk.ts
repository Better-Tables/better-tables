/**
 * Test schema with array foreign keys for testing array FK support
 */

import { json, mysqlTable, varchar as mysqlVarchar } from 'drizzle-orm/mysql-core';
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema with array foreign keys (stored as JSON)
 */
export const eventsSqlite = sqliteTable('events', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  organizerId: text('organizer_id'), // JSON array of IDs
  tagIds: text('tag_ids'), // JSON array of IDs
});

export const usersSqlite = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const tagsSqlite = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

/**
 * PostgreSQL schema with native array foreign keys
 */
export const eventsPg = pgTable('events', {
  id: uuid('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  organizerId: uuid('organizer_id')
    .array()
    .references(() => usersPg.id),
  tagIds: uuid('tag_ids')
    .array()
    .references(() => tagsPg.id),
});

export const usersPg = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

export const tagsPg = pgTable('tags', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

/**
 * MySQL schema with JSON array foreign keys
 */
export const eventsMysql = mysqlTable('events', {
  id: mysqlVarchar('id', { length: 36 }).primaryKey(),
  title: mysqlVarchar('title', { length: 255 }).notNull(),
  organizerId: json('organizer_id'), // JSON array of IDs
  tagIds: json('tag_ids'), // JSON array of IDs
});

export const usersMysql = mysqlTable('users', {
  id: mysqlVarchar('id', { length: 36 }).primaryKey(),
  name: mysqlVarchar('name', { length: 255 }).notNull(),
  email: mysqlVarchar('email', { length: 255 }).notNull(),
});

export const tagsMysql = mysqlTable('tags', {
  id: mysqlVarchar('id', { length: 36 }).primaryKey(),
  name: mysqlVarchar('name', { length: 255 }).notNull(),
});

export const schemaSqlite = { events: eventsSqlite, users: usersSqlite, tags: tagsSqlite };
export const schemaPg = { events: eventsPg, users: usersPg, tags: tagsPg };
export const schemaMysql = { events: eventsMysql, users: usersMysql, tags: tagsMysql };

/**
 * Mock array column objects for testing
 */
export function createMockArrayColumn(options: {
  hasArraySymbol?: boolean;
  hasDataType?: boolean;
  hasForeignKey?: boolean;
  hasReferenceFunction?: boolean; // New: function-based .references() pattern
  fkTable?: unknown;
  fkColumn?: unknown;
}): Record<string, unknown> {
  const column: Record<string, unknown> = {};

  if (options.hasArraySymbol) {
    (column as Record<symbol, unknown>)[Symbol.for('drizzle:Array')] = true;
  }

  if (options.hasDataType) {
    column.dataType = 'array';
  }

  const metaSymbol = Symbol.for('drizzle:ColumnMetadata');
  const metadata: Record<string, unknown> = {};

  if (options.hasForeignKey) {
    metadata.foreignKeys = [
      {
        table: options.fkTable || { _name: 'users' },
        column: options.fkColumn || { _name: 'id' },
      },
    ];
  }

  // Test function-based .references() pattern
  if (options.hasReferenceFunction && options.fkColumn) {
    // Create a mock reference function that returns the column object
    metadata.reference = () => options.fkColumn;
  }

  if (Object.keys(metadata).length > 0) {
    (column as Record<symbol, unknown>)[metaSymbol] = metadata;
  }

  return column;
}
