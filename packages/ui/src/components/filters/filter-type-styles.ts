import type { ColumnType } from '@better-tables/core';

export type FilterTypeFamily = 'text' | 'number' | 'date' | 'boolean' | 'option' | 'multiOption';

export function getFilterTypeFamily(type: ColumnType): FilterTypeFamily {
  switch (type) {
    case 'number':
    case 'currency':
    case 'percentage':
      return 'number';
    case 'date':
      return 'date';
    case 'boolean':
      return 'boolean';
    case 'option':
      return 'option';
    case 'multiOption':
      return 'multiOption';
    default:
      return 'text';
  }
}

export const filterTypeAccent: Record<FilterTypeFamily, string> = {
  text: 'border-l-primary/50 bg-muted/30',
  number: 'border-l-chart-2 bg-chart-2/5',
  date: 'border-l-chart-4 bg-chart-4/5',
  boolean: 'border-l-chart-3 bg-chart-3/5',
  option: 'border-l-chart-1 bg-chart-1/5',
  multiOption: 'border-l-chart-5 bg-chart-5/5',
};

export const filterTypeIconTone: Record<FilterTypeFamily, string> = {
  text: 'text-foreground',
  number: 'text-chart-2',
  date: 'text-chart-4',
  boolean: 'text-chart-3',
  option: 'text-chart-1',
  multiOption: 'text-chart-5',
};
