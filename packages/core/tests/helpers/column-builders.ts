import { BooleanColumnBuilder } from '../../src/builders/boolean-column-builder';
import { ColumnBuilder } from '../../src/builders/column-builder';
import { DateColumnBuilder } from '../../src/builders/date-column-builder';
import { MultiOptionColumnBuilder } from '../../src/builders/multi-option-column-builder';
import { NumberColumnBuilder } from '../../src/builders/number-column-builder';
import { OptionColumnBuilder } from '../../src/builders/option-column-builder';
import { TextColumnBuilder } from '../../src/builders/text-column-builder';

/**
 * Test-local convenience over the public builder classes: a per-row-type
 * factory object so specs can write `cb.text()` instead of repeating
 * `new TextColumnBuilder<Row>()` at every site.
 */
export function createColumnBuilder<TData = unknown>() {
  return {
    text: () => new TextColumnBuilder<TData>(),
    number: () => new NumberColumnBuilder<TData>(),
    date: () => new DateColumnBuilder<TData>(),
    boolean: () => new BooleanColumnBuilder<TData>(),
    option: () => new OptionColumnBuilder<TData>(),
    multiOption: () => new MultiOptionColumnBuilder<TData>(),
    custom: <TValue = unknown>(type: 'json' | 'custom') => new ColumnBuilder<TData, TValue>(type),
  };
}
