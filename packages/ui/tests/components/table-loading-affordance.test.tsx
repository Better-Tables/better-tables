import { afterEach, describe, expect, it } from 'bun:test';
import type { ColumnDefinition } from '@better-tables/core';
import { cleanup, render, screen } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDefinition<Row>[] = [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (row) => row.name,
  },
];

const rows: Row[] = [
  { id: 'r1', name: 'Alpha' },
  { id: 'r2', name: 'Beta' },
];

/**
 * Lag-fix contract: `loading` must NOT unmount rows that are already on
 * screen (the pre-fix behavior replaced the whole table with a skeleton on
 * every refetch — pagination/filter changes flashed a spinner instead of
 * feeling instant). The skeleton is reserved for the initial load, when
 * there is nothing better to show.
 */
describe('BetterTable loading affordance (stale rows during refetch)', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps current rows mounted and marks the table busy during a refetch', () => {
    const { rerender, container } = render(
      <BetterTable id="loading-refetch" name="Loading" columns={columns} data={rows} />
    );
    expect(screen.getByText('Alpha')).toBeTruthy();

    rerender(
      <BetterTable id="loading-refetch" name="Loading" columns={columns} data={rows} loading />
    );

    // Rows are still there — no skeleton took their place...
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(container.querySelector('[aria-label="Loading table data"]')).toBeNull();
    // ...and assistive tech + styling know a refresh is in flight.
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();

    // Loading clears → busy marker clears, rows unchanged.
    rerender(<BetterTable id="loading-refetch" name="Loading" columns={columns} data={rows} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText('Alpha')).toBeTruthy();
  });

  it('still renders the skeleton for an initial load (loading with no rows)', () => {
    const { container } = render(
      <BetterTable id="loading-initial" name="Loading" columns={columns} data={[]} loading />
    );
    expect(container.querySelector('[aria-label="Loading table data"]')).toBeTruthy();
  });
});
