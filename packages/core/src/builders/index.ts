/**
 * @fileoverview Barrel export for column builders, action builders and factory utilities.
 *
 * This module provides a centralized export point for all builder classes
 * and factory utilities, enabling convenient imports and maintaining a clean API.
 *
 * @module builders
 */

// Action builders and factories
export { ActionBuilder } from './action-builder';
export {
  createActionBuilder,
  createActionBuilders,
  deleteAction,
} from './action-factory';
// Column builders
export { BooleanColumnBuilder } from './boolean-column-builder';
// Typed filter builder (plan 031 Step 4)
export {
  type BuildFilterOptions,
  buildFilter,
  type DefaultColumnTypeForValue,
  type FilterStateForType,
} from './build-filter';
export { ColumnBuilder } from './column-builder';
// Standalone-column utilities
export { defineColumns, validateColumns } from './column-factory';
export { DateColumnBuilder } from './date-column-builder';
export { MultiOptionColumnBuilder } from './multi-option-column-builder';
export { NumberColumnBuilder } from './number-column-builder';
export { OptionColumnBuilder } from './option-column-builder';
// Path-derived accessor walker (dot-notation, array-hop semantics) — shared
// with the UI's relationship-path cell editing (plan 055).
export { buildPathAccessor, type PathColumnFactory } from './path-builders';
export { TextColumnBuilder } from './text-column-builder';
