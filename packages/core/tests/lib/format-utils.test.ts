import { describe, expect, it } from 'bun:test';
import { formatPercentage } from '../../src/lib/format-utils';

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
