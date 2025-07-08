import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ColumnDefinition,
  ColumnType,
  CellRendererProps,
  HeaderRendererProps,
  ValidationRule,
  ColumnVisibility,
  ColumnOrder,
} from '../../src/types';

describe('Column Types', () => {
  describe('ColumnDefinition', () => {
    it('should have correct structure for a basic column', () => {
      const column: ColumnDefinition<{ name: string }, string> = {
        id: 'name',
        displayName: 'Name',
        accessor: (row) => row.name,
        type: 'text',
      };

      expectTypeOf(column.id).toBeString();
      expectTypeOf(column.displayName).toBeString();
      expectTypeOf(column.accessor).toBeFunction();
      expectTypeOf(column.type).toEqualTypeOf<ColumnType>();
    });

    it('should support all column types', () => {
      const columnTypes: ColumnType[] = [
        'text',
        'number',
        'date',
        'boolean',
        'option',
        'multiOption',
        'currency',
        'percentage',
        'url',
        'email',
        'phone',
        'json',
        'custom',
      ];

      columnTypes.forEach((type) => {
        const column: ColumnDefinition = {
          id: 'test',
          displayName: 'Test',
          accessor: (row) => row.test,
          type,
        };
        expect(column.type).toBe(type);
      });
    });

    it('should support optional properties', () => {
      const column: ColumnDefinition<{ value: number }, number> = {
        id: 'value',
        displayName: 'Value',
        accessor: (row) => row.value,
        type: 'number',
        sortable: true,
        filterable: true,
        resizable: true,
        width: 100,
        minWidth: 50,
        maxWidth: 200,
        align: 'right',
        nullable: true,
        meta: { custom: 'data' },
      };

      expectTypeOf(column.sortable).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(column.width).toEqualTypeOf<number | undefined>();
      expectTypeOf(column.align).toEqualTypeOf<'left' | 'center' | 'right' | undefined>();
    });

    it('should support custom renderers', () => {
      const column: ColumnDefinition<{ value: string }, string> = {
        id: 'custom',
        displayName: 'Custom',
        accessor: (row) => row.value,
        type: 'text',
        cellRenderer: ({ value, row: _row, column: _column }) => `Custom: ${value}`,
        headerRenderer: ({ column, isSorted: _isSorted, sortDirection: _sortDirection }) => `Header: ${column.displayName}`,
      };

      expectTypeOf(column.cellRenderer).toEqualTypeOf<
        ((props: CellRendererProps<{ value: string }, string>) => React.ReactNode) | undefined
      >();
    });

    it('should support validation rules', () => {
      const validationRule: ValidationRule<string> = {
        id: 'minLength',
        validate: (value) => value.length >= 3,
        message: 'Must be at least 3 characters',
      };

      const column: ColumnDefinition<any, string> = {
        id: 'validated',
        displayName: 'Validated',
        accessor: (row) => row.value,
        type: 'text',
        validation: [validationRule],
      };

      expect(column.validation).toHaveLength(1);
      expectTypeOf(column.validation![0].validate).toBeFunction();
    });
  });

  describe('CellRendererProps', () => {
    it('should extend RenderProps with correct types', () => {
      type TestData = { id: string; name: string };
      type TestValue = string;

      const props: CellRendererProps<TestData, TestValue> = {
        row: { id: '1', name: 'Test' },
        value: 'Test',
        column: {
          id: 'name',
          displayName: 'Name',
          accessor: (row) => row.name,
          type: 'text',
        },
        rowIndex: 0,
        isSelected: true,
        isExpanded: false,
      };

      expectTypeOf(props.row).toEqualTypeOf<TestData>();
      expectTypeOf(props.value).toEqualTypeOf<TestValue>();
      expectTypeOf(props.column).toEqualTypeOf<ColumnDefinition<TestData, TestValue>>();
      expectTypeOf(props.isSelected).toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('HeaderRendererProps', () => {
    it('should have correct structure', () => {
      type TestData = { id: string };
      
      const props: HeaderRendererProps<TestData> = {
        column: {
          id: 'id',
          displayName: 'ID',
          accessor: (row) => row.id,
          type: 'text',
        },
        isSorted: true,
        sortDirection: 'asc',
        onSort: () => {},
        isResizing: false,
      };

      expectTypeOf(props.column).toEqualTypeOf<ColumnDefinition<TestData>>();
      expectTypeOf(props.sortDirection).toEqualTypeOf<'asc' | 'desc' | undefined>();
      expectTypeOf(props.onSort).toEqualTypeOf<(() => void) | undefined>();
    });
  });

  describe('Column utility types', () => {
    it('should type ColumnVisibility correctly', () => {
      const visibility: ColumnVisibility = {
        name: true,
        email: false,
        phone: true,
      };

      expectTypeOf(visibility).toEqualTypeOf<Record<string, boolean>>();
    });

    it('should type ColumnOrder correctly', () => {
      const order: ColumnOrder = ['name', 'email', 'phone'];
      
      expectTypeOf(order).toEqualTypeOf<string[]>();
    });
  });
}); 