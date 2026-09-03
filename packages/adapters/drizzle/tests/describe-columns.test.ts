/**
 * describeColumns — schema-derived InferredColumnSpec inference (plan 054).
 *
 * Covers the type-mapping heart (enum → option with humanized labels,
 * timestamp family → date, array → multiOption, PK → writable: false), the
 * total-fallback (unknown dataType → text + dev warn, never throw), the
 * adapter-level read-table resolution, and memoization.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { InferredColumnSpec } from '@better-tables/core';
import {
  boolean as pgBoolean,
  pgEnum,
  integer as pgInteger,
  jsonb as pgJsonb,
  pgTable,
  text as pgText,
  timestamp as pgTimestamp,
} from 'drizzle-orm/pg-core';
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { AnyColumnType, AnyTableType } from '../src/types';
import {
  describeTableColumns,
  getTableColumns,
  isTimestampDrizzleColumn,
} from '../src/utils/drizzle-schema-utils';
import { closeDatabase, createTestAdapter, createTestDatabase } from './helpers/test-fixtures';
import { posts, users } from './helpers/test-schema';

// ---------------------------------------------------------------------------
// Fixtures: one table with enum + timestamp + array (pg), one sqlite table
// exercising the sqlite flavors (text-enum, integer-timestamp, boolean, json,
// and an unmapped blob for the total-fallback path).
// ---------------------------------------------------------------------------

const ticketStatus = pgEnum('ticket_status', ['open', 'in_progress', 'closed']);

const pgTickets = pgTable('tickets', {
  id: pgInteger('id').primaryKey(),
  subject: pgText('subject').notNull(),
  status: ticketStatus('status').notNull(),
  priority: pgText('priority', { enum: ['low', 'high'] }),
  tags: pgText('tags').array(),
  createdAt: pgTimestamp('created_at').notNull(),
  resolved: pgBoolean('resolved'),
  meta: pgJsonb('meta'),
});

const sqliteTickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  subject: text('subject').notNull(),
  status: text('status', { enum: ['open', 'closed'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  resolved: integer('resolved', { mode: 'boolean' }),
  payload: text('payload', { mode: 'json' }),
  attachment: blob('attachment'),
});

function bySpecField(specs: InferredColumnSpec[]): Record<string, InferredColumnSpec> {
  return Object.fromEntries(specs.map((spec) => [spec.field, spec]));
}

describe('describeTableColumns (plan 054)', () => {
  it('maps a pg table with enum, timestamp, and array columns to a full spec list', () => {
    const specs = describeTableColumns(pgTickets as unknown as AnyTableType);

    expect(specs.map((s) => s.field)).toEqual([
      'id',
      'subject',
      'status',
      'priority',
      'tags',
      'createdAt',
      'resolved',
      'meta',
    ]);

    const byField = bySpecField(specs);
    expect(byField.id).toEqual({
      field: 'id',
      columnType: 'number',
      label: 'Id',
      nullable: false,
      primaryKey: true,
      foreignKey: false,
      writable: false,
    });
    expect(byField.subject).toEqual({
      field: 'subject',
      columnType: 'text',
      label: 'Subject',
      nullable: false,
      primaryKey: false,
      foreignKey: false,
      writable: true,
    });
    // pgEnum column → option with humanized labels.
    expect(byField.status?.columnType).toBe('option');
    expect(byField.status?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'closed', label: 'Closed' },
    ]);
    // text(..., { enum }) column → option too.
    expect(byField.priority?.columnType).toBe('option');
    expect(byField.priority?.options).toEqual([
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' },
    ]);
    expect(byField.priority?.nullable).toBe(true);
    // Array column → multiOption (no enum options).
    expect(byField.tags?.columnType).toBe('multiOption');
    expect(byField.tags?.options).toBeUndefined();
    // Timestamp → date, humanized multi-word label.
    expect(byField.createdAt?.columnType).toBe('date');
    expect(byField.createdAt?.label).toBe('Created At');
    expect(byField.resolved?.columnType).toBe('boolean');
    expect(byField.meta?.columnType).toBe('json');
  });

  it('maps sqlite text-enum, integer-timestamp, boolean, and json columns', () => {
    const specs = describeTableColumns(sqliteTickets as unknown as AnyTableType);
    const byField = bySpecField(specs);

    expect(byField.id?.columnType).toBe('number');
    expect(byField.id?.writable).toBe(false);
    expect(byField.status?.columnType).toBe('option');
    expect(byField.status?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
    expect(byField.createdAt?.columnType).toBe('date');
    expect(byField.resolved?.columnType).toBe('boolean');
    expect(byField.payload?.columnType).toBe('json');
  });

  it('falls back to text (with a dev warn) for unmapped data types instead of throwing', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // A fresh table object, not the shared `sqliteTickets` fixture: describeTableColumns
      // memoizes per table identity, and `sqliteTickets` was already described (and cached)
      // by the previous test — reusing it here would hit the cache, skip the fallback
      // mapping code path entirely, and never call console.warn.
      const freshSqliteTickets = sqliteTable('tickets_fallback', {
        id: integer('id').primaryKey(),
        attachment: blob('attachment'),
      });

      const specs = describeTableColumns(freshSqliteTickets as unknown as AnyTableType);
      const byField = bySpecField(specs);
      // blob() has dataType 'buffer' — no mapping, total fallback to text.
      expect(byField.attachment?.columnType).toBe('text');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/attachment/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('memoizes per table but hands out copies (mutations cannot corrupt the cache)', () => {
    const first = describeTableColumns(pgTickets as unknown as AnyTableType);
    first.pop();
    const second = describeTableColumns(pgTickets as unknown as AnyTableType);
    expect(second).toHaveLength(8);
    expect(second).not.toBe(first);
  });

  it('deep-clones each spec (mutating a nested options array cannot poison the cache)', () => {
    const first = bySpecField(describeTableColumns(pgTickets as unknown as AnyTableType));
    first.status?.options?.push({ value: 'bogus', label: 'Bogus' });

    const second = bySpecField(describeTableColumns(pgTickets as unknown as AnyTableType));
    expect(second.status?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'closed', label: 'Closed' },
    ]);
    expect(second.status?.options).not.toBe(first.status?.options);
  });
});

describe('getTableColumns FK detection (plan 065 Phase 2)', () => {
  it('finds a real .references() constraint via table-level inline-FK metadata', () => {
    // `posts.userId` genuinely references `users.id` (test-schema.ts). The
    // constraint lives on the TABLE object (Symbol(drizzle:SQLiteInlineForeignKeys)),
    // never on the column itself — this is what getTableColumns now scans.
    const columns = getTableColumns(posts as unknown as AnyTableType);
    const userId = columns.find((c) => c.name === 'userId');
    expect(userId?.isForeignKey).toBe(true);
    expect(userId?.foreignKeyTable).toBe(users as unknown as AnyTableType);
    // The referenced column is `users.id` itself (reference equality).
    expect(userId?.foreignKeyColumn).toBe((users as unknown as Record<string, unknown>).id);
  });

  it('reports isForeignKey: false for a column with no .references() constraint', () => {
    const columns = getTableColumns(posts as unknown as AnyTableType);
    const title = columns.find((c) => c.name === 'title');
    expect(title?.isForeignKey).toBe(false);
    expect(title?.foreignKeyTable).toBeUndefined();
    expect(title?.foreignKeyColumn).toBeUndefined();
  });
});

describe('describeTableColumns foreignKeyTarget resolution (plan 065 Phase 2)', () => {
  it('leaves foreignKeyTarget absent when no resolver is passed (back-compat)', () => {
    const specs = describeTableColumns(posts as unknown as AnyTableType);
    const byField = bySpecField(specs);
    expect(byField.userId?.foreignKey).toBe(true);
    expect(byField.userId?.foreignKeyTarget).toBeUndefined();
  });

  it('populates foreignKeyTarget when the resolver resolves a target', () => {
    const specs = describeTableColumns(posts as unknown as AnyTableType, () => ({
      table: 'users',
      field: 'id',
    }));
    expect(bySpecField(specs).userId?.foreignKeyTarget).toEqual({ table: 'users', field: 'id' });
  });

  it('leaves foreignKeyTarget absent when the resolver returns null', () => {
    const specs = describeTableColumns(posts as unknown as AnyTableType, () => null);
    expect(bySpecField(specs).userId?.foreignKeyTarget).toBeUndefined();
  });

  it('re-resolves foreignKeyTarget on every call even though the base specs are cached', () => {
    // Regression guard: the base-spec cache is keyed by table object identity
    // alone, so a different resolver passed for the SAME table must still
    // produce a different foreignKeyTarget rather than returning a stale
    // cached one from an earlier (or absent) resolver.
    const withoutResolver = describeTableColumns(posts as unknown as AnyTableType);
    expect(bySpecField(withoutResolver).userId?.foreignKeyTarget).toBeUndefined();

    const withResolver = describeTableColumns(posts as unknown as AnyTableType, () => ({
      table: 'users',
      field: 'id',
    }));
    expect(bySpecField(withResolver).userId?.foreignKeyTarget).toEqual({
      table: 'users',
      field: 'id',
    });

    const withoutResolverAgain = describeTableColumns(posts as unknown as AnyTableType);
    expect(bySpecField(withoutResolverAgain).userId?.foreignKeyTarget).toBeUndefined();
  });
});

describe('isTimestampDrizzleColumn (shared with the predicate emitter)', () => {
  it('recognizes pg and sqlite timestamp columns, rejects plain columns', () => {
    const asColumn = (column: unknown) => column as AnyColumnType;
    expect(isTimestampDrizzleColumn(asColumn(pgTickets.createdAt))).toBe(true);
    expect(isTimestampDrizzleColumn(asColumn(sqliteTickets.createdAt))).toBe(true);
    expect(isTimestampDrizzleColumn(asColumn(pgTickets.subject))).toBe(false);
    expect(isTimestampDrizzleColumn(asColumn(sqliteTickets.resolved))).toBe(false);
  });
});

describe('DrizzleAdapter.describeColumns (read-table resolution)', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(() => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    sqlite = sqliteDb;
    // Pure schema introspection — no table setup/seeding needed.
    adapter = createTestAdapter(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('describes an explicitly named table', async () => {
    const specs = await adapter.describeColumns('posts');
    const byField = bySpecField(specs);

    expect(specs.map((s) => s.field)).toEqual(['id', 'userId', 'title', 'content', 'published']);
    expect(byField.id?.writable).toBe(false);
    // `posts.userId` genuinely references `users.id` (plan 065 Phase 2):
    // `getTableColumns` now finds the constraint via the TABLE-level inline-FK
    // metadata real Drizzle columns actually use (not the column object
    // itself, which never carried it), and `describeColumns` resolves it
    // through `relationshipDetector` back to a schema key + field name.
    expect(byField.userId?.foreignKey).toBe(true);
    expect(byField.userId?.foreignKeyTarget).toEqual({ table: 'users', field: 'id' });
    expect(byField.title?.columnType).toBe('text');
    expect(byField.title?.nullable).toBe(false);
    expect(byField.published?.columnType).toBe('boolean');
  });

  it('resolves the default table when none is given (defaultPrimaryTable)', async () => {
    // The shared fixture configures defaultPrimaryTable: 'users'.
    const specs = await adapter.describeColumns();
    expect(specs.map((s) => s.field)).toEqual(['id', 'name', 'email', 'age', 'createdAt']);
    expect(bySpecField(specs).createdAt?.columnType).toBe('date');
  });

  it('throws a schema error for a table absent from the schema', async () => {
    // The toolkit's PrimaryTableResolver throws its own SchemaError class —
    // assert on the message rather than a constructor identity across
    // packages.
    await expect(adapter.describeColumns('nope')).rejects.toThrow(
      /Primary table 'nope' not found in schema/
    );
  });
});
