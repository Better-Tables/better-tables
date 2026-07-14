import { afterEach, describe, expect, it } from 'bun:test';
import { type ColumnDefinition, formatDateWithConfig } from '@better-tables/core';
import { cleanup, render } from '@testing-library/react';
import { VirtualizedTable } from '../../src/components/table/virtualized-table';

interface Row {
  id: string;
  createdAt: Date;
}

describe('VirtualizedTable default cell formatting (plan 032 finding 6)', () => {
  afterEach(() => {
    cleanup();
  });

  it('runs a .dateTime({ timeZone }) column through getFormatterForType instead of the raw Date', () => {
    const createdAt = new Date('2024-03-15T18:30:00Z');
    const rows: Row[] = [{ id: 'r1', createdAt }];

    const dateFormat = {
      format: 'yyyy-MM-dd HH:mm:ss',
      locale: 'en-US',
      timeZone: 'America/New_York',
      showTime: true,
    };

    const columns: ColumnDefinition<Row>[] = [
      {
        id: 'createdAt',
        displayName: 'Created',
        type: 'date',
        accessor: (row) => row.createdAt,
        meta: { dateFormat },
      },
    ];

    const { container } = render(<VirtualizedTable data={rows} columns={columns} />);

    const cellText = container.querySelector('tbody tr td')?.textContent ?? '';

    // The formatted, timezone-converted string -- the SAME formatter
    // BetterTable's default cell path uses (table.tsx).
    const expected = formatDateWithConfig(createdAt, dateFormat);
    expect(expected).not.toBe('');
    expect(cellText).toBe(expected);

    // Must NOT be the raw `Date.toString()`/`String(value)` output the old
    // `item[column.id]` + `String(value || '')` path produced.
    expect(cellText).not.toBe(String(createdAt));
    expect(cellText).not.toBe(createdAt.toString());
  });

  it('still lets an explicit renderCell override the default formatter', () => {
    const createdAt = new Date('2024-03-15T18:30:00Z');
    const rows: Row[] = [{ id: 'r1', createdAt }];

    const columns: ColumnDefinition<Row>[] = [
      {
        id: 'createdAt',
        displayName: 'Created',
        type: 'date',
        accessor: (row) => row.createdAt,
        meta: { dateFormat: { timeZone: 'America/New_York', showTime: true } },
      },
    ];

    const { container } = render(
      <VirtualizedTable data={rows} columns={columns} renderCell={() => 'CUSTOM CELL'} />
    );

    const cellText = container.querySelector('tbody tr td')?.textContent ?? '';
    expect(cellText).toBe('CUSTOM CELL');
  });
});
