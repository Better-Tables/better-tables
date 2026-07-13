import { describe, expect, it } from 'bun:test';
import { assertDefined } from '../../src/utils/assert-defined';

describe('assertDefined', () => {
  it('returns the value unchanged when defined', () => {
    expect(assertDefined(42, 'should not throw')).toBe(42);
    expect(assertDefined('hello', 'should not throw')).toBe('hello');
    expect(assertDefined(0, 'should not throw')).toBe(0);
    expect(assertDefined('', 'should not throw')).toBe('');
    expect(assertDefined(false, 'should not throw')).toBe(false);
  });

  it('throws with the provided message when value is undefined', () => {
    expect(() => assertDefined(undefined, 'value was undefined')).toThrow('value was undefined');
  });

  it('throws with the provided message when value is null', () => {
    expect(() => assertDefined(null, 'value was null')).toThrow('value was null');
  });
});
