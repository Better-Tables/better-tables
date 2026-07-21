/**
 * Plan 050: `exportData` honors the current view (filters/sorting) and bounds
 * the fetch by a row cap (default `DEFAULT_EXPORT_ROW_CAP`, overridable via
 * `maxRows`). CSV formula-injection escaping must survive.
 */

import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleAdapter } from '../src/factory';

const items = sqliteTable('items', {
  id: integer('id').primaryKey(),
  category: text('category').notNull(),
  note: text('note').notNull(),
});

const schema = { items };

describe('Plan 050 — exportData', () => {
  let adapter: ReturnType<typeof drizzleAdapter>;

  beforeEach(async () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    db.run(
      sql`CREATE TABLE items (id INTEGER PRIMARY KEY, category TEXT NOT NULL, note TEXT NOT NULL)`
    );
    await db.insert(items).values([
      { id: 1, category: 'a', note: 'first' },
      { id: 2, category: 'b', note: 'second' },
      { id: 3, category: 'a', note: '=SUM(A1)' }, // formula-injection payload
      { id: 4, category: 'a', note: 'fourth' },
    ]);
    adapter = drizzleAdapter(db, {
      driver: 'sqlite',
      schema,
      options: { defaultPrimaryTable: 'items' },
    });
  });

  it('honors the current filters (exports only matching rows)', async () => {
    const result = await adapter.exportData({
      format: 'json',
      filters: [{ columnId: 'category', type: 'text', operator: 'equals', values: ['a'] }],
    });
    const rows = JSON.parse(result.data as string) as Array<{ id: number }>;
    expect(rows.map((r) => r.id).sort()).toEqual([1, 3, 4]);
  });

  it('honors the current sorting', async () => {
    const result = await adapter.exportData({
      format: 'json',
      sorting: [{ columnId: 'id', direction: 'desc' }],
    });
    const rows = JSON.parse(result.data as string) as Array<{ id: number }>;
    expect(rows.map((r) => r.id)).toEqual([4, 3, 2, 1]);
  });

  it('bounds the export by maxRows (override)', async () => {
    const result = await adapter.exportData({
      format: 'json',
      sorting: [{ columnId: 'id', direction: 'asc' }],
      maxRows: 2,
    });
    const rows = JSON.parse(result.data as string) as Array<{ id: number }>;
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it('escapes CSV formula-injection payloads', async () => {
    const result = await adapter.exportData({
      format: 'csv',
      filters: [{ columnId: 'id', type: 'number', operator: 'equals', values: [3] }],
    });
    const csv = result.data as string;
    // The `=SUM(A1)` note is neutralized with a leading quote inside the cell.
    expect(csv).toContain(`"'=SUM(A1)"`);
    expect(result.mimeType).toBe('text/csv');
    expect(result.filename).toBe('export.csv');
  });
});
