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

// Relations spread under their OWN export names (`customersRelations`, not
// `customers: customersRelations`) so they don't clobber the same-named table
// objects -- `drizzleAdapter()` now throws a clear SchemaError if they ever
// did (plan 030, finding 11).
const fullSchema = { ...supportSchema, customersRelations, assigneesRelations, ticketsRelations };

function buildSupportDb(sqlite: Database.Database) {
  return drizzle(sqlite, { schema: fullSchema });
}

function buildSupportTables(db: ReturnType<typeof buildSupportDb>) {
  // Zero-config: `drizzleAdapter(db)` auto-detects schema AND relations from
  // `db`, even though these tables use SQL names (`support_tickets`) that
  // differ from their JS keys (`tickets`) -- the extractor keys tables and
  // relations consistently now (plan 030, finding 14), so no explicit
  // `schema`/`relations` pass is needed.
  return betterTables({
    database: drizzleAdapter(db),
    defaults: { pageSize: 10 },
  });
}

/**
 * Why this is a lazy getter and not a module-scope `export const` (finding 13).
 *
 * MIGRATION.md's flagship pattern is a MODULE-SCOPE
 * `export const tables = betterTables({ database: drizzleAdapter(db) })` --
 * tried first, exactly like that, with `supportDb`/`supportTables`
 * constructed eagerly at import time (mirroring the doc example verbatim).
 * `bun run build --filter=@better-tables/site` then failed
 * `next build`'s "Collecting page data" step:
 *
 *   Error [SchemaError]: Unable to detect database driver from Drizzle
 *   instance. Please ensure you're passing a valid Drizzle database
 *   instance, or explicitly specify the driver: ...
 *     at .../api/tickets/route.js
 *
 * Root cause: `/api/tickets/route.ts` imports this module transitively, and
 * Next's build-time page-data-collection phase IMPORTS every route module
 * to statically analyze it -- which means a module-scope
 * `new Database(':memory:')` (better-sqlite3's native N-API binding) runs
 * DURING THE BUILD, in that collection phase's execution context, not at
 * real request time. Something about that context makes the resulting
 * `Database` instance not look like a real SQLite driver to
 * `detectDriver()` (`packages/adapters/drizzle/src/utils/driver-detector.ts`)
 * -- `drizzleAdapter()`'s auto-detection came back empty. Deferring BOTH the
 * native `Database` construction AND the `betterTables()`/`drizzleAdapter()`
 * calls into this lazy, memoized async getter (instead of top-level
 * `export const`) made the build pass -- request-time construction never
 * touches the build-time collection phase at all. This is exactly why the
 * pre-existing (non-WIP) homepage demo's `lib/db/index.ts` was ALREADY a
 * lazy async singleton, not the eager module-scope shape MIGRATION.md's own
 * example shows -- that convention wasn't stylistic, it was working around
 * this. See plans/findings/029-dx-findings.md #13.
 *
 * `defineTable<typeof supportTables>()` in `columns.tsx` still works
 * against this lazy shape because it only needs `SupportTables` as a TYPE
 * (`ReturnType<typeof buildSupportTables>`, exported below) -- `defineTable`
 * never touches the runtime instance, so it doesn't matter that the real
 * value now only exists behind this async getter.
 */
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

  // better-sqlite3 wraps a single multi-row `insert().values()` call in one
  // transaction already, so a plain batched insert (rather than a manual
  // `sqlite.transaction()`) is enough to keep 12k rows fast.
  const bulkRows = generateBulkTickets(BULK_TICKET_COUNT);
  const BATCH_SIZE = 500;
  for (let i = 0; i < bulkRows.length; i += BATCH_SIZE) {
    await db.insert(bulkTickets).values(bulkRows.slice(i, i + BATCH_SIZE));
  }

  return buildSupportTables(db);
}

/**
 * Lazy, memoized entry point to the flagship `betterTables()` instance --
 * every server-side caller (route handlers, RSC pages) awaits this instead
 * of importing a module-scope `export const` (see the note above). The
 * underlying DB connection + schema + seed only run once per server
 * lifetime, on first REQUEST, never at build time.
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
