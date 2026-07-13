/**
 * DX note (not a plans/findings/029-dx-findings.md entry -- this is a Bun
 * runtime/native-module limitation, not a `@better-tables/*` API friction):
 * production `db.ts`/`fetch-tickets.ts` use `better-sqlite3` (works fine
 * under the real Node.js process `next dev`/`next build`/`next start`
 * spawn), but `better-sqlite3`'s native binding does not load under Bun's
 * OWN JS engine, which is what `bun test` uses directly (no Node
 * subprocess). This is the exact same limitation
 * `packages/adapters/drizzle/tests/helpers/test-fixtures.ts` documents and
 * works around package-wide: use `bun:sqlite` (`drizzle-orm/bun-sqlite`)
 * for anything executed under `bun test`, and construct `DrizzleAdapter`
 * directly (bypassing the `drizzleAdapter(db)` factory, which does real
 * driver detection that rejects a `bun:sqlite` instance) with a documented
 * type-compat cast. This file mirrors that established pattern instead of
 * exercising the production `better-sqlite3`-backed `fetchTickets()`
 * directly, reusing the SAME driver-agnostic schema/relations/seed data
 * (`./schema`, `./seed-data`) so the query/filter logic under test is
 * identical to production -- only the SQLite driver differs.
 */
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { DrizzleAdapter } from '@better-tables/adapters-drizzle';
import type { DrizzleAdapterConfig } from '@better-tables/adapters-drizzle';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import {
  assignees,
  assigneesRelations,
  customers,
  customersRelations,
  supportRelationsSchema,
  supportSchema,
  tickets,
  ticketsRelations,
} from './schema';
import type { TicketWithRelations } from './schema';
import { supportSeed } from './seed-data';
import { buildRelationshipTrail } from './relationship-trail';

// DX-FINDING-11: relations under their OWN export names for `drizzle()`'s
// schema config -- NOT `supportRelationsSchema` (table-name-keyed, which is
// what `DrizzleAdapterConfig.relations` below wants instead). Spreading
// `supportRelationsSchema` here would clobber every real table object with
// its same-named `Relations` object. See plans/findings/029-dx-findings.md #11.
const fullSchema = { ...supportSchema, customersRelations, assigneesRelations, ticketsRelations };
type TestDB = ReturnType<typeof drizzle<typeof fullSchema>>;

// `DrizzleDatabase` (the type the drizzle package's OWN internal test
// fixtures cast to) isn't part of the public `@better-tables/adapters-drizzle`
// export surface -- only `DrizzleAdapterConfig` is -- so this app-level test
// derives the equivalent type via an indexed access on the public config
// type instead of reaching into the package's internal `src/types`.
type PublicDrizzleDatabase = DrizzleAdapterConfig<typeof supportSchema, 'sqlite'>['db'];

async function createTestAdapter(): Promise<DrizzleAdapter<typeof supportSchema, 'sqlite'>> {
  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const db: TestDB = drizzle(sqlite, { schema: fullSchema });

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

  await db.insert(customers).values(supportSeed.customers);
  await db.insert(assignees).values(supportSeed.assignees);
  await db.insert(tickets).values(supportSeed.tickets);

  const config: DrizzleAdapterConfig<typeof supportSchema, 'sqlite'> = {
    // Same-shape compat cast the drizzle package's own bun:sqlite test
    // fixtures use (tests/helpers/test-fixtures.ts) -- `new DrizzleAdapter()`
    // does no driver detection, unlike the public `drizzleAdapter(db)`
    // factory, so it accepts a `bun:sqlite`-backed instance here.
    db: db as unknown as PublicDrizzleDatabase,
    // Tables-only schema -- passing the combined tables+relations object
    // (as `db.ts` does for the real `drizzle()` call, which needs relations
    // for its OWN row-type inference) here made the toolkit's table
    // filtering come up empty ("No tables found in schema"); relations for
    // JOIN detection go through the separate `relations` option instead.
    schema: supportSchema,
    relations: supportRelationsSchema,
    driver: 'sqlite',
  };
  return new DrizzleAdapter(config);
}

describe('support ticket fetch/filter pipeline (bun:sqlite fixture -- see file docblock)', () => {
  it('returns seeded tickets by default', async () => {
    const adapter = await createTestAdapter();
    const result = await adapter.fetchData({
      pagination: { page: 1, limit: 10 },
      primaryTable: 'tickets',
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
  });

  // DX-FINDING-9: omitting BOTH `columns` and `primaryTable` on this
  // multi-table schema silently resolves to `customers` (the first table in
  // schema key order), not `tickets` -- a wrong-table result with only a
  // console.warn, no thrown error. Pinned here as a regression guard for the
  // finding. See plans/findings/029-dx-findings.md #9.
  it('DX-FINDING-9: omitting primaryTable/columns on a multi-table schema silently returns the WRONG table', async () => {
    const adapter = await createTestAdapter();
    const result = await adapter.fetchData({ pagination: { page: 1, limit: 10 } });
    // This is `customers` (6 seeded rows), not `tickets` (20 seeded rows) --
    // demonstrating the footgun, not the desired behavior.
    expect(result.total).toBe(supportSeed.customers.length);
    expect(result.data[0]).toHaveProperty('company');
    expect(result.data[0]).not.toHaveProperty('subject');
  });

  // DX-FINDING-1 / DX-FINDING-8: real FilterGroupNode shape (`kind`/`logic`,
  // bare typed leaves) + a valid option operator (`is`, not `equals`). See
  // plans/findings/029-dx-findings.md #1 and #8.
  it('filters tickets by related customer plan', async () => {
    const adapter = await createTestAdapter();
    const result = await adapter.fetchData({
      pagination: { page: 1, limit: 20 },
      primaryTable: 'tickets',
      // DX-FINDING-10: `customer` is absent from result rows unless its
      // dot-path is named here, even though filtering by it (above) doesn't
      // need this. See plans/findings/029-dx-findings.md #10.
      columns: ['subject', 'customer.plan'],
      filters: {
        kind: 'group',
        logic: 'and',
        children: [
          {
            columnId: 'customer.plan',
            type: 'option',
            operator: 'is',
            values: ['enterprise'],
          },
        ],
      },
    });

    expect(result.total).toBeGreaterThan(0);
    for (const ticket of result.data) {
      expect((ticket as TicketWithRelations).customer?.plan).toBe('enterprise');
    }
  });

  it('sorts tickets by assignee team', async () => {
    const adapter = await createTestAdapter();
    const result = await adapter.fetchData({
      pagination: { page: 1, limit: 20 },
      primaryTable: 'tickets',
      columns: ['subject', 'assignee.team'],
      sorting: [{ columnId: 'assignee.team', direction: 'asc' }],
    });

    const teams = result.data
      .map((ticket) => (ticket as TicketWithRelations).assignee?.team)
      .filter(Boolean);
    const sorted = [...teams].sort();
    expect(teams).toEqual(sorted);
  });

  // Null-only filter (Option A semantics, plan 027 showcase): `includeNull:
  // true, values: []` on a text-typed leaf means "match rows where this
  // column is null" -- here, tickets with no assignee.
  it('resolves a null-only filter (assignee.name includeNull, no values) to unassigned tickets', async () => {
    const adapter = await createTestAdapter();
    const result = await adapter.fetchData({
      pagination: { page: 1, limit: 20 },
      primaryTable: 'tickets',
      columns: ['subject', 'assignee.name'],
      filters: [
        {
          columnId: 'assignee.name',
          type: 'text',
          operator: 'equals',
          values: [],
          includeNull: true,
        },
      ],
    });

    expect(result.total).toBeGreaterThan(0);
    for (const ticket of result.data) {
      expect((ticket as TicketWithRelations).assignee).toBeFalsy();
    }
  });
});

describe('buildRelationshipTrail', () => {
  it('describes relationship filters in plain language', () => {
    const trail = buildRelationshipTrail([
      {
        columnId: 'customer.plan',
        type: 'option',
        operator: 'is',
        values: ['enterprise'],
      },
      {
        columnId: 'assignee.name',
        type: 'text',
        operator: 'equals',
        values: ['Maya Chen'],
      },
    ]);

    expect(trail).toHaveLength(2);
    expect(trail[0]?.sentence).toContain('customer.plan');
    expect(trail[1]?.sentence).toContain('assignee.name');
  });
});
