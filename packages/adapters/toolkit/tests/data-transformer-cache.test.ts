/**
 * @fileoverview Per-transform cache behavior for DataTransformer
 *
 * Covers the memoization added for PERF-01 (plan 040):
 * - resolveColumnPath / getPrimaryKeyName / getColumnNames hit caches within a transform
 * - caches are cleared in the transform's finally block
 * - a subsequent transform starts clean (lookups run again)
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

function makeColumnPath(columnId: string, primaryTable: string): ColumnPath {
  if (!columnId.includes('.')) {
    return {
      columnId,
      table: primaryTable,
      field: columnId,
      isNested: false,
    };
  }

  const [, field = ''] = columnId.split('.');
  const relationship: RelationshipPath = {
    from: primaryTable,
    to: 'profiles',
    foreignKey: 'userId',
    localKey: 'id',
    cardinality: 'one',
  };

  return {
    columnId,
    table: 'profiles',
    field,
    isNested: true,
    relationshipPath: [relationship],
  };
}

function createCountingPorts() {
  const resolveCalls: string[] = [];
  const primaryKeyCalls: ToyTable[] = [];
  const columnNameCalls: ToyTable[] = [];

  const relationshipManager: RelationshipManagerPort = {
    resolveColumnPath(columnId, primaryTable) {
      resolveCalls.push(`${primaryTable}:${columnId}`);
      return makeColumnPath(columnId, primaryTable);
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
      columnNameCalls.push(table);
      return table.columns;
    },
    getForeignKeyColumns() {
      return [];
    },
    getPrimaryKeyColumns(table) {
      primaryKeyCalls.push(table);
      return [{ name: table.primaryKey, column: table.primaryKey }];
    },
  };

  return {
    relationshipManager,
    schemaPort,
    resolveCalls,
    primaryKeyCalls,
    columnNameCalls,
  };
}

function cacheFields(transformer: DataTransformer<ToyTable>) {
  const internal = transformer as unknown as {
    columnPathCache: Map<string, ColumnPath> | null;
    primaryKeyNameCache: WeakMap<object, string> | null;
    columnNamesCache: WeakMap<object, string[]> | null;
  };
  return {
    columnPathCache: internal.columnPathCache,
    primaryKeyNameCache: internal.primaryKeyNameCache,
    columnNamesCache: internal.columnNamesCache,
  };
}

describe('DataTransformer per-transform caches', () => {
  const users: ToyTable = { columns: ['id', 'email'], primaryKey: 'id' };
  const profiles: ToyTable = { columns: ['id', 'bio', 'userId'], primaryKey: 'id' };
  const schema = { users, profiles };

  it('memoizes resolveColumnPath within a single transform (cache hits across rows)', () => {
    const { relationshipManager, schemaPort, resolveCalls } = createCountingPorts();
    const transformer = new DataTransformer(schema, relationshipManager, schemaPort);

    const flatData = [
      {
        id: 1,
        email: 'a@example.com',
        profiles_id: 10,
        profiles_bio: 'Bio A',
      },
      {
        id: 2,
        email: 'b@example.com',
        profiles_id: 20,
        profiles_bio: 'Bio B',
      },
    ];

    const columns = ['email', 'profile.bio'];
    transformer.transformToNested(flatData, 'users', columns);

    // Precompute + row processing should reuse the same path resolutions.
    // Without a cache this would scale with row count × column references.
    const emailResolves = resolveCalls.filter((c) => c.endsWith(':email')).length;
    const profileBioResolves = resolveCalls.filter((c) => c.endsWith(':profile.bio')).length;

    expect(emailResolves).toBe(1);
    expect(profileBioResolves).toBe(1);
  });

  it('memoizes primary-key lookups across related rows within a transform', () => {
    const { schemaPort, primaryKeyCalls } = createCountingPorts();

    // Multiple flat rows for one user → one-to-many style related records,
    // so getPrimaryKeyNameCached runs per related row without the cache.
    const posts: ToyTable = { columns: ['id', 'title', 'userId'], primaryKey: 'id' };
    const manySchema = { users, posts };

    const manyRelationshipManager: RelationshipManagerPort = {
      resolveColumnPath(columnId, primaryTable) {
        if (!columnId.includes('.')) {
          return makeColumnPath(columnId, primaryTable);
        }
        const [, field = ''] = columnId.split('.');
        return {
          columnId,
          table: 'posts',
          field,
          isNested: true,
          relationshipPath: [
            {
              from: primaryTable,
              to: 'posts',
              foreignKey: 'userId',
              localKey: 'id',
              cardinality: 'many',
            },
          ],
        };
      },
      getRelationshipByAlias() {
        return null;
      },
      isArrayRelationship() {
        return false;
      },
    };

    const manyTransformer = new DataTransformer(manySchema, manyRelationshipManager, schemaPort);

    const flatData = [
      { id: 1, email: 'a@example.com', posts_id: 1, posts_title: 'Post 1' },
      { id: 1, email: 'a@example.com', posts_id: 2, posts_title: 'Post 2' },
      { id: 1, email: 'a@example.com', posts_id: 3, posts_title: 'Post 3' },
    ];

    manyTransformer.transformToNested(flatData, 'users', ['email', 'posts.title']);

    // groupByMainTableKey hits PK once before caches are armed; the rest of
    // the transform should reuse the WeakMap memo for posts (3 related rows).
    const usersPkCalls = primaryKeyCalls.filter((t) => t === users).length;
    const postsPkCalls = primaryKeyCalls.filter((t) => t === posts).length;

    expect(usersPkCalls).toBeLessThanOrEqual(2);
    expect(postsPkCalls).toBe(1);
  });

  it('memoizes getColumnNames for one-to-one related tables within a transform', () => {
    const { relationshipManager, schemaPort, columnNameCalls } = createCountingPorts();
    const transformer = new DataTransformer(schema, relationshipManager, schemaPort);

    // Two primary rows each with a profile — processOneToOneColumn calls
    // getColumnNamesCached per row; the WeakMap should collapse that to 1.
    const flatData = [
      { id: 1, email: 'a@example.com', profiles_id: 10, profiles_bio: 'Bio A' },
      { id: 2, email: 'b@example.com', profiles_id: 20, profiles_bio: 'Bio B' },
    ];

    transformer.transformToNested(flatData, 'users', ['email', 'profile.bio']);

    const profileColCalls = columnNameCalls.filter((t) => t === profiles).length;
    expect(profileColCalls).toBe(1);
  });

  it('clears caches in finally so fields are null after transform returns', () => {
    const { relationshipManager, schemaPort } = createCountingPorts();
    const transformer = new DataTransformer(schema, relationshipManager, schemaPort);

    transformer.transformToNested(
      [{ id: 1, email: 'a@example.com', profiles_id: 10, profiles_bio: 'Bio' }],
      'users',
      ['email', 'profile.bio']
    );

    const after = cacheFields(transformer);
    expect(after.columnPathCache).toBeNull();
    expect(after.primaryKeyNameCache).toBeNull();
    expect(after.columnNamesCache).toBeNull();
  });

  it('clears caches even when transform throws', () => {
    const { schemaPort } = createCountingPorts();

    const explodingManager: RelationshipManagerPort = {
      resolveColumnPath(columnId, primaryTable) {
        if (columnId === 'profile.bio') {
          throw new Error('boom');
        }
        return makeColumnPath(columnId, primaryTable);
      },
      getRelationshipByAlias() {
        return null;
      },
      isArrayRelationship() {
        return false;
      },
    };

    const transformer = new DataTransformer(schema, explodingManager, schemaPort);

    expect(() =>
      transformer.transformToNested(
        [{ id: 1, email: 'a@example.com', profiles_id: 10, profiles_bio: 'Bio' }],
        'users',
        ['email', 'profile.bio']
      )
    ).toThrow('boom');

    const after = cacheFields(transformer);
    expect(after.columnPathCache).toBeNull();
    expect(after.primaryKeyNameCache).toBeNull();
    expect(after.columnNamesCache).toBeNull();
  });

  it('starts each transform with empty caches (repeated lookups across transforms)', () => {
    const { relationshipManager, schemaPort, resolveCalls } = createCountingPorts();
    const transformer = new DataTransformer(schema, relationshipManager, schemaPort);

    const flatData = [
      { id: 1, email: 'a@example.com', profiles_id: 10, profiles_bio: 'Bio' },
    ];
    const columns = ['email', 'profile.bio'];

    transformer.transformToNested(flatData, 'users', columns);
    const afterFirst = resolveCalls.length;

    transformer.transformToNested(flatData, 'users', columns);
    const afterSecond = resolveCalls.length;

    // Second transform must re-resolve (caches were cleared), not reuse the
    // previous transform's Map/WeakMaps.
    expect(afterFirst).toBeGreaterThan(0);
    expect(afterSecond).toBe(afterFirst * 2);
  });
});
