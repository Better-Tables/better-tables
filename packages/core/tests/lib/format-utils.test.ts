import { describe, expect, it } from 'bun:test';
import { formatPercentage, getFormatterForType } from '../../src/lib/format-utils';

describe('getFormatterForType date coercion', () => {
  const iso = '2026-03-10T09:00:00.000Z';
  const asDate = new Date(iso);

  it('formats ISO strings like Date instances', () => {
    expect(getFormatterForType('date', iso)).toBe(getFormatterForType('date', asDate));
  });

  it('formats epoch-millisecond numbers like Date instances', () => {
    expect(getFormatterForType('date', asDate.getTime())).toBe(
      getFormatterForType('date', asDate)
    );
  });

  it('returns unparseable strings as-is', () => {
    expect(getFormatterForType('date', 'not-a-date')).toBe('not-a-date');
  });

  it('returns empty string for null', () => {
    expect(getFormatterForType('date', null)).toBe('');
  });
});

describe('formatPercentage', () => {
  it('treats decimal storage as 0–1 fractions by default', () => {
    expect(formatPercentage(0.85)).toBe('85%');
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(1)).toBe('100%');
  });

  it('formats percentage storage without scaling', () => {
    expect(formatPercentage(85, { format: 'percentage' })).toBe('85%');
    expect(formatPercentage(1, { format: 'percentage' })).toBe('1%');
    expect(formatPercentage(1.5, { format: 'percentage' })).toBe('1.5%');
  });

  it('does not use the old value > 1 heuristic', () => {
    expect(formatPercentage(1.5)).toBe('150%');
    expect(formatPercentage(1.5, { format: 'percentage' })).toBe('1.5%');
  });
});
