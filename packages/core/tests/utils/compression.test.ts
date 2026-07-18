import { describe, expect, it } from 'bun:test';
import LZString from 'lz-string';
import type { FilterGroupNode, FilterState } from '../../src/types';
import {
  MAX_COMPRESSED_ENCODED_LENGTH,
  MAX_RENAME_KEYS_DEPTH,
  compressAndEncode,
  decompressAndDecode,
} from '../../src/utils/compression';

function buildDeepCompressedTree(depth: number): string {
  let node: unknown = { c: 'status', t: 'option', o: 'is', v: ['active'] };
  for (let i = 0; i < depth; i++) {
    node = { k: 'group', l: 'and', h: [node] };
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(node));
  return `c:${compressed ?? ''}`;
}

describe('decompressAndDecode bounds (plan 051)', () => {
  it('returns null when encoded input exceeds the length cap', () => {
    const overLong = `c:${'A'.repeat(MAX_COMPRESSED_ENCODED_LENGTH + 1)}`;
    expect(decompressAndDecode(overLong)).toBeNull();
  });

  it('returns null when renameKeys depth exceeds the cap', () => {
    const encoded = buildDeepCompressedTree(MAX_RENAME_KEYS_DEPTH + 1);
    expect(encoded.length).toBeGreaterThan(2);
    expect(decompressAndDecode(encoded)).toBeNull();
  });

  it('round-trips a normal flat filter state', () => {
    const filters: FilterState[] = [
      {
        columnId: 'name',
        type: 'text',
        operator: 'contains',
        values: ['alice'],
      },
      {
        columnId: 'status',
        type: 'option',
        operator: 'is',
        values: ['active'],
      },
    ];

    const encoded = compressAndEncode(filters);
    expect(encoded.startsWith('c:')).toBe(true);

    const decoded = decompressAndDecode<FilterState[]>(encoded);
    expect(decoded).toEqual(filters);
  });

  it('round-trips a moderately nested filter group tree', () => {
    const tree: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          columnId: 'status',
          type: 'option',
          operator: 'is',
          values: ['active'],
        },
        {
          kind: 'group',
          logic: 'or',
          children: [
            {
              columnId: 'role',
              type: 'option',
              operator: 'is',
              values: ['admin'],
            },
            {
              columnId: 'role',
              type: 'option',
              operator: 'is',
              values: ['editor'],
            },
          ],
        },
      ],
    };

    const encoded = compressAndEncode(tree);
    expect(decompressAndDecode<FilterGroupNode>(encoded)).toEqual(tree);
  });
});
