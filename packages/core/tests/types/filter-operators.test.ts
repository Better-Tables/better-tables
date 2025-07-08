import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import {
  FILTER_OPERATORS,
  getOperatorsForType,
  getOperatorDefinition,
  getDefaultOperatorsForType,
  validateOperatorValues,
  createOperatorRegistry,
  getAllOperators,
  TEXT_OPERATORS,
  NUMBER_OPERATORS,
  DATE_OPERATORS,
  OPTION_OPERATORS,
  MULTI_OPTION_OPERATORS,
  BOOLEAN_OPERATORS,
  JSON_OPERATORS,
  FilterOperatorKey
} from '../../src/types/filter-operators';
import type { FilterOperator } from '../../src/types/filter';
import type { ColumnType } from '../../src/types/column';

describe('Filter Operators', () => {
  describe('FILTER_OPERATORS registry', () => {
    it('should have operators for all column types', () => {
      expect(FILTER_OPERATORS.text).toBeDefined();
      expect(FILTER_OPERATORS.number).toBeDefined();
      expect(FILTER_OPERATORS.date).toBeDefined();
      expect(FILTER_OPERATORS.boolean).toBeDefined();
      expect(FILTER_OPERATORS.option).toBeDefined();
      expect(FILTER_OPERATORS.multiOption).toBeDefined();
      expect(FILTER_OPERATORS.url).toBeDefined();
      expect(FILTER_OPERATORS.email).toBeDefined();
      expect(FILTER_OPERATORS.phone).toBeDefined();
      expect(FILTER_OPERATORS.currency).toBeDefined();
      expect(FILTER_OPERATORS.percentage).toBeDefined();
      expect(FILTER_OPERATORS.json).toBeDefined();
      expect(FILTER_OPERATORS.custom).toBeDefined();
    });

    it('should have text operators for text-based columns', () => {
      expect(FILTER_OPERATORS.text).toBe(TEXT_OPERATORS);
      expect(FILTER_OPERATORS.url).toBe(TEXT_OPERATORS);
      expect(FILTER_OPERATORS.email).toBe(TEXT_OPERATORS);
      expect(FILTER_OPERATORS.phone).toBe(TEXT_OPERATORS);
    });

    it('should have number operators for number-based columns', () => {
      expect(FILTER_OPERATORS.number).toBe(NUMBER_OPERATORS);
      expect(FILTER_OPERATORS.currency).toBe(NUMBER_OPERATORS);
      expect(FILTER_OPERATORS.percentage).toBe(NUMBER_OPERATORS);
    });

    it('should have empty array for custom column type', () => {
      expect(FILTER_OPERATORS.custom).toEqual([]);
    });
  });

  describe('TEXT_OPERATORS', () => {
    it('should include all text operators', () => {
      const operators = TEXT_OPERATORS.map(op => op.key);
      expect(operators).toContain('contains');
      expect(operators).toContain('equals');
      expect(operators).toContain('startsWith');
      expect(operators).toContain('endsWith');
      expect(operators).toContain('isEmpty');
      expect(operators).toContain('isNotEmpty');
    });

    it('should have proper validation for text operators', () => {
      const containsOp = TEXT_OPERATORS.find(op => op.key === 'contains');
      expect(containsOp).toBeDefined();
      expect(containsOp?.validate?.(['hello'])).toBe(true);
      expect(containsOp?.validate?.([123])).toBe(false);
      expect(containsOp?.validate?.(['hello', 'world'])).toBe(false);

      const isEmptyOp = TEXT_OPERATORS.find(op => op.key === 'isEmpty');
      expect(isEmptyOp).toBeDefined();
      expect(isEmptyOp?.validate?.([])).toBe(true);
      expect(isEmptyOp?.validate?.(['hello'])).toBe(false);
    });
  });

  describe('NUMBER_OPERATORS', () => {
    it('should include all number operators', () => {
      const operators = NUMBER_OPERATORS.map(op => op.key);
      expect(operators).toContain('equals');
      expect(operators).toContain('notEquals');
      expect(operators).toContain('greaterThan');
      expect(operators).toContain('greaterThanOrEqual');
      expect(operators).toContain('lessThan');
      expect(operators).toContain('lessThanOrEqual');
      expect(operators).toContain('between');
      expect(operators).toContain('notBetween');
      expect(operators).toContain('isNull');
      expect(operators).toContain('isNotNull');
    });

    it('should have proper validation for number operators', () => {
      const greaterThanOp = NUMBER_OPERATORS.find(op => op.key === 'greaterThan');
      expect(greaterThanOp).toBeDefined();
      expect(greaterThanOp?.validate?.([42])).toBe(true);
      expect(greaterThanOp?.validate?.(['42'])).toBe(false);
      expect(greaterThanOp?.validate?.([42, 50])).toBe(false);

      const betweenOp = NUMBER_OPERATORS.find(op => op.key === 'between');
      expect(betweenOp).toBeDefined();
      expect(betweenOp?.validate?.([10, 20])).toBe(true);
      expect(betweenOp?.validate?.([20, 10])).toBe(false);
      expect(betweenOp?.validate?.([10, 10])).toBe(true); // Equal values allowed
      expect(betweenOp?.validate?.([10])).toBe(false);
    });
  });

  describe('DATE_OPERATORS', () => {
    it('should include all date operators', () => {
      const operators = DATE_OPERATORS.map(op => op.key);
      expect(operators).toContain('is');
      expect(operators).toContain('isNot');
      expect(operators).toContain('before');
      expect(operators).toContain('after');
      expect(operators).toContain('between');
      expect(operators).toContain('notBetween');
      expect(operators).toContain('isToday');
      expect(operators).toContain('isYesterday');
      expect(operators).toContain('isThisWeek');
      expect(operators).toContain('isThisMonth');
      expect(operators).toContain('isThisYear');
      expect(operators).toContain('isNull');
      expect(operators).toContain('isNotNull');
    });

    it('should have proper validation for date operators', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-12-31');

      const beforeOp = DATE_OPERATORS.find(op => op.key === 'before');
      expect(beforeOp).toBeDefined();
      expect(beforeOp?.validate?.([date1])).toBe(true);
      expect(beforeOp?.validate?.(['2023-01-01'])).toBe(false);
      expect(beforeOp?.validate?.([date1, date2])).toBe(false);

      const betweenOp = DATE_OPERATORS.find(op => op.key === 'between');
      expect(betweenOp).toBeDefined();
      expect(betweenOp?.validate?.([date1, date2])).toBe(true);
      expect(betweenOp?.validate?.([date2, date1])).toBe(false);
      expect(betweenOp?.validate?.([date1, date1])).toBe(true); // Same date allowed
    });
  });

  describe('OPTION_OPERATORS', () => {
    it('should include all option operators', () => {
      const operators = OPTION_OPERATORS.map(op => op.key);
      expect(operators).toContain('is');
      expect(operators).toContain('isNot');
      expect(operators).toContain('isAnyOf');
      expect(operators).toContain('isNoneOf');
      expect(operators).toContain('isNull');
      expect(operators).toContain('isNotNull');
    });

    it('should have proper validation for option operators', () => {
      const isOp = OPTION_OPERATORS.find(op => op.key === 'is');
      expect(isOp).toBeDefined();
      expect(isOp?.validate?.(['active'])).toBe(true);
      expect(isOp?.validate?.([null])).toBe(false);
      expect(isOp?.validate?.(['active', 'inactive'])).toBe(false);

      const isAnyOfOp = OPTION_OPERATORS.find(op => op.key === 'isAnyOf');
      expect(isAnyOfOp).toBeDefined();
      expect(isAnyOfOp?.validate?.(['active', 'inactive'])).toBe(true);
      expect(isAnyOfOp?.validate?.(['active'])).toBe(true);
      expect(isAnyOfOp?.validate?.([])).toBe(false);
      expect(isAnyOfOp?.validate?.(['active', null])).toBe(false);
    });
  });

  describe('MULTI_OPTION_OPERATORS', () => {
    it('should include all multi-option operators', () => {
      const operators = MULTI_OPTION_OPERATORS.map(op => op.key);
      expect(operators).toContain('includes');
      expect(operators).toContain('excludes');
      expect(operators).toContain('includesAny');
      expect(operators).toContain('includesAll');
      expect(operators).toContain('excludesAny');
      expect(operators).toContain('excludesAll');
      expect(operators).toContain('isNull');
      expect(operators).toContain('isNotNull');
    });

    it('should have proper validation for multi-option operators', () => {
      const includesOp = MULTI_OPTION_OPERATORS.find(op => op.key === 'includes');
      expect(includesOp).toBeDefined();
      expect(includesOp?.validate?.(['tag1'])).toBe(true);
      expect(includesOp?.validate?.([null])).toBe(false);
      expect(includesOp?.validate?.(['tag1', 'tag2'])).toBe(false);

      const includesAnyOp = MULTI_OPTION_OPERATORS.find(op => op.key === 'includesAny');
      expect(includesAnyOp).toBeDefined();
      expect(includesAnyOp?.validate?.(['tag1', 'tag2'])).toBe(true);
      expect(includesAnyOp?.validate?.(['tag1'])).toBe(true);
      expect(includesAnyOp?.validate?.([])).toBe(false);
      expect(includesAnyOp?.validate?.(['tag1', null])).toBe(false);
    });
  });

  describe('BOOLEAN_OPERATORS', () => {
    it('should include all boolean operators', () => {
      const operators = BOOLEAN_OPERATORS.map(op => op.key);
      expect(operators).toContain('isTrue');
      expect(operators).toContain('isFalse');
      expect(operators).toContain('isNull');
      expect(operators).toContain('isNotNull');
    });

    it('should have proper validation for boolean operators', () => {
      const isTrueOp = BOOLEAN_OPERATORS.find(op => op.key === 'isTrue');
      expect(isTrueOp).toBeDefined();
      expect(isTrueOp?.validate?.([])).toBe(true);
      expect(isTrueOp?.validate?.([true])).toBe(false);
    });
  });

  describe('JSON_OPERATORS', () => {
    it('should include all JSON operators', () => {
      const operators = JSON_OPERATORS.map(op => op.key);
      expect(operators).toContain('contains');
      expect(operators).toContain('equals');
      expect(operators).toContain('isEmpty');
      expect(operators).toContain('isNotEmpty');
      expect(operators).toContain('isNull');
      expect(operators).toContain('isNotNull');
    });

    it('should have proper validation for JSON operators', () => {
      const containsOp = JSON_OPERATORS.find(op => op.key === 'contains');
      expect(containsOp).toBeDefined();
      expect(containsOp?.validate?.(['{"key": "value"}'])).toBe(true);
      expect(containsOp?.validate?.([123])).toBe(false);
    });
  });

  describe('getOperatorsForType', () => {
    it('should return correct operators for each column type', () => {
      expect(getOperatorsForType('text')).toBe(TEXT_OPERATORS);
      expect(getOperatorsForType('number')).toBe(NUMBER_OPERATORS);
      expect(getOperatorsForType('date')).toBe(DATE_OPERATORS);
      expect(getOperatorsForType('boolean')).toBe(BOOLEAN_OPERATORS);
      expect(getOperatorsForType('option')).toBe(OPTION_OPERATORS);
      expect(getOperatorsForType('multiOption')).toBe(MULTI_OPTION_OPERATORS);
      expect(getOperatorsForType('json')).toBe(JSON_OPERATORS);
    });

    it('should return empty array for unknown column type', () => {
      expect(getOperatorsForType('unknown' as ColumnType)).toEqual([]);
    });
  });

  describe('getOperatorDefinition', () => {
    it('should return correct operator definition', () => {
      const containsOp = getOperatorDefinition('contains');
      expect(containsOp).toBeDefined();
      expect(containsOp?.key).toBe('contains');
      expect(containsOp?.label).toBe('Contains');
      expect(containsOp?.valueCount).toBe(1);

      const isNullOp = getOperatorDefinition('isNull');
      expect(isNullOp).toBeDefined();
      expect(isNullOp?.key).toBe('isNull');
      expect(isNullOp?.supportsNull).toBe(true);
      expect(isNullOp?.valueCount).toBe(0);
    });

    it('should return undefined for unknown operator', () => {
      expect(getOperatorDefinition('unknownOperator' as FilterOperator)).toBeUndefined();
    });
  });

  describe('getDefaultOperatorsForType', () => {
    it('should return correct default operators for text types', () => {
      const textOps = getDefaultOperatorsForType('text');
      expect(textOps).toEqual(['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty']);
      
      const urlOps = getDefaultOperatorsForType('url');
      expect(urlOps).toEqual(textOps);
    });

    it('should return correct default operators for number types', () => {
      const numberOps = getDefaultOperatorsForType('number');
      expect(numberOps).toEqual(['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'notBetween']);
      
      const currencyOps = getDefaultOperatorsForType('currency');
      expect(currencyOps).toEqual(numberOps);
    });

    it('should return correct default operators for date type', () => {
      const dateOps = getDefaultOperatorsForType('date');
      expect(dateOps).toEqual(['is', 'isNot', 'before', 'after', 'isToday', 'isYesterday', 'isThisWeek', 'isThisMonth', 'isThisYear']);
    });

    it('should return correct default operators for boolean type', () => {
      const booleanOps = getDefaultOperatorsForType('boolean');
      expect(booleanOps).toEqual(['isTrue', 'isFalse', 'isNull', 'isNotNull']);
    });

    it('should return correct default operators for option types', () => {
      const optionOps = getDefaultOperatorsForType('option');
      expect(optionOps).toEqual(['is', 'isNot', 'isAnyOf', 'isNoneOf']);
      
      const multiOptionOps = getDefaultOperatorsForType('multiOption');
      expect(multiOptionOps).toEqual(['includes', 'excludes', 'includesAny', 'includesAll', 'excludesAny', 'excludesAll']);
    });

    it('should return fallback operators for unknown type', () => {
      const unknownOps = getDefaultOperatorsForType('unknown' as ColumnType);
      expect(unknownOps).toEqual(['equals', 'notEquals', 'isNull', 'isNotNull']);
    });
  });

  describe('validateOperatorValues', () => {
    it('should validate operator values correctly', () => {
      // Test single value operators
      expect(validateOperatorValues('contains', ['hello'])).toBe(true);
      expect(validateOperatorValues('contains', ['hello', 'world'])).toBe('This operator requires exactly 1 value(s)');
      expect(validateOperatorValues('contains', [])).toBe('This operator requires exactly 1 value(s)');

      // Test no value operators
      expect(validateOperatorValues('isEmpty', [])).toBe(true);
      expect(validateOperatorValues('isEmpty', ['hello'])).toBe('This operator requires no values');

      // Test variable value operators
      expect(validateOperatorValues('isAnyOf', ['option1', 'option2'])).toBe(true);
      expect(validateOperatorValues('isAnyOf', ['option1'])).toBe(true);
      expect(validateOperatorValues('isAnyOf', [])).toBe('This operator requires at least one value');

      // Test unknown operator
      expect(validateOperatorValues('unknownOperator' as FilterOperator, [])).toBe('Unknown operator');
    });

    it('should use custom validation when available', () => {
      // Test between operator with custom validation
      expect(validateOperatorValues('between', [10, 20])).toBe(true);
      expect(validateOperatorValues('between', [20, 10])).toBe('Invalid values for this operator');
      expect(validateOperatorValues('between', [10, 10])).toBe(true);
      expect(validateOperatorValues('between', ['10', '20'])).toBe('Invalid values for this operator');
    });
  });

  describe('createOperatorRegistry', () => {
    it('should create a registry from operator definitions', () => {
      const operators = [
        { key: 'equals' as FilterOperator, label: 'Equals', valueCount: 1 },
        { key: 'contains' as FilterOperator, label: 'Contains', valueCount: 1 }
      ];

      const registry = createOperatorRegistry(operators);
      
      expect(registry.size).toBe(2);
      expect(registry.get('equals')).toBeDefined();
      expect(registry.get('contains')).toBeDefined();
      expect(registry.get('equals')?.label).toBe('Equals');
    });

    it('should handle empty array', () => {
      const registry = createOperatorRegistry([]);
      expect(registry.size).toBe(0);
    });
  });

  describe('getAllOperators', () => {
    it('should return all operators as a flat array', () => {
      const allOperators = getAllOperators();
      
      expect(allOperators.length).toBeGreaterThan(0);
      expect(allOperators.some(op => op.key === 'contains')).toBe(true);
      expect(allOperators.some(op => op.key === 'equals')).toBe(true);
      expect(allOperators.some(op => op.key === 'isTrue')).toBe(true);
      expect(allOperators.some(op => op.key === 'includes')).toBe(true);
    });

    it('should not have duplicate operators', () => {
      const allOperators = getAllOperators();
      const keys = allOperators.map(op => op.key);
      const uniqueKeys = [...new Set(keys)];
      
      expect(keys.length).toBe(uniqueKeys.length);
    });
  });

  describe('Operator definition structure', () => {
    it('should have required properties for all operators', () => {
      const allOperators = getAllOperators();

      allOperators.forEach(op => {
        expect(op.key).toBeDefined();
        expect(op.label).toBeDefined();
        expect(op.valueCount).toBeDefined();
        expect(typeof op.supportsNull).toBe('boolean');
        
        if (op.validate) {
          expect(typeof op.validate).toBe('function');
        }
      });
    });

    it('should have consistent value counts', () => {
      const allOperators = getAllOperators();
      
      allOperators.forEach(op => {
        expect(
          op.valueCount === 0 || 
          op.valueCount === 1 || 
          op.valueCount === 2 || 
          op.valueCount === 'variable'
        ).toBe(true);
      });
    });
  });

  describe('Type Safety', () => {
    it('should ensure FilterOperator type matches AllOperatorKeys', () => {
      // This ensures the manual FilterOperator type in filter.ts 
      // stays in sync with the derived AllOperatorKeys type
      expectTypeOf<FilterOperator>().toEqualTypeOf<FilterOperatorKey>();
    });
  });
}); 