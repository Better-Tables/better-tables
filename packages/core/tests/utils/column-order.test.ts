import { describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '../../src/types/column';
import {
  getColumnOrderModifications,
  getDefaultColumnOrder,
  mergeColumnOrder,
} from '../../src/utils/column-order';

interface TestData {
  id: string;
  name: string;
  email: string;
  age: number;
}

describe('Column Order Utilities', () => {
  const createMockColumn = (id: string): ColumnDefinition<TestData, unknown> => ({
    id,
    displayName: id,
    accessor: () => null,
    type: 'text',
  });

  const mockColumns: ColumnDefinition<TestData, unknown>[] = [
    createMockColumn('name'),
    createMockColumn('email'),
    createMockColumn('age'),
  ];

  describe('getDefaultColumnOrder', () => {
    it('should return column IDs in definition order', () => {
      const order = getDefaultColumnOrder(mockColumns);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should handle empty columns array', () => {
      const order = getDefaultColumnOrder([]);

      expect(order).toEqual([]);
    });

    it('should handle single column', () => {
      const singleColumn = [createMockColumn('id')];
      const order = getDefaultColumnOrder(singleColumn);

      expect(order).toEqual(['id']);
    });

    it('should preserve order of multiple columns', () => {
      const manyColumns = [
        createMockColumn('id'),
        createMockColumn('name'),
        createMockColumn('email'),
        createMockColumn('created'),
        createMockColumn('updated'),
      ];
      const order = getDefaultColumnOrder(manyColumns);

      expect(order).toEqual(['id', 'name', 'email', 'created', 'updated']);
    });
  });

  describe('getColumnOrderModifications', () => {
    it('should return empty array when order matches default', () => {
      const currentOrder: string[] = ['name', 'email', 'age'];
      const modifications = getColumnOrderModifications(mockColumns, currentOrder);

      expect(modifications).toEqual([]);
    });

    it('should return full order when modified', () => {
      const currentOrder: string[] = ['email', 'name', 'age'];
      const modifications = getColumnOrderModifications(mockColumns, currentOrder);

      expect(modifications).toEqual(['email', 'name', 'age']);
    });

    it('should return full order when length differs from default', () => {
      const currentOrder: string[] = ['name', 'email'];
      const modifications = getColumnOrderModifications(mockColumns, currentOrder);

      expect(modifications).toEqual(['name', 'email']);
    });

    it('should return full order when length is greater than default', () => {
      const currentOrder: string[] = ['name', 'email', 'age', 'extra'];
      const modifications = getColumnOrderModifications(mockColumns, currentOrder);

      expect(modifications).toEqual(['name', 'email', 'age', 'extra']);
    });

    it('should detect reordering of middle elements', () => {
      const currentOrder: string[] = ['name', 'age', 'email'];
      const modifications = getColumnOrderModifications(mockColumns, currentOrder);

      expect(modifications).toEqual(['name', 'age', 'email']);
    });

    it('should handle empty arrays', () => {
      const currentOrder: string[] = [];
      const modifications = getColumnOrderModifications(mockColumns, currentOrder);

      expect(modifications).toEqual([]);
    });

    it('should handle single column', () => {
      const singleColumn = [createMockColumn('id')];
      const currentOrder: string[] = ['id'];
      const modifications = getColumnOrderModifications(singleColumn, currentOrder);

      expect(modifications).toEqual([]);
    });
  });

  describe('mergeColumnOrder', () => {
    it('should return default order when modifications is empty', () => {
      const modifications: string[] = [];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should apply valid modifications', () => {
      const modifications: string[] = ['email', 'name', 'age'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['email', 'name', 'age']);
    });

    it('should return default order when modifications length differs', () => {
      const modifications: string[] = ['name', 'email'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should return default order when modifications length is greater', () => {
      const modifications: string[] = ['name', 'email', 'age', 'extra'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should return default order when modifications contain invalid column IDs', () => {
      const modifications: string[] = ['name', 'invalid', 'age'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should return default order when modifications contain duplicate IDs', () => {
      const modifications: string[] = ['name', 'email', 'name'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should return default order when all modifications are invalid', () => {
      const modifications: string[] = ['invalid1', 'invalid2'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['name', 'email', 'age']);
    });

    it('should handle empty columns array', () => {
      const modifications: string[] = [];
      const order = mergeColumnOrder([], modifications);

      expect(order).toEqual([]);
    });

    it('should handle single column', () => {
      const singleColumn = [createMockColumn('id')];
      const modifications: string[] = ['id'];
      const order = mergeColumnOrder(singleColumn, modifications);

      expect(order).toEqual(['id']);
    });

    it('should preserve all columns in modifications', () => {
      const allColumns = [
        createMockColumn('id'),
        createMockColumn('name'),
        createMockColumn('email'),
        createMockColumn('age'),
      ];
      const modifications: string[] = ['email', 'id', 'age', 'name'];
      const order = mergeColumnOrder(allColumns, modifications);

      expect(order).toEqual(['email', 'id', 'age', 'name']);
    });

    it('should handle complete reorder', () => {
      const modifications: string[] = ['age', 'email', 'name'];
      const order = mergeColumnOrder(mockColumns, modifications);

      expect(order).toEqual(['age', 'email', 'name']);
    });

    it('should return default order when modifications are partial', () => {
      const modifications: string[] = ['name', 'email'];
      const order = mergeColumnOrder(mockColumns, modifications);

      // Should return default because length doesn't match
      expect(order).toEqual(['name', 'email', 'age']);
    });
  });

  describe('Edge cases', () => {
    it('should handle columns added after order was saved', () => {
      const originalOrder: string[] = ['name', 'email'];
      const expandedColumns = [...mockColumns, createMockColumn('created')];

      const order = mergeColumnOrder(expandedColumns, originalOrder);
      // Should return default order because lengths don't match
      expect(order).toEqual(['name', 'email', 'age', 'created']);
    });

    it('should handle columns removed after order was saved', () => {
      const originalOrder: string[] = ['name', 'email', 'age', 'removed'];
      const reducedColumns = [createMockColumn('name'), createMockColumn('email')];

      const order = mergeColumnOrder(reducedColumns, originalOrder);
      // Should return default order because lengths don't match
      expect(order).toEqual(['name', 'email']);
    });

    it('should handle duplicate columns in definition', () => {
      const columnsWithDuplicate = [
        createMockColumn('name'),
        createMockColumn('name'),
        createMockColumn('email'),
      ];

      const order = getDefaultColumnOrder(columnsWithDuplicate);
      expect(order).toEqual(['name', 'name', 'email']);
    });
  });
});
