import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';
import type {
  ColumnDefinition,
  ExportParams,
  ExportResult,
  FilterState,
  SortingState,
} from '@better-tables/core';
import { act, renderHook } from '@testing-library/react';
import { useTableExport } from '../../src/hooks/use-table-export';

/**
 * Plan 050: `useTableExport` wraps `adapter.exportData` + the browser download,
 * gated on the adapter advertising export. These tests pin the capability gate,
 * that the current columns/filters/sorting reach `exportData`, the download
 * trigger, and error surfacing — with the DOM download primitives stubbed.
 */

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDefinition<Row, unknown>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: (r) => r.name },
];

function exportingAdapter(
  overrides: { exportData?: (p: ExportParams) => Promise<ExportResult>; canExport?: boolean } = {}
) {
  const calls: ExportParams[] = [];
  const adapter = {
    fetchData: async () => ({
      data: [],
      total: 0,
      pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    exportData:
      overrides.exportData ??
      (async (p: ExportParams) => {
        calls.push(p);
        return {
          data: 'name\nAda',
          filename: `export.${p.format}`,
          mimeType: 'text/csv',
        } satisfies ExportResult;
      }),
    meta: { features: { export: overrides.canExport ?? true } },
  };
  return { adapter, calls };
}

describe('useTableExport', () => {
  let clickSpy: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    // happy-dom has no object-URL API; stub it, and capture the anchor click.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    clickSpy = jest.fn();
    // biome-ignore lint/suspicious/noExplicitAny: test stub of the anchor click
    (HTMLAnchorElement.prototype as any).click = clickSpy;
  });

  afterEach(() => {
    clickSpy.mockRestore?.();
  });

  it('reports canExport=false and errors when the adapter cannot export', async () => {
    const { adapter } = exportingAdapter({ canExport: false });
    const { result } = renderHook(() =>
      useTableExport({ adapter, columns, filters: [], sorting: [] })
    );

    expect(result.current.canExport).toBe(false);

    await act(async () => {
      await result.current.exportData('csv');
    });

    expect(result.current.error?.message).toContain('cannot be exported');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('passes the current columns/filters/sorting to exportData and downloads', async () => {
    const { adapter, calls } = exportingAdapter();
    const filters: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['a'] },
    ];
    const sorting: SortingState = [{ columnId: 'name', direction: 'asc' }];

    const { result } = renderHook(() => useTableExport({ adapter, columns, filters, sorting }));

    expect(result.current.canExport).toBe(true);

    await act(async () => {
      await result.current.exportData('csv');
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      format: 'csv',
      columns: ['name'],
      filters: [...filters],
      sorting: [...sorting],
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an exportData rejection as error without downloading', async () => {
    const { adapter } = exportingAdapter({
      exportData: async () => {
        throw new Error('export blew up');
      },
    });
    const { result } = renderHook(() =>
      useTableExport({ adapter, columns, filters: [], sorting: [] })
    );

    await act(async () => {
      await result.current.exportData('json');
    });

    expect(result.current.error?.message).toBe('export blew up');
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
