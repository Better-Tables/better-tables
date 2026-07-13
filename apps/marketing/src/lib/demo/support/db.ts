import { sql } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import {
  assignees,
  assigneesRelations,
  bulkTickets,
  customers,
  customersRelations,
  supportRelationsSchema,
  supportSchema,
  tickets,
  ticketsRelations,
} from './schema';
import { supportSeed } from './seed-data';
import { generateBulkTickets } from './bulk-seed';

const BULK_TICKET_COUNT = 12_000;

// DX-FINDING-11: relations under their OWN export names for `drizzle()`'s
// schema config -- NOT a table-name-keyed relations object (which is what
// `DrizzleAdapterConfig.relations` wants instead, a DIFFERENT shape for the
// SAME underlying objects). Spreading a table-name-keyed relations object
// here would silently clobber every real table object with its same-named
// `Relations` object (object spread: later keys win) -- confirmed via
// `keyof typeof supportTables.$types.tables` resolving to only the one
// table with no matching relations entry, before this fix. See
// plans/findings/029-dx-findings.md #11. The pre-existing (non-WIP)
// `apps/marketing/src/lib/db/index.ts` has the SAME clobbering shape and
// was flagged separately rather than fixed here (out of this plan's scope
// -- see the plan 029 report).
const fullSchema = { ...supportSchema, customersRelations, assigneesRelations, ticketsRelations };

function buildSupportDb(sqlite: Database.Database) {
  return drizzle(sqlite, { schema: fullSchema });
}

function buildSupportTables(db: ReturnType<typeof buildSupportDb>) {
  return betterTables({
    // DX-FINDING-14: `drizzleAdapter(db)` with NO options -- auto-detecting
    // schema/relations from `db`'s internal state -- throws
    // `RelationshipError: No relationship found from tickets to customer`
    // even though `ticketsRelations` clearly declares that relation. Root
    // cause: `customers`/`assignees`/`tickets` are declared as
    // `sqliteTable('support_customers', {...})` etc -- the SQL table name
    // (`support_tickets`) differs from the JS export key (`tickets`), a
    // common, idiomatic Drizzle pattern (prefixing SQL names to avoid
    // collisions while keeping ergonomic JS imports). The adapter's
    // auto-extraction (`extractSchemaFromDB`,
    // `packages/adapters/drizzle/src/utils/schema-extractor.ts`) keys
    // `result.tables` by the SCHEMA OBJECT KEY (`'tickets'`) but keys
    // `result.relations` by the table's `Symbol.for('drizzle:Name')` value
    // (`'support_tickets'`, the SQL name) when the relation comes from a
    // `relations()` object in the schema bag -- confirmed directly:
    // `(tickets as any)[Symbol.for('drizzle:Name')] === 'support_tickets'`.
    // The two maps end up keyed inconsistently, so relationship lookup for
    // primary table `'tickets'` finds nothing. Passing `schema`/`relations`
    // EXPLICITLY here (instead of relying on auto-detection from `db`)
    // bypasses that symbol-based re-derivation entirely -- these two options
    // are used AS GIVEN, keyed by schema object key throughout. See
    // plans/findings/029-dx-findings.md #14.
    database: drizzleAdapter(db, {
      schema: supportSchema,
      relations: supportRelationsSchema,
    }),
    defaults: { pageSize: 10 },
  });
}

/**
 * DX-FINDING-13: MIGRATION.md's flagship pattern is a MODULE-SCOPE
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
 * of importing a module-scope `export const` (see DX-FINDING-13 above). The
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
