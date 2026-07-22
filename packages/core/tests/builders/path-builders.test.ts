import { describe, expect, it } from 'bun:test';
import { buildPathAccessor, createPathColumnFactory } from '../../src/builders/path-builders';
import { betterTables, defineTable } from '../../src/factory';
import { humanize, lastPathSegment } from '../../src/lib/format-utils';
import type { SchemaAwareAdapter } from '../../src/types/paths';
import { createColumnBuilder } from '../helpers/column-builders';

/**
 * Acceptance tests for plan 018 Step 3/4: the `t.*()` path-typed column
 * builder runtime and its "identical `ColumnDefinition`" invariant with the
 * landed fluent builders (`plans/design/table-definition-dx.md`, Migration
 * story). This is the ecosystem-fork guard named in the plan's Maintenance
 * notes -- it must never be weakened to "mostly equal".
 */

interface Profile {
  location: string | null;
}

interface Post {
  title: string;
}

interface User {
  name: string;
  age: number;
  profile?: Profile | null;
  posts: Post[];
}

describe('path builders (plan 018)', () => {
  describe('the identical-ColumnDefinition invariant', () => {
    it("t.text('name') structurally matches the hand-written fluent equivalent", () => {
      const t = createPathColumnFactory<User>();
      const pathDef = t.text('name').build();

      const cb = createColumnBuilder<User>();
      const fluentDef = cb
        .text()
        .id('name')
        .accessor((u) => u.name)
        .displayName('Name')
        .build();

      // Compare every non-function field structurally.
      const { accessor: pathAccessor, ...pathRest } = pathDef;
      const { accessor: fluentAccessor, ...fluentRest } = fluentDef;
      expect(pathRest).toEqual(fluentRest);

      // Compare accessor BEHAVIOR (functions can't be deep-equal by reference).
      const row: User = { name: 'Ada', age: 30, posts: [] };
      expect(pathAccessor(row)).toBe(fluentAccessor(row));
      expect(pathAccessor(row)).toBe('Ada');
    });

    it("t.number('age') structurally matches the hand-written fluent equivalent", () => {
      const t = createPathColumnFactory<User>();
      const pathDef = t.number('age').build();

      const cb = createColumnBuilder<User>();
      const fluentDef = cb
        .number()
        .id('age')
        .accessor((u) => u.age)
        .displayName('Age')
        .build();

      const { accessor: pathAccessor, ...pathRest } = pathDef;
      const { accessor: fluentAccessor, ...fluentRest } = fluentDef;
      expect(pathRest).toEqual(fluentRest);

      const row: User = { name: 'Ada', age: 30, posts: [] };
      expect(pathAccessor(row)).toBe(fluentAccessor(row));
    });
  });

  describe('derived accessor correctness', () => {
    it("resolves a single-segment path ('name')", () => {
      const accessor = buildPathAccessor('name');
      expect(accessor({ name: 'Ada' })).toBe('Ada');
    });

    it('returns undefined (no throw) through a null optional relation', () => {
      const accessor = buildPathAccessor('profile.location');
      expect(accessor({ profile: null })).toBeUndefined();
    });

    it('resolves a value through a present optional relation', () => {
      const accessor = buildPathAccessor('profile.location');
      expect(accessor({ profile: { location: 'Berlin' } })).toBe('Berlin');
    });

    it("hops to the first element of an array relation ('posts.title')", () => {
      const accessor = buildPathAccessor('posts.title');
      expect(accessor({ posts: [{ title: 'First' }, { title: 'Second' }] })).toBe('First');
    });

    it('returns undefined for an empty array relation, not a throw', () => {
      const accessor = buildPathAccessor('posts.title');
      expect(accessor({ posts: [] })).toBeUndefined();
    });

    it('returns undefined when the row itself is missing the leaf segment', () => {
      const accessor = buildPathAccessor('profile.location');
      expect(accessor({})).toBeUndefined();
    });
  });

  describe('humanize() -- the runtime label default (design doc Open question (d))', () => {
    it("title-cases the last segment of a dotted path: 'profile.location' -> 'Location'", () => {
      expect(humanize(lastPathSegment('profile.location'))).toBe('Location');
    });

    it("converts snake_case to Title Case words: 'created_at' -> 'Created At'", () => {
      expect(humanize('created_at')).toBe('Created At');
    });

    it("converts camelCase to Title Case words: 'firstName' -> 'First Name'", () => {
      expect(humanize('firstName')).toBe('First Name');
    });

    it("converts kebab-case to Title Case words: 'first-name' -> 'First Name'", () => {
      expect(humanize('first-name')).toBe('First Name');
    });

    it('a path builder derives its displayName via humanize(lastSegment), not Capitalize', () => {
      const t = createPathColumnFactory<{ created_at: string }>();
      const def = t.text('created_at').build();
      expect(def.displayName).toBe('Created At');
    });
  });

  describe('chaining survives through path builders', () => {
    it("t.number('age').range(18, 100) carries the exact filter/meta config as the fluent equivalent", () => {
      const t = createPathColumnFactory<User>();
      const pathDef = t.number('age').range(18, 100).build();

      const cb = createColumnBuilder<User>();
      const fluentDef = cb
        .number()
        .id('age')
        .accessor((u) => u.age)
        .displayName('Age')
        .range(18, 100)
        .build();

      expect(pathDef.filter).toEqual(fluentDef.filter);
      expect(pathDef.meta).toEqual(fluentDef.meta);
    });

    it("t.option('...').options([...]) carries the exact filter/meta config as the fluent equivalent", () => {
      interface Account {
        role: 'admin' | 'editor';
      }
      const t = createPathColumnFactory<Account>();
      const options = [
        { value: 'admin' as const, label: 'Admin' },
        { value: 'editor' as const, label: 'Editor' },
      ];
      const pathDef = t.option('role').options(options).build();

      const cb = createColumnBuilder<Account>();
      const fluentDef = cb
        .option()
        .id('role')
        .accessor((a) => a.role)
        .displayName('Role')
        .options(options)
        .build();

      expect(pathDef.filter).toEqual(fluentDef.filter);
      expect(pathDef.meta).toEqual(fluentDef.meta);
    });
  });

  describe('defineTable: method form vs curried form produce identical output', () => {
    type Schema = {
      users: { row: User };
    };

    it('same tableName and same column shapes for the same factory body', () => {
      const fakeAdapter = {} as SchemaAwareAdapter<{ tables: Schema }>;
      const tables = betterTables({ database: fakeAdapter });

      const viaCurried = defineTable<typeof tables>()('users', (t) => ({
        columns: [t.text('name'), t.number('age').range(0, 130)],
      }));
      const viaMethod = tables.define('users', (t) => ({
        columns: [t.text('name'), t.number('age').range(0, 130)],
      }));

      expect(viaMethod.tableName).toBe(viaCurried.tableName);
      expect(viaMethod.columns.map(({ accessor, ...rest }) => rest)).toEqual(
        viaCurried.columns.map(({ accessor, ...rest }) => rest)
      );

      const row: User = { name: 'Ada', age: 30, posts: [] };
      expect(viaMethod.columns.map((c) => c.accessor(row))).toEqual(
        viaCurried.columns.map((c) => c.accessor(row))
      );
    });
  });

  describe('t.custom() and t.computed() escape hatches', () => {
    it('t.custom() returns an unconfigured base builder callers must finish configuring', () => {
      const t = createPathColumnFactory<User>();
      const def = t
        .custom<string>()
        .id('custom')
        .displayName('Custom')
        .accessor((u) => u.name)
        .build();

      expect(def.type).toBe('custom');
      expect(def.id).toBe('custom');
      expect(def.filterable).toBe(false);
      expect(def.sortable).toBe(false);
    });

    it('t.computed() infers the value type from the accessor and humanizes the id for the default label', () => {
      const t = createPathColumnFactory<User>();
      const def = t.computed('fullName', (u) => `${u.name}!!`).build();

      expect(def.id).toBe('fullName');
      expect(def.displayName).toBe('Full Name');
      expect(def.type).toBe('custom');
      expect(def.filterable).toBe(false);
      expect(def.sortable).toBe(false);
      expect(def.accessor({ name: 'Ada', age: 30, posts: [] })).toBe('Ada!!');
    });
  });

  describe('t.count() / t.aggregate() (plan 060)', () => {
    it('t.count(relation) defaults id to `${relation}Count` with a count derived spec', () => {
      const t = createPathColumnFactory<User>();
      const def = t.count('posts').build();

      expect(def.id).toBe('postsCount');
      expect(def.type).toBe('number');
      expect(def.filterable).toBe(true);
      expect(def.sortable).toBe(true);
      expect(def.derived).toEqual({ kind: 'aggregate', relation: 'posts', fn: 'count' });
      expect(
        def.accessor({ name: 'Ada', age: 30, posts: [], postsCount: 3 } as User & {
          postsCount: number;
        })
      ).toBe(3);
    });

    it('t.aggregate requires field for non-count fns', () => {
      const t = createPathColumnFactory<User>();
      expect(() => t.aggregate('total', { relation: 'posts', fn: 'sum' })).toThrow(/field/);
    });

    it('t.aggregate(id, spec) carries the general derived shape', () => {
      const t = createPathColumnFactory<User>();
      const def = t.aggregate('postTitles', { relation: 'posts', fn: 'sum', field: 'age' }).build();

      expect(def.id).toBe('postTitles');
      expect(def.derived).toEqual({
        kind: 'aggregate',
        relation: 'posts',
        fn: 'sum',
        field: 'age',
      });
    });
  });
});
