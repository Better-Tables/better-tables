import { describe, expect, it } from 'bun:test';
import { userColumns } from './user-columns';

/**
 * Contract pins for the homepage demo's column definitions. Builders default
 * to `filterable: true` / `sortable: true` / `nullable: false`, so the
 * intent-carrying overrides below are easy to drop in a refactor and produce
 * silent runtime breakage (a filter on a non-existent DB field; an edit that
 * cannot clear a nullable column).
 */
const byId = Object.fromEntries(userColumns.map((column) => [column.id, column]));

describe('homepage demo columns', () => {
  it('does not expose filter/sort controls on client-only computed columns', () => {
    for (const id of ['hasBio', 'roleTags']) {
      const column = byId[id];
      expect(column).toBeDefined();
      // There is no `hasBio` / `roleTags` storage field — enabling either
      // control would send the id to the query builder as a real column.
      expect(column?.filterable).toBe(false);
      expect(column?.sortable).toBe(false);
    }
  });

  it('marks editable nullable relation columns as nullable', () => {
    // `profiles.bio` / `profiles.location` are nullable in the schema; without
    // `nullable: true` the cell-edit pipeline rejects clearing them with
    // "This field is required."
    for (const id of ['profile.bio', 'profile.location']) {
      const column = byId[id];
      expect(column).toBeDefined();
      expect(column?.editable).toBeTruthy();
      expect(column?.nullable).toBe(true);
    }
  });

  it('keeps schema-backed columns filterable and sortable', () => {
    expect(byId.name?.filterable).toBe(true);
    expect(byId.name?.sortable).toBe(true);
  });
});
