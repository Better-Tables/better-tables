import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';
import type { ColumnDefinition, ExportParams, ExportResult } from '@better-tables/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExportButton } from '../../src/components/table/export-button';

/**
 * Plan 050: the `export` module's `ExportButton` — occupies the `toolbarExtra`
 * slot. Renders only when the adapter can export; offers CSV/JSON; triggers the
 * export on click.
 */

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDefinition<Row, unknown>[] = [
  { id: 'name', displayName: 'Name', type: 'text', accessor: (r) => r.name },
];

function makeAdapter(canExport: boolean) {
  const calls: ExportParams[] = [];
  const adapter = {
    fetchData: async () => ({
      data: [],
      total: 0,
      pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    exportData: async (p: ExportParams) => {
      calls.push(p);
      return { data: 'name\nAda', filename: 'export.csv', mimeType: 'text/csv' } satisfies ExportResult;
    },
    meta: { features: { export: canExport } },
  };
  return { adapter, calls };
}

describe('ExportButton', () => {
  beforeEach(() => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    // biome-ignore lint/suspicious/noExplicitAny: test stub of the anchor click
    (HTMLAnchorElement.prototype as any).click = jest.fn();
  });

  afterEach(() => cleanup());

  it('renders nothing when the adapter cannot export', () => {
    const { adapter } = makeAdapter(false);
    render(<ExportButton adapter={adapter} columns={columns} filters={[]} sorting={[]} />);
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
  });

  it('renders an Export control when the adapter can export', () => {
    const { adapter } = makeAdapter(true);
    render(<ExportButton adapter={adapter} columns={columns} filters={[]} sorting={[]} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy();
  });

  it('offers CSV and JSON (and not the unimplemented Excel) when opened', async () => {
    const { adapter } = makeAdapter(true);
    render(<ExportButton adapter={adapter} columns={columns} filters={[]} sorting={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    expect(await screen.findByText('Export CSV')).toBeTruthy();
    expect(screen.getByText('Export JSON')).toBeTruthy();
    expect(screen.queryByText(/excel/i)).toBeNull();
  });
});
