/**
 * Compile-level tests for the Drizzle `$types` phantom (plan 018, Step 5).
 *
 * Verifies the `RelationAwareRow`/`DrizzleSchemaTypes` recipe
 * (`src/types.ts`, per `plans/design/table-definition-dx.md` Step 1
 * decision 2) against the drizzle package's OWN shared test schema
 * (`tests/helpers/test-schema.ts`), and that `defineTable<Tables>()` -- the
 * production runtime from `@better-tables/core`, driven by the SAME
 * `$types` shape `betterTables({database: drizzleAdapter(db)})` would carry
 * -- autocompletes/accepts real table names and relation paths, and rejects
 * bogus ones.
 *
 * This is a COMPILE-level test (per plan 018 Step 5): assertions live in the
 * type system (`@ts-expect-error`, `expectTypeOf`), not in runtime adapter
 * behavior. `db` is `declare`d (a type, never a real connection) because
 * `better-sqlite3`'s native binding does not load under Bun's runtime in
 * this repo (verified: `new (require('better-sqlite3'))(':memory:')` throws
 * `ERR_DLOPEN_FAILED` -- the exact reason `tests/helpers/bun-sqlite-compat.ts`
 * exists elsewhere in this package, wrapping `bun:sqlite` instead). Since
 * `drizzleAdapter()` DOES real driver detection at runtime (it would throw
 * against a fake db object), this file never calls it -- it instead derives
 * the equivalent `Tables` TYPE via `ReturnType<typeof betterTables<...>>`
 * and feeds that type (not a value) to `defineTable<Tables>()`, which is a
 * real, pure function call with no driver/db dependency. `$types` itself is
 * a phantom never assigned at runtime either way (see `factory.ts`'s
 * `drizzleAdapter()` doc comment).
 */

import { describe, expect, expectTypeOf, it } from 'bun:test';
import { betterTables, defineTable } from '@better-tables/core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { drizzleAdapter } from '../src/factory';
import type { DrizzleSchemaTypes, RelationAwareRow } from '../src/types';
import {
  comments,
  commentsRelations,
  posts,
  postsRelations,
  profiles,
  profilesRelations,
  schema,
  users,
  usersRelations,
} from './helpers/test-schema';

// The FULL schema (tables + relations) a real `drizzle(connection, { schema })`
// call would receive -- the shape `RelationAwareRow`'s recipe needs to see
// relation definitions alongside their tables (design doc Step 1 decision 2).
const fullSchema = {
  ...schema,
  usersRelations,
  profilesRelations,
  postsRelations,
  commentsRelations,
};

// A TYPE, never a runtime value -- see the docblock above for why this file
// never actually calls `drizzleAdapter()`/connects a real `better-sqlite3`.
type DB = BetterSQLite3Database<typeof fullSchema>;
type Adapter = ReturnType<typeof drizzleAdapter<DB>>;
type Tables = ReturnType<typeof betterTables<Adapter>>;

describe('Drizzle $types phantom (plan 018)', () => {
  it('RelationAwareRow resolves a to-one relation field (verifies against test-schema.ts)', () => {
    type UsersRow = RelationAwareRow<typeof fullSchema, 'users'>;

    // `profile` is reachable through the `users -> profile` to-one relation.
    expectTypeOf<UsersRow>().toHaveProperty('profile');
    expectTypeOf<UsersRow['profile']>().not.toBeNever();

    expect(true).toBe(true);
  });

  it('RelationAwareRow resolves a to-many relation field', () => {
    type UsersRow = RelationAwareRow<typeof fullSchema, 'users'>;
    expectTypeOf<UsersRow>().toHaveProperty('posts');

    expect(true).toBe(true);
  });

  it('the betterTables() instance $types carries a schema catalog with every table name', () => {
    expectTypeOf<Tables['$types']>().toHaveProperty('tables');
    expectTypeOf<Tables['$types']['tables']>().toHaveProperty('users');
    expectTypeOf<Tables['$types']['tables']>().toHaveProperty('profiles');
    expectTypeOf<Tables['$types']['tables']>().toHaveProperty('posts');
    expectTypeOf<Tables['$types']['tables']>().toHaveProperty('comments');

    expect(true).toBe(true);
  });

  it('defineTable<Tables>() accepts a real table name and autocompletes path-typed columns', () => {
    const usersTable = defineTable<Tables>()('users', (t) => ({
      columns: [t.text('name'), t.number('age'), t.text('email')],
    }));

    expect(usersTable.tableName).toBe('users');
    expect(usersTable.columns.map((c) => c.id)).toEqual(['name', 'age', 'email']);
  });

  it('defineTable<Tables>() accepts a relation path (users -> profile -> bio)', () => {
    const usersTable = defineTable<Tables>()('users', (t) => ({
      columns: [t.text('profile.bio')],
    }));

    expect(usersTable.columns[0]?.id).toBe('profile.bio');
  });

  it('defineTable<Tables>() rejects a bogus table name', () => {
    defineTable<Tables>()(
      // @ts-expect-error - 'widgets' is not a table in test-schema.ts
      'widgets',
      (t) => ({ columns: [t.text('name')] })
    );

    expect(true).toBe(true);
  });

  it('defineTable<Tables>() rejects a bogus relation path', () => {
    defineTable<Tables>()('users', (t) => ({
      // @ts-expect-error - 'profile.notAField' is not a real path on the users row
      columns: [t.text('profile.notAField')],
    }));

    expect(true).toBe(true);
  });

  it('DrizzleSchemaTypes<DB> exposes every real table name as a key', () => {
    type Types = DrizzleSchemaTypes<DB>;
    expectTypeOf<Types['tables']>().toHaveProperty('users');
    expectTypeOf<Types['tables']>().toHaveProperty('profiles');
    expectTypeOf<Types['tables']>().toHaveProperty('posts');
    expectTypeOf<Types['tables']>().toHaveProperty('comments');
    expectTypeOf<Types['tables']>().toHaveProperty('surveys');

    expect(true).toBe(true);
  });

  it('typechecks the same for users, profiles, posts, and comments (referenced to keep the fixture imports live)', () => {
    expect([users, profiles, posts, comments].every(Boolean)).toBe(true);
  });
});
