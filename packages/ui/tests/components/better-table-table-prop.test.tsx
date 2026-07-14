import { afterEach, describe, expect, it } from 'bun:test';
import { clearAllTableStores, defineTableRow, getTableStore } from '@better-tables/core';
import { cleanup, render } from '@testing-library/react';
import { BetterTable } from '../../src/components/table/table';

interface Row {
  id: string;
  name: string;
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));
}

const usersTable = defineTableRow<Row>()('users', (t) => ({
  columns: [t.text('name')],
}));

describe('BetterTable `table` prop (plan 032 step 5, finding 5)', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('renders identically to passing table.columns directly', () => {
    const rows = makeRows(3);

    const viaTable = render(<BetterTable table={usersTable} data={rows} />);
    const viaTableHtml = normalizeGeneratedIds(viaTable.container.innerHTML);
    viaTable.unmount();
    clearAllTableStores();

    // `name` is passed explicitly here to match what `table` derives it to
    // (table.tableName) -- everything else is the `table` prop's sugar
    // (columns={table.columns}, id defaulted to table.tableName).
    const viaColumns = render(
      <BetterTable id="users" name="users" columns={usersTable.columns} data={rows} />
    );
    const viaColumnsHtml = normalizeGeneratedIds(viaColumns.container.innerHTML);
    viaColumns.unmount();
    clearAllTableStores();

    expect(viaTableHtml).toBe(viaColumnsHtml);
  });

  it('defaults id to table.tableName when id is not provided', () => {
    render(<BetterTable table={usersTable} data={makeRows(2)} />);

    expect(getTableStore('users')).toBeDefined();
  });

  it('lets an explicit id override table.tableName', () => {
    render(<BetterTable table={usersTable} id="custom-id" data={makeRows(2)} />);

    expect(getTableStore('custom-id')).toBeDefined();
    expect(getTableStore('users')).toBeUndefined();
  });

  it('lets an explicit columns prop override table.columns', () => {
    const overrideColumns = [
      {
        id: 'name',
        displayName: 'Overridden Name',
        type: 'text' as const,
        accessor: (row: Row) => row.name,
      },
    ];

    render(<BetterTable table={usersTable} columns={overrideColumns} data={makeRows(1)} />);

    expect(screenHasText('Overridden Name')).toBe(true);
  });

  it('throws a clear error when neither columns nor table is provided', () => {
    expect(() => {
      // `columns` and `table` are BOTH optional (either can supply the
      // other's job), so this compiles -- the runtime guard is what
      // catches the "neither was given" misuse.
      render(<BetterTable id="broken" data={[]} />);
    }).toThrow(/requires either a "columns" prop or a "table" prop/);
  });
});

function screenHasText(text: string): boolean {
  return document.body.textContent?.includes(text) ?? false;
}

/**
 * Base UI's internal `useId()` counter keeps incrementing across separate
 * `render()` calls within the same test process, so two structurally
 * identical renders get different `id="base-ui-_r_N_"` values (and
 * matching `aria-describedby`/hidden-input id references). Normalize them
 * out so an equality check compares STRUCTURE, not incidental id noise.
 */
function normalizeGeneratedIds(html: string): string {
  return html.replace(/base-ui-_r_[a-z0-9]+_/g, 'base-ui-_r_N_');
}
