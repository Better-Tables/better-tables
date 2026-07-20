/**
 * @fileoverview Unit tests for the opaque-SQL table-reference walker.
 *
 * `collectSqlTableRefs` is what join planning trusts to decide which tables a
 * computed-field `filterSql`/`sortSql` fragment touches, and whether each is
 * outer-scoped (needs a JOIN) or self-scoped (a correlated subquery's own
 * FROM). These tests pin the chunk-walk classification directly; the
 * end-to-end consequences run in computed-field-cross-table-sql.test.ts.
 */

import { describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { collectSqlTableRefs } from '../src/utils/sql-table-refs';
import { schema } from './helpers/test-schema';

describe('collectSqlTableRefs', () => {
  it('classifies an interpolated column under columnTableNames', () => {
    const refs = collectSqlTableRefs([sql`${schema.profiles.bio} is not null`]);

    expect([...refs.columnTableNames]).toEqual(['profiles']);
    expect(refs.fromTableNames.size).toBe(0);
  });

  it('classifies an interpolated table under fromTableNames', () => {
    const refs = collectSqlTableRefs([
      sql`exists (select 1 from ${schema.profiles} where ${schema.profiles.userId} = ${schema.users.id})`,
    ]);

    expect(refs.fromTableNames.has('profiles')).toBe(true);
    // Column chunks are still reported — scope policy is the caller's.
    expect(refs.columnTableNames.has('profiles')).toBe(true);
    expect(refs.columnTableNames.has('users')).toBe(true);
  });

  it('collects references from multiple tables in one fragment', () => {
    const refs = collectSqlTableRefs([
      sql`${schema.profiles.bio} is not null and ${schema.posts.published} = 1`,
    ]);

    expect([...refs.columnTableNames].sort()).toEqual(['posts', 'profiles']);
  });

  it('walks nested SQL fragments', () => {
    const inner = sql`${schema.profiles.bio} is not null`;
    const refs = collectSqlTableRefs([sql`(${inner}) and ${schema.users.age} > 18`]);

    expect(refs.columnTableNames.has('profiles')).toBe(true);
    expect(refs.columnTableNames.has('users')).toBe(true);
  });

  it('unwraps aliased fragments', () => {
    const aliased = sql`${schema.profiles.bio}`.as('bio_alias');
    const refs = collectSqlTableRefs([aliased]);

    expect(refs.columnTableNames.has('profiles')).toBe(true);
  });

  it('unwraps generic SQLWrapper objects via getSQL()', () => {
    const wrapper = { getSQL: () => sql`${schema.posts.title} like '%x%'` };
    const refs = collectSqlTableRefs([wrapper]);

    expect(refs.columnTableNames.has('posts')).toBe(true);
  });

  it('sees nothing in fragments built from raw identifier strings', () => {
    // Raw strings never bind to Drizzle entities — nothing to plan against.
    const refs = collectSqlTableRefs([sql.raw(`profiles.bio is not null`)]);

    expect(refs.columnTableNames.size).toBe(0);
    expect(refs.fromTableNames.size).toBe(0);
  });

  it('handles null/undefined nodes and empty input', () => {
    expect(collectSqlTableRefs([]).columnTableNames.size).toBe(0);
    const refs = collectSqlTableRefs([null, undefined]);
    expect(refs.columnTableNames.size).toBe(0);
    expect(refs.fromTableNames.size).toBe(0);
  });

  it('terminates on self-referential getSQL wrappers (depth guard)', () => {
    const cyclic: { getSQL: () => unknown } = { getSQL: () => cyclic };

    const refs = collectSqlTableRefs([cyclic]);
    expect(refs.columnTableNames.size).toBe(0);
  });

  it('keeps scope per call: separate invocations do not share fromTableNames', () => {
    // The join planner calls once per fragment precisely so one fragment's
    // Table chunk cannot exempt another fragment's bare column reference.
    const bare = collectSqlTableRefs([sql`${schema.profiles.bio} is not null`]);
    const scoped = collectSqlTableRefs([sql`exists (select 1 from ${schema.profiles})`]);

    expect(bare.fromTableNames.has('profiles')).toBe(false);
    expect(scoped.fromTableNames.has('profiles')).toBe(true);
  });
});
