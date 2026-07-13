import { describe, expect, expectTypeOf, it } from 'bun:test';
import { ColumnBuilder } from '../../src/builders/column-builder';
import { createColumnBuilder } from '../../src/builders/column-factory';

// Local fixture: a role field with a literal union, mirroring the flagship
// example from the plan. Kept minimal on purpose.
type User = {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
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

      expectTypeOf(builder).toEqualTypeOf<ColumnBuilder<User, string>>();
    });
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

    const user: User = { id: '1', role: 'editor' };
    const value = column.accessor(user);
    column.cellRenderer?.({ row: user, value, column, rowIndex: 0 });

    expect(value).toBe('editor');
    expect(received).toBe('editor');
  });
});
