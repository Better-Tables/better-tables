import { describe, expect, it } from 'bun:test';
import type { AdapterRequestBody } from '@better-tables/core';
import { collectAdapterColumnIds, createAdapterGuard } from './adapter-guard';

const guard = createAdapterGuard('widgets', ['name', 'status', 'owner.email']);

describe('createAdapterGuard', () => {
  it('allowlists only the configured column ids', () => {
    expect(guard.columnIds.has('status')).toBe(true);
    expect(guard.columnIds.has('owner.email')).toBe(true);
    expect(guard.columnIds.has('company')).toBe(false);
  });

  it('collects facet columnId plus nested filter column ids', () => {
    const body: AdapterRequestBody = {
      method: 'getFacetedValues',
      columnId: 'status',
      params: {
        filters: {
          kind: 'group',
          logic: 'and',
          children: [
            {
              columnId: 'owner.email',
              type: 'text',
              operator: 'contains',
              values: ['@'],
            },
          ],
        },
      },
    };
    expect(collectAdapterColumnIds(body)).toEqual(['status', 'owner.email']);
    expect(guard.isAllowed(body)).toBe(true);
  });

  it('rejects requests that reference a column outside the allowlist', () => {
    expect(
      guard.isAllowed({
        method: 'getFacetedValues',
        columnId: 'company',
      })
    ).toBe(false);
  });

  it('pins fetchData / describeColumns / resolveCellWriteTarget to the table', () => {
    const fetchConstrained = guard.constrain({
      method: 'fetchData',
      params: { primaryTable: 'other', pagination: { page: 1, limit: 10 } },
    });
    expect(fetchConstrained.method).toBe('fetchData');
    if (fetchConstrained.method === 'fetchData') {
      expect(fetchConstrained.params.primaryTable).toBe('widgets');
    }

    const describeConstrained = guard.constrain({
      method: 'describeColumns',
      table: 'other',
    });
    expect(describeConstrained).toMatchObject({ method: 'describeColumns', table: 'widgets' });

    const writeConstrained = guard.constrain({
      method: 'resolveCellWriteTarget',
      table: 'other',
      columnId: 'name',
    });
    expect(writeConstrained).toMatchObject({
      method: 'resolveCellWriteTarget',
      table: 'widgets',
      columnId: 'name',
    });
  });
});
