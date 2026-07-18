import { describe, expect, it } from 'bun:test';
import { OptionColumnBuilder } from '../../src/builders/option-column-builder';

describe('option auto-labels via humanize', () => {
  it('humanizes bare option values as default labels', () => {
    const col = new OptionColumnBuilder<{ status: string }>()
      .id('status')
      .displayName('Status')
      .accessor((row) => row.status)
      .options(['multi_word_value', 'active'] as const)
      .build();
    expect(col.filter?.options).toEqual([
      { value: 'multi_word_value', label: 'Multi Word Value' },
      { value: 'active', label: 'Active' },
    ]);
  });

  it('keeps explicit labels when provided', () => {
    const col = new OptionColumnBuilder<{ status: string }>()
      .id('status')
      .displayName('Status')
      .accessor((row) => row.status)
      .options([{ value: 'multi_word_value', label: 'Custom Label' }])
      .build();
    expect(col.filter?.options).toEqual([{ value: 'multi_word_value', label: 'Custom Label' }]);
  });
});
