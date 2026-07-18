/**
 * DrizzleAdapter.resolveCellWriteTarget (plan 055): flat ids resolve to the
 * own table, relationship paths to the REAL related table (with the alias
 * relatedIdPath and one-to-many detection), and everything a cell write
 * can't express resolves to null.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { closeDatabase, createTestAdapter, createTestDatabase } from './helpers/test-fixtures';

describe('DrizzleAdapter.resolveCellWriteTarget', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(() => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    sqlite = sqliteDb;
    // Pure introspection — no table setup/seeding needed.
    adapter = createTestAdapter(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('flat id → own-table target; primary keys are unwritable', async () => {
    expect(await adapter.resolveCellWriteTarget('name')).toEqual({
      table: 'users',
      field: 'name',
      relatedIdPath: null,
      single: true,
      writable: true,
    });
    expect(await adapter.resolveCellWriteTarget('id')).toMatchObject({
      table: 'users',
      field: 'id',
      writable: false,
    });
  });

  it('single-valued relationship path → REAL related table + alias relatedIdPath', async () => {
    expect(await adapter.resolveCellWriteTarget('profile.bio')).toEqual({
      table: 'profiles', // real schema key, not the 'profile' alias
      field: 'bio',
      relatedIdPath: 'profile.id', // alias path into ROW data
      single: true,
      writable: true,
    });
  });

  it('one-to-many relationship path → single: false (never cell-editable)', async () => {
    const target = await adapter.resolveCellWriteTarget('posts.title');
    expect(target).toMatchObject({ table: 'posts', field: 'title', single: false });
  });

  it('the related table PK itself is unwritable', async () => {
    expect(await adapter.resolveCellWriteTarget('profile.id')).toMatchObject({
      table: 'profiles',
      field: 'id',
      writable: false,
    });
  });

  it('JSON accessors, unknown columns, and bare aliases resolve to null', async () => {
    // 'survey.title': `survey` is a TEXT/JSON column on `surveys` — a dotted
    // id resolving to a non-nested path is a JSON accessor.
    expect(await adapter.resolveCellWriteTarget('survey.title', 'surveys')).toBeNull();
    expect(await adapter.resolveCellWriteTarget('nope')).toBeNull();
    expect(await adapter.resolveCellWriteTarget('nope.x')).toBeNull();
    // Bare relation alias — nothing to write.
    expect(await adapter.resolveCellWriteTarget('profile')).toBeNull();
  });

  it('memoizes per (table, columnId)', async () => {
    const first = await adapter.resolveCellWriteTarget('profile.bio');
    const second = await adapter.resolveCellWriteTarget('profile.bio');
    expect(second).toBe(first);
  });

  it('respects an explicit table argument', async () => {
    expect(await adapter.resolveCellWriteTarget('title', 'posts')).toMatchObject({
      table: 'posts',
      field: 'title',
      writable: true,
    });
  });
});
