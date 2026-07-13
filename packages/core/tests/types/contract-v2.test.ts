import { describe, expect, expectTypeOf, it } from 'bun:test';
import {
  type ColumnDefLike,
  type ColumnRegistry,
  type FilterNode,
  type FilterStateFor,
  isFilterGroupNode,
  type RegistryFromRow,
  type TableAdapterV2,
} from '../../src/types/experimental/contract-v2';
import type { FilterState } from '../../src/types/filter';

/**
 * Type-level acceptance tests for the plan 006 "core contract v2" prototype
 * (`src/types/experimental/contract-v2.ts`). See
 * `plans/design/core-contract-v2.md` for the design these validate.
 *
 * Every negative case is pinned with `@ts-expect-error`, so a regression that
 * ACCEPTS the bad shape fails the build (the directive becomes unused).
 */

// A minimal flagship registry (design's running example) and matching row.
type Registry = { name: string; age: number };

interface User {
  name: string;
  age: number;
}

describe('contract-v2 prototype (plan 006)', () => {
  describe('Step 1 -- recursive AND/OR filter groups', () => {
    it('typechecks a nested (status AND (role OR role)) tree as a FilterNode', () => {
      // (status = 'active' AND (role = 'admin' OR role = 'editor'))
      const tree: FilterNode = {
        kind: 'group',
        logic: 'and',
        children: [
          { columnId: 'status', operator: 'isAnyOf', values: ['active'] },
          {
            kind: 'group',
            logic: 'or',
            children: [
              { columnId: 'role', operator: 'isAnyOf', values: ['admin'] },
              { columnId: 'role', operator: 'isAnyOf', values: ['editor'] },
            ],
          },
        ],
      };

      // The `: FilterNode` annotation above IS the type-level assertion -- the
      // literal would not compile if the nested tree were not a FilterNode.
      // The runtime guard then narrows the group correctly.
      expect(isFilterGroupNode(tree)).toBe(true);
      if (isFilterGroupNode(tree)) {
        expect(tree.logic).toBe('and');
        expect(tree.children).toHaveLength(2);
      }
    });

    it('narrows a leaf as NOT a group via isFilterGroupNode', () => {
      const leaf: FilterNode = { columnId: 'status', operator: 'equals', values: ['x'] };
      expect(isFilterGroupNode(leaf)).toBe(false);
    });

    it("rejects a group whose logic is neither 'and' nor 'or'", () => {
      // @ts-expect-error - 'xor' is not assignable to FilterGroupLogic ('and' | 'or')
      const xorGroup: FilterNode = { kind: 'group', logic: 'xor', children: [] };
      expect(xorGroup).toBeDefined();
    });
  });

  describe('Step 2 -- typed column registry narrows columnId and values', () => {
    it('rejects a filter whose columnId is a typo (not a registered id)', () => {
      // @ts-expect-error - 'nam' is not a key of the registry ('name' | 'age')
      const typo: FilterStateFor<Registry> = { columnId: 'nam', operator: 'equals', values: ['x'] };
      expect(typo).toBeDefined();
    });

    it('rejects number-typed values on a string column', () => {
      // @ts-expect-error - 'name' holds string values; number[] is not assignable
      const wrong: FilterStateFor<Registry> = { columnId: 'name', operator: 'equals', values: [1] };
      expect(wrong).toBeDefined();
    });

    it('accepts a correctly-typed leaf for a registered column', () => {
      const ok: FilterStateFor<Registry> = {
        columnId: 'age',
        operator: 'greaterThan',
        values: [18],
      };
      expect(ok.columnId).toBe('age');
    });

    it('derives the registry from a column tuple keyed by id literals', () => {
      // Branded literal-id mock defs stand in for a real `define()` tuple until
      // literal-preserving `.id()` lands (see prototype header for the gap).
      type Columns = readonly [
        ColumnDefLike<User, string, 'name'>,
        ColumnDefLike<User, number, 'age'>,
      ];
      expectTypeOf<ColumnRegistry<Columns>>().toEqualTypeOf<Registry>();
    });

    it("derives the same registry straight from a row via plan 011's Paths/PathValue", () => {
      expectTypeOf<RegistryFromRow<User>>().toEqualTypeOf<Registry>();
    });
  });

  describe('Step 2.2 -- TReg threads through the adapter, defaulting to back-compat', () => {
    it('accepts plain strings everywhere when the registry is defaulted', () => {
      // A defaulted `TableAdapterV2<User>` keeps `columnId: string`, so untyped
      // (pre-registry) call sites keep compiling unchanged.
      function backCompat(adapter: TableAdapterV2<User>): void {
        void adapter.getFilterOptions('any-column');
        void adapter.getFacetedValues('another-column');
        void adapter.getMinMaxValues('age');
        void adapter.fetchData({
          columns: ['id', 'name', 'literally-anything'],
          filters: [{ columnId: 'whatever', operator: 'equals', values: ['x'] }],
        });
      }
      expect(typeof backCompat).toBe('function');
    });

    it('narrows keyed methods to registered columns when a registry is supplied', () => {
      function typed(adapter: TableAdapterV2<User, Registry>): void {
        void adapter.getFilterOptions('name');
        // @ts-expect-error - 'nope' is not a key of the supplied registry
        void adapter.getFilterOptions('nope');
      }
      expect(typeof typed).toBe('function');
    });
  });

  describe('back-compat -- a legacy FilterState is a valid FilterNode leaf', () => {
    it('flows an existing FilterState value straight into a FilterNode', () => {
      const legacy: FilterState = {
        type: 'text',
        columnId: 'name',
        operator: 'contains',
        values: ['ada'],
      };
      const asNode: FilterNode = legacy;
      expect(isFilterGroupNode(asNode)).toBe(false);
    });
  });
});
