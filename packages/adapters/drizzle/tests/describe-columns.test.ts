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
  integer as pgInteger,
  jsonb as pgJsonb,
  pgEnum,
  pgTable,
  text as pgText,
  timestamp as pgTimestamp,
} from 'drizzle-orm/pg-core';
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { AnyColumnType, AnyTableType } from '../src/types';
import {
  describeTableColumns,
  isTimestampDrizzleColumn,
} from '../src/utils/drizzle-schema-utils';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
} from './helpers/test-fixtures';

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
      const specs = describeTableColumns(sqliteTickets as unknown as AnyTableType);
      const byField = bySpecField(specs);
      // blob() has dataType 'buffer' — no mapping, total fallback to text.
      expect(byField.attachment?.columnType).toBe('text');
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
    // `foreignKey` carries through the EXISTING getTableColumns introspection
    // (drizzle-orm keeps FK metadata off the runtime column object, so it
    // reports false here — pre-existing behavior, asserted so a drizzle
    // upgrade that starts surfacing it shows up as a deliberate change).
    expect(byField.userId?.foreignKey).toBe(false);
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
