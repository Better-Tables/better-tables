import { describe, expect, expectTypeOf, it } from 'bun:test';
import { ColumnBuilder } from '../../src/builders/column-builder';
import { createColumnBuilder } from '../../src/builders/column-factory';
import type { ColumnDefinition } from '../../src/types/column';
// Tests may import experimental prototypes; src must not (see plan 014).
import type { ColumnRegistry } from '../../src/types/experimental/contract-v2';

// Local fixture: a role field with a literal union, mirroring the flagship
// example from the plan. Kept minimal on purpose.
type User = {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
  name: string;
  age: number;
  profile: { location: string };
};

describe('Builder value-type inference', () => {
  describe('option-literal-union: accessor narrows the value type end-to-end', () => {
    it('cellRenderer sees value: "admin" | "editor" | "viewer", not plain string', () => {
      const cb = createColumnBuilder<User>();

      cb.option()
        .id('role')
        .displayName('Role')
        .accessor((u: User) => u.role)
        .cellRenderer(({ value }) => {
          expectTypeOf(value).toEqualTypeOf<'admin' | 'editor' | 'viewer'>();
          return value;
        });
    });
  });

  describe('option-literal-union: options() is checked against the narrowed union', () => {
    it('rejects an option value outside "admin" | "editor" | "viewer"', () => {
      const cb = createColumnBuilder<User>();

      cb.option()
        .id('role')
        .displayName('Role')
        .accessor((u: User) => u.role)
        .options([
          { value: 'admin', label: 'A' },
          // @ts-expect-error - 'bogus' is not a member of 'admin' | 'editor' | 'viewer'
          { value: 'bogus', label: 'B' },
        ]);

      expect(true).toBe(true);
    });
  });

  describe('legacy back-compat shape', () => {
    it('plain ColumnBuilder<User, string> with explicit generics still compiles', () => {
      const builder = new ColumnBuilder<User, string>('text')
        .id('id')
        .displayName('ID')
        .accessor((u) => u.id)
        .cellRenderer(({ value }) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value;
        });

      expectTypeOf(builder).toEqualTypeOf<ColumnBuilder<User, string, 'id'>>();
    });
  });
});

describe('Literal-preserving column ids (plan 014)', () => {
  it('.id("name").accessor(...).build() has id type exactly "name", not string', () => {
    const cb = createColumnBuilder<User>();

    const def = cb
      .text()
      .id('name')
      .displayName('Name')
      .accessor((u) => u.name)
      .build();

    expectTypeOf(def.id).toEqualTypeOf<'name'>();
    expectTypeOf(def.id).not.toEqualTypeOf<string>();
    expect(def.id).toBe('name');
  });

  it('order independence: .accessor(...).id("name") narrows the same way as .id(...).accessor(...)', () => {
    const cb = createColumnBuilder<User>();

    const def = cb
      .text()
      .accessor((u) => u.name)
      .id('name')
      .displayName('Name')
      .build();

    expectTypeOf(def.id).toEqualTypeOf<'name'>();
    expectTypeOf(def.accessor).toEqualTypeOf<(data: User) => string>();
    expect(def.id).toBe('name');
  });

  it('relation-path literal: .id("profile.location") preserves the dotted path as a literal (no keyof constraint)', () => {
    const cb = createColumnBuilder<User>();

    const def = cb
      .text()
      .id('profile.location')
      .displayName('Location')
      .accessor((u) => u.profile.location)
      .build();

    expectTypeOf(def.id).toEqualTypeOf<'profile.location'>();
    expect(def.id).toBe('profile.location');
  });

  it('registry smoke test: a tuple of built defs derives { name: string; age: number } — the blocker plan 006/011 needed removed', () => {
    const cb = createColumnBuilder<User>();

    const nameCol = cb
      .text()
      .id('name')
      .displayName('Name')
      .accessor((u) => u.name)
      .build();
    const ageCol = cb
      .number()
      .id('age')
      .displayName('Age')
      .accessor((u) => u.age)
      .build();

    type Columns = readonly [typeof nameCol, typeof ageCol];

    // Local mapped-type registry, per the plan's acceptance proof.
    // biome-ignore lint/suspicious/noExplicitAny: polymorphic column params required for registry proof
    type LocalRegistry<T extends readonly ColumnDefinition<any, any, any>[]> = {
      // biome-ignore lint/suspicious/noExplicitAny: infer value type from heterogeneous column definitions
      [C in T[number] as C['id']]: C extends ColumnDefinition<any, infer V, any> ? V : never;
    };

    expectTypeOf<LocalRegistry<Columns>>().toEqualTypeOf<{ name: string; age: number }>();

    // Mirror experimental/contract-v2.ts's ColumnRegistry directly: production
    // ColumnDefinition now satisfies ColumnDefLike's TId/accessor shape, so the
    // prototype's own registry type resolves the same way with no changes.
    expectTypeOf<ColumnRegistry<Columns>>().toEqualTypeOf<{ name: string; age: number }>();
  });

  it('legacy shape: explicitly-annotated ColumnBuilder<User, string> (two params) still compiles', () => {
    const builder = new ColumnBuilder<User, string>('text');
    expectTypeOf(builder).toEqualTypeOf<ColumnBuilder<User, string, string>>();
  });
});

describe('build() runtime: accessor output feeds cellRenderer untouched', () => {
  it('passes the accessor-derived value straight through to cellRenderer', () => {
    const cb = createColumnBuilder<User>();
    let received: 'admin' | 'editor' | 'viewer' | undefined;

    const column = cb
      .option()
      .id('role')
      .displayName('Role')
      .accessor((u) => u.role)
      .options([
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
        { value: 'viewer', label: 'Viewer' },
      ])
      .cellRenderer(({ value }) => {
        received = value;
        return value;
      })
      .build();

    const user: User = {
      id: '1',
      role: 'editor',
      name: 'Ada',
      age: 30,
      profile: { location: 'NYC' },
    };
    const value = column.accessor(user);
    column.cellRenderer?.({ row: user, value, column, rowIndex: 0 });

    expect(value).toBe('editor');
    expect(received).toBe('editor');
  });
});
