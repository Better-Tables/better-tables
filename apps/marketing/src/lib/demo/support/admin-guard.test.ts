import { describe, expect, it } from 'bun:test';
import type { AdapterRequestBody } from '@better-tables/core';
import { isAllowedAdminAdapterRequest } from './admin-guard';

describe('isAllowedAdminAdapterRequest', () => {
  it('allows fetchData for every table on the allowlist', () => {
    for (const table of ['tickets', 'customers', 'assignees', 'bulkTickets']) {
      const body: AdapterRequestBody = {
        method: 'fetchData',
        params: { primaryTable: table, pagination: { page: 1, limit: 10 } },
      };
      expect(isAllowedAdminAdapterRequest(body)).toBe(true);
    }
  });

  it('rejects fetchData for a table outside the allowlist', () => {
    const body: AdapterRequestBody = {
      method: 'fetchData',
      params: { primaryTable: 'other', pagination: { page: 1, limit: 10 } },
    };
    expect(isAllowedAdminAdapterRequest(body)).toBe(false);
  });

  it('allows describeColumns for an allowlisted table and rejects others', () => {
    expect(isAllowedAdminAdapterRequest({ method: 'describeColumns', table: 'tickets' })).toBe(
      true
    );
    expect(isAllowedAdminAdapterRequest({ method: 'describeColumns', table: 'other' })).toBe(false);
  });

  it('allows resolveCellWriteTarget for an allowlisted table and rejects others', () => {
    expect(
      isAllowedAdminAdapterRequest({
        method: 'resolveCellWriteTarget',
        table: 'customers',
        columnId: 'name',
      })
    ).toBe(true);
    expect(
      isAllowedAdminAdapterRequest({
        method: 'resolveCellWriteTarget',
        table: 'other',
        columnId: 'name',
      })
    ).toBe(false);
  });

  it('allows listTables unconditionally — it carries no table name', () => {
    expect(isAllowedAdminAdapterRequest({ method: 'listTables' })).toBe(true);
  });

  it('allows facet/filter-option reads unconditionally — they carry no table name', () => {
    expect(isAllowedAdminAdapterRequest({ method: 'getFilterOptions', columnId: 'status' })).toBe(
      true
    );
    expect(isAllowedAdminAdapterRequest({ method: 'getFacetedValues', columnId: 'status' })).toBe(
      true
    );
    expect(
      isAllowedAdminAdapterRequest({ method: 'getMinMaxValues', columnId: 'reopenCount' })
    ).toBe(true);
    expect(
      isAllowedAdminAdapterRequest({
        method: 'getFacets',
        requests: [{ columnId: 'status', kind: 'values' }],
      })
    ).toBe(true);
  });

  it('rejects (rather than throws on) a fetchData body missing params', () => {
    const malformed = { method: 'fetchData' } as unknown as AdapterRequestBody;
    expect(() => isAllowedAdminAdapterRequest(malformed)).not.toThrow();
    expect(isAllowedAdminAdapterRequest(malformed)).toBe(false);
  });
});
