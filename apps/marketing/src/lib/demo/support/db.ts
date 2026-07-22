import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { generateBulkTickets } from './bulk-seed';
import {
  assignees,
  assigneesRelations,
  bulkTickets,
  customers,
  customersRelations,
  supportSchema,
  tickets,
  ticketsRelations,
} from './schema';
import { supportSeed } from './seed-data';

const BULK_TICKET_COUNT = 12_000;

// Keep relation exports under their own names so they don't overwrite the
// table objects with the same keys.
const fullSchema = { ...supportSchema, customersRelations, assigneesRelations, ticketsRelations };

function buildSupportDb(sqlite: Database.Database) {
  return drizzle(sqlite, { schema: fullSchema });
}

function buildSupportTables(db: ReturnType<typeof buildSupportDb>) {
  // `drizzleAdapter(db)` picks up schema + relations from the Drizzle instance,
  // and auto-detects the sqlite driver from its method signature (minification-safe).
  return betterTables({
    database: drizzleAdapter(db),
    defaults: { pageSize: 10 },
  });
}

export type SupportTables = ReturnType<typeof buildSupportTables>;

let supportTablesInstance: SupportTables | null = null;
let seedPromise: Promise<void> | null = null;

async function initSupportTables(): Promise<SupportTables> {
  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const db = buildSupportDb(sqlite);

  await db.run(sql`CREATE TABLE support_customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    plan TEXT NOT NULL,
    region TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE support_assignees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    shift TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE support_tickets (
    id INTEGER PRIMARY KEY,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    channel TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    assignee_id INTEGER,
    sla_breached INTEGER NOT NULL DEFAULT 0,
    reopen_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES support_customers(id),
    FOREIGN KEY (assignee_id) REFERENCES support_assignees(id)
  )`);

  await db.run(sql`CREATE TABLE support_tickets_bulk (
    id INTEGER PRIMARY KEY,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    assignee_name TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  await db.insert(customers).values(supportSeed.customers);
  await db.insert(assignees).values(supportSeed.assignees);
  await db.insert(tickets).values(supportSeed.tickets);

  // Batch the 12k-row seed so inserts stay fast under better-sqlite3.
  const bulkRows = generateBulkTickets(BULK_TICKET_COUNT);
  const BATCH_SIZE = 500;
  for (let i = 0; i < bulkRows.length; i += BATCH_SIZE) {
    await db.insert(bulkTickets).values(bulkRows.slice(i, i + BATCH_SIZE));
  }

  return buildSupportTables(db);
}

/**
 * Lazy `betterTables()` singleton for the examples.
 *
 * In Next.js, construct the in-memory SQLite DB on first request — not at
 * module scope — so native driver setup does not run during `next build`
 * page-data collection. `defineTable` only needs the `SupportTables` type,
 * so column files stay safe to import from the client.
 */
export function getSupportTables(): Promise<SupportTables> {
  if (!seedPromise) {
    seedPromise = initSupportTables().then((tables) => {
      supportTablesInstance = tables;
    });
  }
  return seedPromise.then(() => {
    if (!supportTablesInstance) {
      throw new Error('Support tables failed to initialize');
    }
    return supportTablesInstance;
  });
}
