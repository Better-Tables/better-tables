import { describe, expect, it } from 'bun:test';
import { isUuid, parseUserIds, userIdsErrorMessage } from './ids';

describe('parseUserIds', () => {
  it('accepts positive integers for sqlite', () => {
    expect(parseUserIds([1, '2', 3], 'sqlite')).toEqual([1, 2, 3]);
  });

  it('rejects non-integers and empty arrays for sqlite', () => {
    expect(parseUserIds([], 'sqlite')).toBeNull();
    expect(parseUserIds([0], 'sqlite')).toBeNull();
    expect(parseUserIds([1.5], 'sqlite')).toBeNull();
    expect(parseUserIds(['abc'], 'sqlite')).toBeNull();
  });

  it('rejects Number()-coercible non-ids for sqlite (true, arrays)', () => {
    expect(parseUserIds([true], 'sqlite')).toBeNull();
    expect(parseUserIds([[5]], 'sqlite')).toBeNull();
    expect(parseUserIds([null], 'sqlite')).toBeNull();
    expect(parseUserIds([undefined], 'sqlite')).toBeNull();
    expect(parseUserIds([''], 'sqlite')).toBeNull();
  });

  it('accepts UUIDs for postgres', () => {
    const id = '02ca4de4-fd66-43f8-4a4d-e598711078e1';
    expect(parseUserIds([id], 'postgres')).toEqual([id]);
    expect(isUuid(id)).toBe(true);
  });

  it('rejects numeric ids and non-strings on the postgres path', () => {
    expect(parseUserIds([1, 2], 'postgres')).toBeNull();
    expect(
      parseUserIds(['02ca4de4-fd66-43f8-4a4d-e598711078e1', true as unknown as string], 'postgres')
    ).toBeNull();
  });

  it('rejects more than 100 ids', () => {
    expect(
      parseUserIds(
        Array.from({ length: 101 }, (_, i) => i + 1),
        'sqlite'
      )
    ).toBeNull();
  });

  it('returns dialect-specific error copy', () => {
    expect(userIdsErrorMessage('postgres')).toContain('UUID');
    expect(userIdsErrorMessage('sqlite')).toContain('numeric');
  });
});
