import { describe, expect, it } from 'bun:test';
import { defaultGetRowId } from '../../src/lib/utils';

describe('defaultGetRowId (shared by <BetterTable> and <VirtualizedTable>)', () => {
  it('prefers "id" when present', () => {
    expect(defaultGetRowId({ id: 'a1', uuid: 'u1', _id: 'm1' }, 0)).toBe('a1');
  });

  it('falls back to "_id" when "id" is absent', () => {
    expect(defaultGetRowId({ _id: 'm1', uuid: 'u1' }, 0)).toBe('m1');
  });

  it('falls back to "uuid" when neither "id" nor "_id" is present (bug fix)', () => {
    // `<VirtualizedTable>`'s own default previously lacked this fallback,
    // diverging from `<BetterTable>`'s (table.tsx ~918) and silently
    // falling through to positional `row-${index}` ids for UUID-keyed rows.
    expect(defaultGetRowId({ uuid: 'u1', name: 'Alice' }, 3)).toBe('u1');
  });

  it('falls back to a positional id when no id field is found', () => {
    expect(defaultGetRowId({ name: 'Alice' }, 2)).toBe('row-2');
  });

  it('falls back to a positional id for non-object rows', () => {
    expect(defaultGetRowId('Alice', 5)).toBe('row-5');
    expect(defaultGetRowId(null, 1)).toBe('row-1');
  });

  it('ignores null/undefined id fields and tries the next fallback', () => {
    expect(defaultGetRowId({ id: null, _id: 'm1' }, 0)).toBe('m1');
    expect(defaultGetRowId({ id: undefined, uuid: 'u1' }, 0)).toBe('u1');
  });
});
