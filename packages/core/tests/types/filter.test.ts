import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  FilterOperator,
  FilterConfig,
  FilterOption,
  FilterState,
  FilterGroup,
  FilterComponentProps,
  FilterOperatorDefinition,
  ColumnType,
  ColumnDefinition,
} from '../../src/types';

describe('Filter Types', () => {
  describe('FilterOperator', () => {
    it('should include all text operators', () => {
      const textOperators: FilterOperator[] = [
        'contains',
        'equals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
      ];

      textOperators.forEach((op) => {
        const filter: FilterState = {
          columnId: 'text',
          type: 'text',
          operator: op,
          values: ['test'],
        };
        expectTypeOf(filter.operator).toEqualTypeOf<FilterOperator>();
      });
    });

    it('should include all number operators', () => {
      const numberOperators: FilterOperator[] = [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
      ];

      numberOperators.forEach((op) => {
        const filter: FilterState = {
          columnId: 'number',
          type: 'number',
          operator: op,
          values: [42],
        };
        expect(filter.operator).toBe(op);
      });
    });

    it('should include all date operators', () => {
      const dateOperators: FilterOperator[] = [
        'is',
        'isNot',
        'before',
        'after',
        'between',
        'isToday',
        'isYesterday',
        'isThisWeek',
        'isThisMonth',
        'isThisYear',
      ];

      dateOperators.forEach((op) => {
        const filter: FilterState = {
          columnId: 'date',
          type: 'date',
          operator: op,
          values: [new Date()],
        };
        expect(filter.operator).toBe(op);
      });
    });
  });

  describe('FilterConfig', () => {
    it('should have correct structure', () => {
      const config: FilterConfig<string> = {
        operators: ['contains', 'equals'],
        options: [
          { value: 'opt1', label: 'Option 1' },
          { value: 'opt2', label: 'Option 2', color: 'blue' },
        ],
        includeNull: true,
        debounce: 300,
        validation: (value) => value.length > 0,
      };

      expectTypeOf(config.operators).toEqualTypeOf<FilterOperator[] | undefined>();
      expectTypeOf(config.options).toEqualTypeOf<FilterOption[] | undefined>();
      expectTypeOf(config.validation).toEqualTypeOf<((value: string) => boolean | string) | undefined>();
    });

    it('should support number-specific config', () => {
      const config: FilterConfig<number> = {
        min: 0,
        max: 100,
        operators: ['equals', 'between'],
      };

      expectTypeOf(config.min).toEqualTypeOf<number | undefined>();
      expectTypeOf(config.max).toEqualTypeOf<number | undefined>();
    });
  });

  describe('FilterOption', () => {
    it('should support all properties', () => {
      const option: FilterOption = {
        value: 'active',
        label: 'Active',
        color: 'green',
        count: 42,
        meta: { description: 'Active status' },
      };

      expectTypeOf(option.value).toBeString();
      expectTypeOf(option.label).toBeString();
      expectTypeOf(option.color).toEqualTypeOf<string | undefined>();
      expectTypeOf(option.count).toEqualTypeOf<number | undefined>();
    });
  });

  describe('FilterState', () => {
    it('should represent active filter state', () => {
      const textFilter: FilterState = {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['john'],
        includeNull: false,
      };

      const numberFilter: FilterState = {
        columnId: 'age',
        type: 'number',
        operator: 'between',
        values: [18, 65],
      };

      const multiOptionFilter: FilterState = {
        columnId: 'tags',
        type: 'multiOption',
        operator: 'includesAny',
        values: ['tag1', 'tag2', 'tag3'],
        meta: { matchMode: 'any' },
      };

      expectTypeOf(textFilter.type).toEqualTypeOf<ColumnType>();
      expectTypeOf(numberFilter.values).toEqualTypeOf<any[]>();
      expectTypeOf(multiOptionFilter.meta).toEqualTypeOf<Record<string, any> | undefined>();
    });
  });

  describe('FilterGroup', () => {
    it('should organize filters into groups', () => {
      const group: FilterGroup = {
        id: 'personal',
        label: 'Personal Information',
        columns: ['name', 'email', 'phone'],
        defaultCollapsed: false,
        description: 'Basic personal information filters',
      };

      expectTypeOf(group.columns).toEqualTypeOf<string[]>();
      expectTypeOf(group.defaultCollapsed).toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('FilterComponentProps', () => {
    it('should provide props for custom filter components', () => {
      const column: ColumnDefinition<any, string> = {
        id: 'custom',
        displayName: 'Custom',
        accessor: (row) => row.custom,
        type: 'text',
      };

      const props: FilterComponentProps<string> = {
        value: ['test'],
        onChange: (newValue) => console.log(newValue),
        operator: 'contains',
        column,
      };

      expectTypeOf(props.value).toEqualTypeOf<string[]>();
      expectTypeOf(props.onChange).toBeFunction();
      expectTypeOf(props.column).toEqualTypeOf<ColumnDefinition<any, string>>();
    });
  });

  describe('FilterOperatorDefinition', () => {
    it('should define operator properties', () => {
      const operatorDef: FilterOperatorDefinition = {
        key: 'between',
        label: 'Between',
        description: 'Value is between two numbers',
        valueCount: 2,
        supportsNull: false,
        validate: (values) => values.length === 2 && values[0] < values[1],
      };

      expectTypeOf(operatorDef.valueCount).toEqualTypeOf<number | 'variable'>();
      expectTypeOf(operatorDef.validate).toEqualTypeOf<((values: any[]) => boolean | string) | undefined>();
    });

    it('should support variable value count', () => {
      const operatorDef: FilterOperatorDefinition = {
        key: 'isAnyOf',
        label: 'Is any of',
        valueCount: 'variable',
      };

      expect(operatorDef.valueCount).toBe('variable');
    });
  });
}); 