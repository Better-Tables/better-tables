/**
 * Construction-time validation for finding 11 (plan 030): a relations map
 * keyed by table name, spread OVER a tables map, silently overwrites each
 * colliding key's real table object with a same-named `Relations` object --
 * `{ ...tables, ...relationsKeyedByTableName }`. `filterTablesFromSchema`
 * already tolerates this at runtime by dropping the relations-shaped entry
 * entirely, which means the colliding table just silently vanishes from the
 * adapter's schema. `DrizzleAdapter`'s constructor now throws a `SchemaError`
 * naming the colliding key(s) instead.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../src/types';
import { SchemaError } from '../src/types';
import type { BunSQLiteDatabase } from './helpers/test-fixtures';
import { closeDatabase, createTestDatabase, setupTestDatabase } from './helpers/test-fixtures';
import {
  comments,
  commentsRelations,
  posts,
  postsRelations,
  profiles,
  profilesRelations,
  relationsSchema,
  schema,
  surveys,
  users,
  usersRelations,
} from './helpers/test-schema';

describe('DrizzleAdapter construction -- relations clobbering tables (finding 11)', () => {
  let db: BunSQLiteDatabase;
  let sqlite: Database;

  beforeEach(async () => {
    const created = createTestDatabase();
    db = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('throws a SchemaError naming every colliding key when a relations map keyed by table name is spread over the tables map', () => {
    // The exact shape finding 11 describes: relationsSchema is keyed
    // 'users' | 'profiles' | 'posts' | 'comments' -- identical to schema's
    // own keys -- so spreading it second overwrites each of those real
    // table objects with a same-named Relations wrapper. 'surveys' is
    // untouched (relationsSchema has no 'surveys' key).
    const clobberedSchema = { ...schema, ...relationsSchema };

    const config: DrizzleAdapterConfig<typeof clobberedSchema, 'sqlite'> = {
      db: db as unknown as DrizzleDatabase<'sqlite'>,
      schema: clobberedSchema,
      driver: 'sqlite',
      autoDetectRelationships: false,
    };

    expect(() => new DrizzleAdapter(config)).toThrow(SchemaError);

    try {
      // biome-ignore lint/suspicious/noExplicitAny: constructing deliberately-invalid config for the throw path
      new DrizzleAdapter(config as any);
      throw new Error('expected construction to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      const schemaError = error as SchemaError;
      const collidingKeys = schemaError.details?.relationsShapedKeys as string[] | undefined;
      expect(collidingKeys?.sort()).toEqual(['comments', 'posts', 'profiles', 'users']);
      expect(schemaError.message).toContain('users');
      expect(schemaError.message).toContain('relations');
    }
  });

  it('a single colliding key is named precisely', () => {
    const clobberedSchema = { users: usersRelations, profiles, posts, comments, surveys };

    const config: DrizzleAdapterConfig<typeof clobberedSchema, 'sqlite'> = {
      db: db as unknown as DrizzleDatabase<'sqlite'>,
      schema: clobberedSchema,
      driver: 'sqlite',
      autoDetectRelationships: false,
    };

    try {
      new DrizzleAdapter(config);
      throw new Error('expected construction to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      const schemaError = error as SchemaError;
      expect(schemaError.details?.relationsShapedKeys).toEqual(['users']);
    }
  });

  it('does NOT throw for the normal, supported pattern -- relations under a DIFFERENT (suffixed) key alongside their table', () => {
    // This is filterTablesFromSchema's own documented example and an
    // existing, widely-used pattern (adapter-schema-filtering.test.ts):
    // relations included under a suffixed key, not colliding with any
    // table's own key.
    const schemaWithSuffixedRelations = {
      users,
      profiles,
      posts,
      comments,
      surveys,
      usersRelations,
      profilesRelations,
      postsRelations,
      commentsRelations,
    };

    const config: DrizzleAdapterConfig<typeof schemaWithSuffixedRelations, 'sqlite'> = {
      db: db as unknown as DrizzleDatabase<'sqlite'>,
      schema: schemaWithSuffixedRelations,
      driver: 'sqlite',
      autoDetectRelationships: false,
    };

    expect(() => new DrizzleAdapter(config)).not.toThrow();
  });

  it('does NOT throw for a normal tables-only schema', () => {
    const config: DrizzleAdapterConfig<typeof schema, 'sqlite'> = {
      db: db as unknown as DrizzleDatabase<'sqlite'>,
      schema,
      driver: 'sqlite',
      autoDetectRelationships: false,
    };

    expect(() => new DrizzleAdapter(config)).not.toThrow();
  });
});
