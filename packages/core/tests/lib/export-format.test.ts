import { describe, expect, it } from 'bun:test';
import { recordsToCsv, recordsToJson } from '../../src/lib/export-format';

/**
 * Plan 050: the shared CSV/JSON formatters. CSV encoding must be robust against
 * commas/quotes/newlines in BOTH headers and cells, serialize non-string
 * values, and neutralize formula-injection payloads.
 */

describe('recordsToCsv', () => {
  it('returns empty string for no rows', () => {
    expect(recordsToCsv([])).toBe('');
  });

  it('emits headers from the first record and does not quote plain values', () => {
    const csv = recordsToCsv([{ id: 1, name: 'Ada' }]);
    expect(csv).toBe('id,name\n1,Ada');
  });

  it('omits the header row when includeHeaders is false', () => {
    const csv = recordsToCsv([{ id: 1, name: 'Ada' }], { includeHeaders: false });
    expect(csv).toBe('1,Ada');
  });

  it('quotes and escapes headers containing commas or quotes', () => {
    const csv = recordsToCsv([{ 'last, first': 'Lovelace, Ada', 'a"b': 1 }]);
    expect(csv.split('\n')[0]).toBe('"last, first","a""b"');
  });

  it('quotes cells with commas, quotes, and newlines', () => {
    const csv = recordsToCsv([{ note: 'a,b "c"\nd' }]);
    expect(csv.split('\n').slice(1).join('\n')).toBe('"a,b ""c""\nd"');
  });

  it('serializes object/array cells as JSON', () => {
    const csv = recordsToCsv([{ tags: ['a', 'b'], meta: { x: 1 } }]);
    // Both are quoted because JSON contains commas/quotes.
    expect(csv.split('\n')[1]).toBe('"[""a"",""b""]","{""x"":1}"');
  });

  it('renders null/undefined cells as empty', () => {
    const csv = recordsToCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv.split('\n')[1]).toBe(',,0');
  });

  it('neutralizes formula-injection payloads', () => {
    for (const payload of ['=SUM(A1)', '+1', '-1', '@cmd']) {
      const csv = recordsToCsv([{ note: payload }]);
      expect(csv.split('\n')[1]).toBe(`"'${payload}"`);
    }
  });
});

describe('recordsToJson', () => {
  it('pretty-prints the records', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    expect(JSON.parse(recordsToJson(rows))).toEqual(rows);
    expect(recordsToJson(rows)).toContain('\n');
  });
});
