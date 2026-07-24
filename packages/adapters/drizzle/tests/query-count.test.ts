/**
 * Plan 063 Step 2 — Tier 1 query-count + plan-shape gates (SQLite, bun:sqlite).
 *
 * Pins the EXACT number of SQL statements the Drizzle adapter issues per
 * public operation, observed through drizzle-orm's `logger` seam
 * (`drizzle(sqlite, { logger })` — every adapter query runs through the
 * drizzle session, so the logger sees them all; DDL/seeding below
 * deliberately uses the raw bun:sqlite handle so it is NOT counted).
 * Also pins EXPLAIN QUERY PLAN canaries for index usage, run against the
 * SAME SQL text (and bound params) the adapter actually issued.
 *
 * Everything here is a deterministic integer or plan-shape string — no
 * timing. If a pinned count changes, that is a product-behavior change
 * (a statement added to or removed from an operation): update the number
 * in the same PR with a comment citing the plan/PR that changed it
 * (plan 063 maintenance notes — the test is the changelog).
 *
 * Characterized 2026-07-23 on this branch; every number below was verified
 * by printing the captured statements before pinning.
 */

import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { relations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import type { Logger } from 'drizzle-orm/logger';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleAdapter } from '../src/factory';

/**
 * Fixture schema: `tickets` (primary) with one many-to-one relation
 * (`tickets.agentId` → `agents`, alias `agent`) and one one-to-many
 * relation (`notes.ticketId` → `tickets`, alias `notes`), mirroring the
 * users/profiles/posts idiom in `helpers/test-schema.ts`.
 */
const agents = sqliteTable('agents', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  subject: text('subject').notNull(),
  status: text('status').notNull(),
  priority: integer('priority').notNull(),
  agentId: integer('agent_id')
    .notNull()
    .references(() => agents.id),
});

const notes = sqliteTable('notes', {
  id: integer('id').primaryKey(),
  ticketId: integer('ticket_id')
    .notNull()
    .references(() => tickets.id),
  body: text('body').notNull(),
});

const schema = { agents, tickets, notes };

const ticketsRelations = relations(tickets, ({ one, many }) => ({
  agent: one(agents, { fields: [tickets.agentId], references: [agents.id] }),
  notes: many(notes),
}));
const agentsRelations = relations(agents, ({ many }) => ({
  tickets: many(tickets),
}));
const notesRelations = relations(notes, ({ one }) => ({
  ticket: one(tickets, { fields: [notes.ticketId], references: [tickets.id] }),
}));

const relationsSchema = {
  tickets: ticketsRelations,
  agents: agentsRelations,
  notes: notesRelations,
};

type LoggedStatement = { query: string; params: unknown[] };

describe('DrizzleAdapter — query-count gates (plan 063 Step 2)', () => {
  let sqlite: Database;
  let statements: LoggedStatement[];
  let adapter: ReturnType<typeof drizzleAdapter>;

  /** Statements captured after `mark` (use `statements.length` as the mark). */
  const statementsSince = (mark: number): LoggedStatement[] => statements.slice(mark);

  /**
   * Run EXPLAIN QUERY PLAN for a statement the adapter issued, binding the
   * exact params the adapter bound, and return the plan `detail` strings.
   */
  const explainDetails = (stmt: LoggedStatement): string[] => {
    const rows = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${stmt.query}`)
      .all(...(stmt.params as (string | number)[])) as Array<{ detail: string }>;
    return rows.map((row) => String(row.detail));
  };

  beforeEach(() => {
    sqlite = new Database(':memory:');
    // DDL + deterministic seed through the RAW handle (not drizzle) so none
    // of it is counted by the logger. INDEX on `status` — the commonly
    // filtered column — is what the EXPLAIN canaries below guard.
    sqlite.exec(`
      CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        agent_id INTEGER NOT NULL REFERENCES agents(id)
      );
      CREATE TABLE notes (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        body TEXT NOT NULL
      );
      CREATE INDEX idx_tickets_status ON tickets(status);
    `);
    const insertAgent = sqlite.prepare('INSERT INTO agents (id, name) VALUES (?, ?)');
    for (let i = 1; i <= 3; i++) insertAgent.run(i, `Agent ${i}`);
    // 20 tickets: statuses cycle open/closed/pending/open → 10 open,
    // 5 closed, 5 pending; 2 notes per ticket (40 note rows).
    const statuses = ['open', 'closed', 'pending', 'open'] as const;
    const insertTicket = sqlite.prepare(
      'INSERT INTO tickets (id, subject, status, priority, agent_id) VALUES (?, ?, ?, ?, ?)'
    );
    const insertNote = sqlite.prepare('INSERT INTO notes (id, ticket_id, body) VALUES (?, ?, ?)');
    for (let i = 1; i <= 20; i++) {
      insertTicket.run(
        i,
        `Ticket ${i}`,
        statuses[(i - 1) % 4] as string,
        ((i - 1) % 5) + 1,
        ((i - 1) % 3) + 1
      );
      insertNote.run(i * 2 - 1, i, `Note ${i}a`);
      insertNote.run(i * 2, i, `Note ${i}b`);
    }

    statements = [];
    const countingLogger: Logger = {
      logQuery(query: string, params: unknown[]): void {
        statements.push({ query, params });
      },
    };
    const db = drizzle(sqlite, { schema, logger: countingLogger });
    adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      relations: relationsSchema,
      options: { defaultPrimaryTable: 'tickets', defaultMutationTable: 'tickets' },
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('statement counts per operation (exact integers)', () => {
    it('plain fetchData issues exactly 2 statements (data page + total count)', async () => {
      const mark = statements.length;
      const result = await adapter.fetchData({
        columns: ['subject', 'status', 'priority'],
        pagination: { page: 1, limit: 10 },
      });

      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(20);

      const issued = statementsSince(mark);
      // 2 = one LIMIT'd data SELECT + one `select count(*)` — executed in
      // parallel by fetchData (drizzle-adapter.ts `Promise.all`). Anything
      // above 2 here is a duplicate-query/N+1 regression.
      expect(issued).toHaveLength(2);
      expect(issued.filter((s) => /count\(/i.test(s.query))).toHaveLength(1);
    });

    it('fetchData with a many-to-one relation column still issues exactly 2 statements', async () => {
      const mark = statements.length;
      const result = await adapter.fetchData({
        columns: ['subject', 'agent.name'],
        pagination: { page: 1, limit: 10 },
      });

      expect(result.total).toBe(20);

      const issued = statementsSince(mark);
      // 2 = one LEFT JOIN data SELECT + one `count(distinct tickets.id)`
      // (the distinct-primary-key guard under joins). A many-to-one join
      // cannot fan out, so no phase split happens — the single-query path.
      expect(issued).toHaveLength(2);
      expect(issued.filter((s) => /count\(distinct/i.test(s.query))).toHaveLength(1);
      expect(issued.filter((s) => /left join "agents"/i.test(s.query))).toHaveLength(2);
    });

    it('fetchData with a one-to-many relation column issues exactly 3 statements (two-phase fan-out)', async () => {
      const mark = statements.length;
      const result = await adapter.fetchData({
        columns: ['subject', 'notes.body'],
        pagination: { page: 1, limit: 5 },
      });

      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(20);

      const issued = statementsSince(mark);
      // 3 = plan 020's two-phase fan-out pagination plus the count:
      //   1. phase 1 — DISTINCT primary-key page (GROUP BY pk … LIMIT),
      //   2. `count(distinct tickets.id)` under the join,
      //   3. phase 2 — full joined rows for exactly that page's keys
      //      (WHERE tickets.id IN (…), no LIMIT/OFFSET).
      // 4+ would mean a per-row N+1; 2 would mean the fan-out under-fill
      // fix (plan 020, ADAPTER-03) silently stopped engaging.
      expect(issued).toHaveLength(3);
      expect(issued.filter((s) => /group by "tickets"\."id"/i.test(s.query))).toHaveLength(1);
      expect(issued.filter((s) => /count\(distinct/i.test(s.query))).toHaveLength(1);
      expect(issued.filter((s) => /"tickets"\."id" in \(/i.test(s.query))).toHaveLength(1);
    });

    it('one getFacetedValues call issues exactly 1 statement', async () => {
      const mark = statements.length;
      const facets = await adapter.getFacetedValues('status');

      expect(facets.get('open')).toBe(10);
      expect(facets.get('closed')).toBe(5);
      expect(facets.get('pending')).toBe(5);

      // 1 = a single GROUP BY count aggregate (top-100 LIMIT'd, plan 040).
      expect(statementsSince(mark)).toHaveLength(1);
    });

    it('one getMinMaxValues call issues exactly 1 statement', async () => {
      const mark = statements.length;
      const [min, max] = await adapter.getMinMaxValues('priority');

      expect(min).toBe(1);
      expect(max).toBe(5);

      // 1 = a single `select min(…), max(…)` — both bounds in one query.
      expect(statementsSince(mark)).toHaveLength(1);
    });

    it('a repeated identical fetchData issues 0 statements (plan 040 LRU cache hit)', async () => {
      await adapter.fetchData({
        columns: ['subject', 'status', 'priority'],
        pagination: { page: 1, limit: 10 },
      });

      const mark = statements.length;
      const result = await adapter.fetchData({
        columns: ['subject', 'status', 'priority'],
        pagination: { page: 1, limit: 10 },
      });

      expect(result.data).toHaveLength(10);
      expect(result.meta?.cached).toBe(true);

      // 0 = the bounded LRU cache (plan 040) is DEFAULT-ON (5 min TTL,
      // maxSize 500) and identical params produce an identical cache key.
      // Any statement here means the default cache stopped covering
      // fetchData — the exact regression class plan 040 fixed.
      expect(statementsSince(mark)).toHaveLength(0);
    });

    it('a write invalidates the cache: updateRecord = 1 statement, next fetchData re-queries (2)', async () => {
      const params = {
        columns: ['subject', 'status', 'priority'],
        pagination: { page: 1, limit: 10 },
      };
      await adapter.fetchData(params);

      let mark = statements.length;
      await adapter.updateRecord('1', { status: 'closed' });
      // 1 = a single `UPDATE … RETURNING` (SQLite supports RETURNING, so
      // no follow-up SELECT is needed to echo the updated row).
      expect(statementsSince(mark)).toHaveLength(1);

      mark = statements.length;
      const result = await adapter.fetchData(params);
      // 2 = data + count again: updateRecord calls cache.invalidate(), so
      // the identical params MISS. 0 here would mean stale-after-write.
      expect(statementsSince(mark)).toHaveLength(2);
      expect(result.meta?.cached).toBe(false);
      const updated = (result.data as Array<{ id: number; status: string }>).find(
        (row) => row.id === 1
      );
      expect(updated?.status).toBe('closed');
    });
  });

  describe('EXPLAIN QUERY PLAN canaries (run on the exact SQL the adapter issued)', () => {
    // Format note: bun 1.3.x's vendored SQLite prints "SEARCH tickets …";
    // older SQLites print "SEARCH TABLE tickets …" — the regexes accept
    // both so a bun bump doesn't false-fail the canary.

    it('a fetchData filtered on the indexed status column SEARCHes via idx_tickets_status (no full scan)', async () => {
      const mark = statements.length;
      const result = await adapter.fetchData({
        columns: ['subject', 'status', 'priority'],
        filters: [{ columnId: 'status', type: 'option', operator: 'isAnyOf', values: ['open'] }],
        pagination: { page: 1, limit: 10 },
      });
      expect(result.total).toBe(10);

      const issued = statementsSince(mark);
      expect(issued).toHaveLength(2); // filtered data + filtered count

      // Why this shape matters: filtering on a facet/status column is the
      // hottest adapter path in the demos. If the WHERE clause ever stops
      // being sargable (e.g. wrapped in a function/collation change), the
      // plan flips to "SCAN tickets" and every filtered fetch goes O(n).
      const dataStmt = issued.find((s) => !/count\(/i.test(s.query));
      expect(dataStmt).toBeDefined();
      const dataPlan = explainDetails(dataStmt as LoggedStatement);
      expect(
        dataPlan.some((d) =>
          /^SEARCH (TABLE )?tickets USING (COVERING )?INDEX idx_tickets_status/.test(d)
        )
      ).toBe(true);
      expect(dataPlan.some((d) => /^SCAN (TABLE )?tickets$/.test(d))).toBe(false);

      // The paired count query must use the same index — as a covering
      // index it never touches the table at all.
      const countStmt = issued.find((s) => /count\(/i.test(s.query));
      expect(countStmt).toBeDefined();
      const countPlan = explainDetails(countStmt as LoggedStatement);
      expect(
        countPlan.some((d) =>
          /^SEARCH (TABLE )?tickets USING (COVERING )?INDEX idx_tickets_status/.test(d)
        )
      ).toBe(true);
      expect(countPlan.some((d) => /^SCAN (TABLE )?tickets$/.test(d))).toBe(false);
    });

    it('a many-to-one join probes the joined table by INTEGER PRIMARY KEY, never full-scanning it', async () => {
      const mark = statements.length;
      await adapter.fetchData({
        columns: ['subject', 'agent.name'],
        pagination: { page: 1, limit: 10 },
      });

      const dataStmt = statementsSince(mark).find((s) => !/count\(/i.test(s.query));
      expect(dataStmt).toBeDefined();
      const plan = explainDetails(dataStmt as LoggedStatement);

      // Why this shape matters: the LEFT JOIN's ON condition targets the
      // agents PK. If join planning ever emits a non-PK condition (alias
      // drift, quoting bug), SQLite degrades to "SCAN agents" per ticket
      // row — the classic O(n×m) join. Scanning `tickets` itself is fine
      // here (unfiltered pagination walks the primary table by design).
      expect(plan.some((d) => /^SEARCH (TABLE )?agents USING INTEGER PRIMARY KEY/.test(d))).toBe(
        true
      );
      expect(plan.some((d) => /^SCAN (TABLE )?agents/.test(d))).toBe(false);
    });

    it('a facet count on the indexed status column walks the covering index, not the table', async () => {
      const mark = statements.length;
      await adapter.getFacetedValues('status');

      const facetStmt = statementsSince(mark)[0];
      expect(facetStmt).toBeDefined();
      const plan = explainDetails(facetStmt as LoggedStatement);

      // Why this shape matters: facets GROUP BY the column over the WHOLE
      // table on every filter commit. With the index present SQLite
      // satisfies the grouping via "SCAN … USING COVERING INDEX
      // idx_tickets_status" (index-only, pre-grouped — no row lookups, no
      // GROUP BY temp b-tree). Losing the covering-index scan silently
      // makes every facet refresh a full-table scan + sort.
      // (A temp b-tree for ORDER BY `count(*) desc` remains — ordering by
      // an aggregate can't use an index; that part is expected.)
      expect(plan.some((d) => /USING COVERING INDEX idx_tickets_status/.test(d))).toBe(true);
      expect(plan.some((d) => /^SCAN (TABLE )?tickets$/.test(d))).toBe(false);
      expect(plan.some((d) => /USE TEMP B-TREE FOR GROUP BY/.test(d))).toBe(false);
    });
  });
});
