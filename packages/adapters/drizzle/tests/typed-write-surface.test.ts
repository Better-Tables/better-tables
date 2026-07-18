/**
 * Plan 047: instance write surface injects an explicit mutation table so a
 * multi-table schema does not rely on defaultMutationTable.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { betterTables, defineTableRow } from '@better-tables/core';
import { Database } from 'bun:sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { drizzleAdapter } from '../src/factory';

const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject: text('subject').notNull(),
});

const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

const schema = { tickets, customers };

interface TicketRow {
  id: number;
  subject: string;
}

interface CustomerRow {
  id: number;
  name: string;
}

describe('Plan 047 — typed write surface on multi-table drizzle', () => {
  let sqlite: Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    db.run(sql`CREATE TABLE tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL)`);
    db.run(sql`CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('tables.createRecord(ticketsTable, …) inserts into tickets without defaultMutationTable', async () => {
    const adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      // Intentionally NO defaultMutationTable — instance write supplies the target.
    });
    const tables = betterTables({ database: adapter });
    const ticketsTable = defineTableRow<TicketRow>()('tickets', (t) => ({
      columns: [t.text('subject')],
    }));

    const created = await tables.createRecord(ticketsTable, { subject: 'Hello' });
    expect(created.subject).toBe('Hello');

    const rows = sqlite.query('SELECT subject FROM tickets').all() as Array<{ subject: string }>;
    expect(rows).toEqual([{ subject: 'Hello' }]);
    const customerRows = sqlite.query('SELECT * FROM customers').all();
    expect(customerRows).toHaveLength(0);
  });

  it('direct adapter.createRecord still uses defaultMutationTable when set', async () => {
    const adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      options: { defaultMutationTable: 'customers' },
    });
    await adapter.createRecord({ name: 'Acme' } as Partial<CustomerRow>);
    const customerRows = sqlite.query('SELECT name FROM customers').all() as Array<{ name: string }>;
    expect(customerRows).toEqual([{ name: 'Acme' }]);
  });
});
