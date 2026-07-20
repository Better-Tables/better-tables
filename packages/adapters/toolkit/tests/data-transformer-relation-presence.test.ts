/**
 * @fileoverview One-to-one relation presence detection in DataTransformer
 *
 * Regression coverage for the "blank related columns" defect: presence of a
 * related row used to be decided by whichever related column the caller listed
 * FIRST (`processColumn` is invoked once per relationship with `cols[0]`). When
 * that one column was NULL for a row, the entire related object was replaced
 * with `null` and every other related column rendered blank in the UI, even
 * though the JOIN had returned data for them.
 *
 * Presence now keys off the related table's primary key -- the same signal
 * `processOneToManyColumn` uses -- falling back to "any related column carries
 * a value" when the PK was not selected.
 */

import { describe, expect, it } from 'bun:test';
import { DataTransformer } from '../src/data-transformer';
import type {
  ColumnPath,
  RelationshipManagerPort,
  RelationshipPath,
  SchemaIntrospectionPort,
} from '../src/types';

interface ToyTable {
  columns: string[];
  primaryKey: string;
}

const schema: Record<string, ToyTable> = {
  users: { columns: ['id', 'name'], primaryKey: 'id' },
  profiles: { columns: ['id', 'userId', 'bio', 'avatar'], primaryKey: 'id' },
};

const profileRelationship: RelationshipPath = {
  from: 'users',
  to: 'profiles',
  foreignKey: 'userId',
  localKey: 'id',
  cardinality: 'one',
};

const relationshipManager: RelationshipManagerPort = {
  resolveColumnPath(columnId, primaryTable): ColumnPath {
    if (!columnId.includes('.')) {
      return { columnId, table: primaryTable, field: columnId, isNested: false };
    }
    const [, field = ''] = columnId.split('.');
    return {
      columnId,
      table: 'profiles',
      field,
      isNested: true,
      relationshipPath: [profileRelationship],
    };
  },
  getRelationshipByAlias() {
    return null;
  },
  isArrayRelationship() {
    return false;
  },
};

const schemaPort: SchemaIntrospectionPort<ToyTable> = {
  getColumnNames(table) {
    return table.columns;
  },
  getForeignKeyColumns() {
    return [];
  },
  getPrimaryKeyColumns(table) {
    return [{ name: table.primaryKey, column: table.primaryKey }];
  },
};

function transform(flatRow: Record<string, unknown>, columns: string[]) {
  const transformer = new DataTransformer<ToyTable>(schema, relationshipManager, schemaPort);
  const result = transformer.transformToNested([flatRow], 'users', columns);
  return result[0] as Record<string, unknown>;
}

describe('DataTransformer one-to-one relation presence', () => {
  it('keeps the related object when the FIRST requested related column is NULL', () => {
    const record = transform(
      {
        id: 1,
        name: 'John Doe',
        profiles_id: 10,
        profiles_avatar: null,
        profiles_bio: 'Software developer',
      },
      // `profile.avatar` is listed first and is NULL for this row.
      ['name', 'profile.avatar', 'profile.bio']
    );

    expect(record.profile).not.toBeNull();
    expect((record.profile as Record<string, unknown>).bio).toBe('Software developer');
  });

  it('is order-independent: same row, related columns requested in either order', () => {
    const row = {
      id: 1,
      name: 'John Doe',
      profiles_id: 10,
      profiles_avatar: null,
      profiles_bio: 'Software developer',
    };

    const avatarFirst = transform(row, ['name', 'profile.avatar', 'profile.bio']);
    const bioFirst = transform(row, ['name', 'profile.bio', 'profile.avatar']);

    expect(avatarFirst.profile).toEqual(bioFirst.profile as Record<string, unknown>);
  });

  it('falls back to any non-null related column when the related PK is not selected', () => {
    const record = transform(
      {
        id: 1,
        name: 'John Doe',
        profiles_avatar: null,
        profiles_bio: 'Software developer',
      },
      ['name', 'profile.avatar', 'profile.bio']
    );

    expect(record.profile).not.toBeNull();
    expect((record.profile as Record<string, unknown>).bio).toBe('Software developer');
  });

  it('still nulls the related object when the related row genuinely has no data', () => {
    const record = transform(
      {
        id: 1,
        name: 'John Doe',
        profiles_id: null,
        profiles_avatar: null,
        profiles_bio: null,
      },
      ['name', 'profile.avatar', 'profile.bio']
    );

    expect(record.profile).toBeNull();
  });
});
