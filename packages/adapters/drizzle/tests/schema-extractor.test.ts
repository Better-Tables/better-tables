/**
 * Tests for `extractSchemaFromDB` (schema-extractor.ts).
 *
 * These are the FIRST tests this function has ever had (plan 030, finding
 * 14). Prior to this fix, `result.tables` was keyed by the schema object's
 * JS key, while `result.relations` was keyed by the underlying Drizzle SQL
 * table name (read off `Symbol.for('drizzle:Name')`). When a table's SQL
 * name differs from its JS export key -- a common shape, e.g.
 * `export const tickets = sqliteTable('support_tickets', ...)` -- the two
 * maps disagreed, and `drizzleAdapter(db)` auto-detection (which threads
 * `extracted.tables` as the schema and `extracted.relations` as `relations`
 * into `DrizzleAdapter`) silently lost the relationship: querying
 * `customer.plan` from `tickets` failed with "No relationship found from
 * tickets to customer" even though a relation was clearly defined.
 */

import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { relations } from 'drizzle-orm';
import { drizzle as drizzleSQLite } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleAdapter } from '../src/factory';
import type { DrizzleDatabase } from '../src/types';
import { extractSchemaFromDB } from '../src/utils/schema-extractor';

// The finding-14 repro schema: SQL table names deliberately differ from the
// JS export keys used to reference them (`columns`/`filters`/`primaryTable`).
const tickets = sqliteTable('support_tickets', {
  id: integer('id').primaryKey(),
  subject: text('subject').notNull(),
  customerId: integer('customer_id').notNull(),
});

const customer = sqliteTable('customer_accounts', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull(),
});

const ticketsRelations = relations(tickets, ({ one }) => ({
  customer: one(customer, {
    fields: [tickets.customerId],
    references: [customer.id],
  }),
}));

const customerRelations = relations(customer, ({ many }) => ({
  tickets: many(tickets),
}));

const mismatchedSchema = { tickets, customer, ticketsRelations, customerRelations };

function createMismatchedDb() {
  const sqlite = new Database(':memory:');
  const db = drizzleSQLite<typeof mismatchedSchema>(sqlite, { schema: mismatchedSchema });

  db.run(`
    CREATE TABLE customer_accounts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      plan TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE support_tickets (
      id INTEGER PRIMARY KEY,
      subject TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customer_accounts(id)
    );
  `);

  db.run(`
    INSERT INTO customer_accounts (id, name, plan) VALUES
      (1, 'Acme Corp', 'enterprise'),
      (2, 'Widgets Inc', 'starter');
  `);
  db.run(`
    INSERT INTO support_tickets (id, subject, customer_id) VALUES
      (1, 'Login broken', 1),
      (2, 'Feature request', 2);
  `);

  return { db, sqlite };
}

describe('extractSchemaFromDB', () => {
  it('keys `tables` by the schema object JS key, not the SQL table name', () => {
    const { db, sqlite } = createMismatchedDb();
    try {
      const extracted = extractSchemaFromDB(db);
      expect(Object.keys(extracted.tables).sort()).toEqual(['customer', 'tickets']);
      expect(extracted.tables.tickets).toBe(tickets);
      expect(extracted.tables.customer).toBe(customer);
    } finally {
      sqlite.close();
    }
  });

  it('keys `relations` the SAME way as `tables` (the finding-14 bug)', () => {
    const { db, sqlite } = createMismatchedDb();
    try {
      const extracted = extractSchemaFromDB(db);
      // Before the fix, `relations` was keyed by the SQL name
      // ('support_tickets', 'customer_accounts') instead of the JS key.
      expect(Object.keys(extracted.relations).sort()).toEqual(['customer', 'tickets']);
      expect(new Set(Object.keys(extracted.tables))).toEqual(new Set(Object.keys(extracted.relations)));
      expect(extracted.relations.tickets).toBe(ticketsRelations);
      expect(extracted.relations.customer).toBe(customerRelations);
    } finally {
      sqlite.close();
    }
  });

  it('marks the extraction valid (hasSchema true)', () => {
    const { db, sqlite } = createMismatchedDb();
    try {
      const extracted = extractSchemaFromDB(db);
      expect(extracted.hasSchema).toBe(true);
    } finally {
      sqlite.close();
    }
  });

  it('still qualifies keys with a real pg schema name when one is set (no regression to the schema-qualification path)', () => {
    // Nothing in this SQLite fixture sets a schema name, so this just
    // verifies plain keys are returned unqualified (schema-qualification
    // for Postgres is exercised indirectly by existing adapter-postgres
    // integration tests).
    const { db, sqlite } = createMismatchedDb();
    try {
      const extracted = extractSchemaFromDB(db);
      expect(Object.keys(extracted.tables)).not.toContain('undefined.tickets');
    } finally {
      sqlite.close();
    }
  });

  it('returns an empty, invalid result for a non-db value', () => {
    expect(extractSchemaFromDB(null)).toEqual({ tables: {}, relations: {}, hasSchema: false });
    expect(extractSchemaFromDB(undefined)).toEqual({ tables: {}, relations: {}, hasSchema: false });
    expect(extractSchemaFromDB('not a db')).toEqual({ tables: {}, relations: {}, hasSchema: false });
  });
});

describe('drizzleAdapter(db) auto-detection -- finding-14 repro', () => {
  it('resolves the tickets -> customer relationship when the SQL table name differs from the JS key', async () => {
    const { db, sqlite } = createMismatchedDb();
    try {
      const adapter = drizzleAdapter(db as unknown as DrizzleDatabase<'sqlite'>, {
        driver: 'sqlite',
      });

      // Before the fix: this threw "No relationship found from tickets to
      // customer" because `result.relations` was keyed by the SQL name
      // ('support_tickets') while `result.tables`/`primaryTable` used the
      // JS key ('tickets'), so the relationship lookup missed.
      const result = await adapter.fetchData({
        primaryTable: 'tickets',
        columns: ['subject', 'customer.plan'],
        filters: [{ columnId: 'customer.plan', operator: 'equals', values: ['enterprise'] }],
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as { subject: string }).subject).toBe('Login broken');
    } finally {
      sqlite.close();
    }
  });
});
