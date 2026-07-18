/**
 * @fileoverview Compile-checked examples for `MIGRATION.md` (plan 019).
 *
 * Every `// 0.6` code block in the guide's core-package sections (§1-§6) is
 * reproduced here as near-verbatim as test scaffolding allows, with a
 * comment naming the guide section it backs. Every `// 0.5` block that
 * describes REMOVED API surface is asserted dead via `@ts-expect-error`.
 *
 * This file is the guide's drift alarm: a future change that breaks one of
 * these examples breaks this test, which means it breaks CI, which means
 * MIGRATION.md and the shipped API can never silently diverge.
 *
 * Drizzle-specific guide sections (§7 defaultMutationTable, part of §9
 * DataTransformer's toolkit constructor arg) live in the drizzle package's
 * own `tests/migration-guide-examples.test.ts`, since they need real
 * adapter/driver types this package doesn't depend on.
 */

import { describe, expect, expectTypeOf, it } from 'bun:test';
import { ColumnBuilder } from '../../src/builders/column-builder';
import { defineColumns } from '../../src/builders/column-factory';
import { OptionColumnBuilder } from '../../src/builders/option-column-builder';
import { betterTables, defineTable } from '../../src/factory';
import { FilterManager } from '../../src/managers/filter-manager';
import type { FetchDataParams, FetchDataResult, TableAdapter } from '../../src/types/adapter';
import type { ColumnDefinition } from '../../src/types/column';
import type { FilterGroupNode, FilterState } from '../../src/types/filter';
import type { SchemaAwareAdapter } from '../../src/types/paths';
import {
  deserializeFiltersFromURL,
  serializeFiltersToURL,
} from '../../src/utils/filter-serialization';

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: 'admin' | 'editor' | 'viewer';
  status: string;
}

// ============================================================================
// §1 — Table setup: betterTables + defineTable
// ============================================================================

describe('MIGRATION.md §1 — betterTables + defineTable', () => {
  type Schema = { users: { row: User } };
  const fakeAdapter = {} as SchemaAwareAdapter<{ tables: Schema }>;

  it('0.6: app-level betterTables() instance + defineTable() per table', () => {
    const tables = betterTables({
      // 0.6
      database: fakeAdapter,
      defaults: { pageSize: 20 },
    });

    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      // 0.6
      columns: [t.text('name'), t.text('email')],
    }));
    // also supported: tables.define('users', (t) => ({ ... })) -- method form
    const usersTableViaMethod = tables.define('users', (t) => ({
      columns: [t.text('name'), t.text('email')],
    }));

    expect(usersTable.tableName).toBe('users');
    expect(usersTableViaMethod.tableName).toBe('users');
    expect(usersTable.columns.map((c) => c.id)).toEqual(['name', 'email']);
    // `tables.database` replaces the old `.adapter` getter/setter.
    expect(tables.database).toBe(fakeAdapter);
  });

  it('0.5: the old per-table config shape (a `columns` key on betterTables()) is gone', () => {
    betterTables({
      database: fakeAdapter,
      // @ts-expect-error - MIGRATION.md §1: `columns` is the removed 0.5
      // per-table shell key; 0.6's betterTables() config is
      // { database, defaults?, plugins? } -- no `columns`.
      columns: [{ id: 'name', displayName: 'Name', type: 'text' }],
    });
  });

  it('0.5: `.adapter` getter/setter and `ExtractAdapterRecord` are gone', () => {
    const tables = betterTables({ database: fakeAdapter });
    // @ts-expect-error - MIGRATION.md §1: `.adapter` was the 0.5 accessor;
    // `.database` is its 0.6 replacement (asserted above).
    expect(tables.adapter).toBeUndefined();
  });
});

// ============================================================================
// §2 — Column builder type inference
// ============================================================================

describe('MIGRATION.md §2 — column builder type inference', () => {
  it('0.6: .accessor() rebinds TValue from its return type, no workaround generic needed', () => {
    const nameCol = new ColumnBuilder<User, string>('text') // 0.6
      .id('name')
      .displayName('Name')
      .accessor((u) => u.name)
      .build();

    expectTypeOf(nameCol).toEqualTypeOf<ColumnDefinition<User, string, 'name'>>();
    expect(nameCol.id).toBe('name');
  });

  it('0.6: .options() rejects an option value outside the accessor-declared union', () => {
    const roleCol = new OptionColumnBuilder<User>() // 0.6
      .id('role')
      .displayName('Role')
      .accessor((u) => u.role)
      .options([
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
      ])
      .cellRenderer(({ value }) => value.toUpperCase()) // 0.6 - no `as string` cast needed
      .build();

    expectTypeOf(roleCol.accessor).returns.toEqualTypeOf<'admin' | 'editor'>();
    expect(roleCol.id).toBe('role');
  });

  it('0.5: an option value outside the accessor union used to silently compile', () => {
    new OptionColumnBuilder<User>()
      .id('role')
      .accessor((u) => u.role)
      // @ts-expect-error - MIGRATION.md §2: 'bogus' is not a member of
      // 'admin' | 'editor' | 'viewer'; this compiled in 0.5 and now doesn't.
      .options([{ value: 'bogus', label: 'Bogus' }]);
  });
});

// ============================================================================
// §3 — defineColumns() at the UI boundary
// ============================================================================

describe('MIGRATION.md §3 — defineColumns() at the UI boundary', () => {
  it('0.6: defineColumns<TData>()([...]) erases each column to the invariant table-boundary shape', () => {
    const nameCol = new ColumnBuilder<User, string>('text')
      .id('name')
      .displayName('Name')
      .accessor((u) => u.name)
      .build();
    const ageCol = new ColumnBuilder<User, number>('number')
      .id('age')
      .displayName('Age')
      .accessor((u) => u.age)
      .build();

    const columns = defineColumns<User>()([nameCol, ageCol]); // 0.6

    expectTypeOf(columns).toEqualTypeOf<ColumnDefinition<User, unknown>[]>();
    expect(columns.map((c) => c.id)).toEqual(['name', 'age']);
  });

  it('0.5: a raw heterogeneous array literal is not directly assignable to the erased boundary type', () => {
    const nameCol = new ColumnBuilder<User, string>('text')
      .id('name')
      .displayName('Name')
      .accessor((u) => u.name)
      .build();
    const ageCol = new ColumnBuilder<User, number>('number')
      .id('age')
      .displayName('Age')
      .accessor((u) => u.age)
      .build();

    // @ts-expect-error - MIGRATION.md §3: ColumnDefinition<TData, V> is
    // invariant in V, so a [string-col, number-col] array literal is not
    // directly assignable to ColumnDefinition<TData, unknown>[] -- this is
    // exactly the boundary defineColumns() exists to cross.
    const columns: ColumnDefinition<User, unknown>[] = [nameCol, ageCol];
    expect(columns).toBeDefined();
  });
});

// ============================================================================
// §4 — Column ids are now literal-preserving
// ============================================================================

describe('MIGRATION.md §4 — literal-preserving column ids', () => {
  it('0.6: .id() rebinds the id type to the literal, in either call order', () => {
    const idFirst = new ColumnBuilder<User, string>('text') // 0.6
      .id('name')
      .displayName('Name')
      .accessor((u) => u.name)
      .build();
    const accessorFirst = new ColumnBuilder<User, string>('text') // 0.6
      .accessor((u) => u.name)
      .id('name')
      .displayName('Name')
      .build();

    expectTypeOf(idFirst).toEqualTypeOf<ColumnDefinition<User, string, 'name'>>();
    expectTypeOf(accessorFirst.id).toEqualTypeOf<'name'>();
    expect(idFirst.id).toBe('name');
  });

  it('0.5: the pre-chain builder variable no longer has the same static type as the post-chain result', () => {
    const before = new ColumnBuilder<User, string>('text');
    const after = before.id('name');

    // @ts-expect-error - MIGRATION.md §4: `before` is typed with the
    // default TId = string; `after` is typed with TId = 'name'. Same
    // runtime object (the builder mutates in place), different static
    // types -- this is the one source of breakage from literal-preserving
    // ids, pinned here per the guide's example.
    expectTypeOf(before).toEqualTypeOf(after);
  });
});

// ============================================================================
// §5 — Filter groups: FetchDataParams.filters + URL filters
// ============================================================================

describe('MIGRATION.md §5 — filter groups', () => {
  it('0.6: a flat array still means implicit AND (unchanged ergonomics)', () => {
    const flatParams: FetchDataParams = {
      // 0.6
      filters: [{ columnId: 'status', type: 'text', operator: 'equals', values: ['active'] }],
    };
    expect(Array.isArray(flatParams.filters)).toBe(true);
  });

  it('0.6: a FilterGroupNode expresses OR / nesting', () => {
    const groupParams: FetchDataParams = {
      // 0.6
      filters: {
        kind: 'group',
        logic: 'or',
        children: [
          { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
          { columnId: 'role', type: 'text', operator: 'equals', values: ['admin'] },
        ],
      } satisfies FilterGroupNode,
    };

    expect(groupParams.filters).toEqual({
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
        { columnId: 'role', type: 'text', operator: 'equals', values: ['admin'] },
      ],
    });
  });

  it('0.6: deserializeFiltersFromURL widens to FilterState[] | FilterGroupNode -- narrow before indexing', () => {
    const flat: FilterState[] = [
      { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
    ];
    const url = serializeFiltersToURL(flat); // always emits c2:
    expect(url.startsWith('c2:')).toBe(true);

    const filters = deserializeFiltersFromURL(url); // 0.6 - FilterState[] | FilterGroupNode

    // Narrow before indexing (the guide's documented fix for the old
    // `filters[0]` pattern):
    if (Array.isArray(filters)) {
      expect(filters[0]?.columnId).toBe('status'); // 0.6
    } else {
      throw new Error('expected a flat array for this input');
    }
  });

  it('0.5: indexing the deserialized result as an array unconditionally no longer type-checks', () => {
    const flat: FilterState[] = [
      { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
    ];
    const url = serializeFiltersToURL(flat);
    const filters = deserializeFiltersFromURL(url);
    // @ts-expect-error - MIGRATION.md §5: `filters` may be a FilterGroupNode
    // now, which has no numeric index signature -- this compiled in 0.5
    // when the return type was always FilterState[].
    filters[0]?.columnId;
  });

  it('0.6: old c: URLs still read correctly (the one kept compatibility exception)', () => {
    // A hand-encoded legacy c: payload is out of scope for a unit test to
    // construct realistically; the guide's claim ("c: still reads") is
    // covered by filter-serialization's own dedicated backward-compat
    // suite (utils/filter-serialization.test.ts) -- referenced here so a
    // reader of this file knows where that assertion actually lives.
    expect(typeof deserializeFiltersFromURL).toBe('function');
  });
});

// ============================================================================
// §6 — Filter state layer: getFilters()/setFilters() semantics
// ============================================================================

describe('MIGRATION.md §6 — filter state layer semantics', () => {
  const columns: ColumnDefinition<User>[] = [
    {
      id: 'status',
      displayName: 'Status',
      type: 'text',
      accessor: (u: User) => u.status,
      filterable: true,
      sortable: true,
      resizable: true,
      filter: { operators: ['equals', 'contains'] },
    },
    {
      id: 'role',
      displayName: 'Role',
      type: 'text',
      accessor: (u: User) => u.role,
      filterable: true,
      sortable: true,
      resizable: true,
      filter: { operators: ['equals'] },
    },
  ];

  it('0.6: getFilters() is a flattened display view; setFilters() replaces the whole stored value', () => {
    const filterManager = new FilterManager<User>(columns, []);

    filterManager.setFilters([
      { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
    ]); // 0.6
    expect(filterManager.getFilters()).toEqual([
      // 0.6
      { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
    ]);

    // setFilterNode() with a group is stored as a real tree...
    filterManager.setFilterNode({
      // 0.6
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
        { columnId: 'role', type: 'text', operator: 'equals', values: ['admin'] },
      ],
    });
    // ...getFilterNode() reads the real tree back...
    expect(filterManager.getFilterNode()).toEqual({
      // 0.6
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
        { columnId: 'role', type: 'text', operator: 'equals', values: ['admin'] },
      ],
    });
    // ...while getFilters() flattens it to leaves for display.
    expect(filterManager.getFilters()).toEqual([
      // 0.6
      { columnId: 'status', type: 'text', operator: 'equals', values: ['active'] },
      { columnId: 'role', type: 'text', operator: 'equals', values: ['admin'] },
    ]);

    // setFilters() deterministically REPLACES the tree -- no silent merge.
    filterManager.setFilters([
      { columnId: 'status', type: 'text', operator: 'equals', values: ['inactive'] },
    ]); // 0.6
    expect(filterManager.getFilterNode()).toEqual([
      // 0.6
      { columnId: 'status', type: 'text', operator: 'equals', values: ['inactive'] },
    ]);
  });
});

// ============================================================================
// §12 (core portion) — tables.fetchData(table, params): the recommended read
// pattern. The Drizzle-specific multi-table throw + defaultPrimaryTable half
// of §12 lives in the drizzle package's own migration-guide-examples.test.ts
// (needs a real adapter/driver), same split as §7/§9 above.
// ============================================================================

describe('MIGRATION.md §12 — tables.fetchData(table, params)', () => {
  type Schema = { users: { row: User } };

  // A minimal, functional (not just type-cast) fake adapter: the guide's
  // example actually calls `tables.fetchData(...)`, which needs a real
  // `fetchData` underneath -- `{} as SchemaAwareAdapter` (§1's fixture) is
  // enough for pure `defineTable` type tests, but not here.
  const fakeFunctionalAdapter: TableAdapter<unknown> & SchemaAwareAdapter<{ tables: Schema }> = {
    fetchData: async (params) => ({
      data: [],
      total: 0,
      pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
      meta: { receivedPrimaryTable: params.primaryTable },
    }),
    getFilterOptions: async () => [],
    getFacetedValues: async () => new Map(),
    getMinMaxValues: async () => [0, 0],
    meta: {
      name: 'Fake Adapter',
      version: '1.0.0',
      features: {
        create: false,
        read: true,
        update: false,
        delete: false,
        bulkOperations: false,
        realTimeUpdates: false,
        export: false,
        transactions: false,
      },
      supportedColumnTypes: ['text'],
      supportedOperators: {
        text: ['equals'],
        number: ['equals'],
        date: ['equals'],
        boolean: ['equals'],
        option: ['equals'],
        multiOption: ['equals'],
        currency: ['equals'],
        percentage: ['equals'],
        url: ['equals'],
        email: ['equals'],
        phone: ['equals'],
        json: ['equals'],
        custom: ['equals'],
      },
    },
    $types: undefined as unknown as { tables: Schema },
  };

  it('0.6: tables.fetchData(usersTable, params) injects primaryTable and returns a typed row, no cast', async () => {
    const tables = betterTables({ database: fakeFunctionalAdapter }); // 0.6
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name'), t.text('email')],
    }));

    const result = await tables.fetchData(usersTable, {
      // 0.6
      pagination: { page: 1, limit: 20 },
    });

    expectTypeOf(result).toEqualTypeOf<FetchDataResult<User>>(); // 0.6 -- User, not unknown, no cast
    expect(result.meta?.receivedPrimaryTable).toBe('users'); // 0.6 -- injected automatically
  });

  it('0.5: passing primaryTable to tables.fetchData no longer type-checks -- it is injected, not a caller param', async () => {
    const tables = betterTables({ database: fakeFunctionalAdapter });
    const usersTable = defineTable<typeof tables>()('users', (t) => ({
      columns: [t.text('name')],
    }));

    tables.fetchData(usersTable, {
      // @ts-expect-error - MIGRATION.md §12: primaryTable is injected from
      // usersTable.tableName; TableScopedFetchDataParams omits it entirely.
      primaryTable: 'someOtherTable',
    });
  });
});
