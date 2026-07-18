import { afterEach, describe, expect, it } from 'bun:test';
import { clearAllTableStores, defineTableRow } from '@better-tables/core';
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

/** Data rows only — excludes the two virtual spacer rows. */
function dataRowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr:not([data-virtual-spacer="true"])').length;
}

/**
 * Spacer heights, read off the spacer CELL. The height must live on the `<td>`:
 * an empty `<tr>` with only a `height` style collapses to zero in real layout
 * (happy-dom won't show that, so read the cell the browser actually sizes).
 */
function spacerHeights(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('tbody tr[data-virtual-spacer="true"] > td')).map(
    (td) => Number.parseFloat((td as HTMLElement).style.height || '0')
  );
}

describe('BetterTable `virtualized` prop (finding 6)', () => {
  afterEach(() => {
    clearAllTableStores();
    cleanup();
  });

  it('renders every row when virtualization is off', () => {
    const { container } = render(<BetterTable table={usersTable} data={makeRows(50)} />);

    expect(dataRowCount(container)).toBe(50);
    // No spacers at all in the non-virtualized path.
    expect(spacerHeights(container)).toEqual([]);
  });

  it('renders only a window of rows when virtualized', () => {
    const { container } = render(
      <BetterTable
        table={usersTable}
        data={makeRows(1000)}
        virtualized={{ height: 500, rowHeight: 50 }}
      />
    );

    const rendered = dataRowCount(container);

    // A 500px viewport over 50px rows is ~10 rows, plus overscan — far fewer
    // than 1000, which is the entire point.
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(50);
  });

  it('holds the off-screen space open with spacer rows totalling the full height', () => {
    const { container } = render(
      <BetterTable
        table={usersTable}
        data={makeRows(1000)}
        virtualized={{ height: 500, rowHeight: 50 }}
      />
    );

    const rendered = dataRowCount(container);
    const padding = spacerHeights(container).reduce((sum, h) => sum + h, 0);

    // Rendered rows + spacer padding must add up to the full scroll height
    // (1000 * 50), or the scrollbar would misrepresent the dataset.
    expect(padding + rendered * 50).toBe(1000 * 50);
  });

  it('makes the container scrollable at the configured height', () => {
    const { container } = render(
      <BetterTable table={usersTable} data={makeRows(1000)} virtualized={{ height: 640 }} />
    );

    const scroller = container.querySelector('div.border.rounded-md') as HTMLElement;
    expect(scroller.style.height).toBe('640px');
    expect(scroller.style.overflowY).toBe('auto');
  });

  it('leaves the container unstyled when virtualization is off', () => {
    const { container } = render(<BetterTable table={usersTable} data={makeRows(5)} />);

    const scroller = container.querySelector('div.border.rounded-md') as HTMLElement;
    expect(scroller.style.height).toBe('');
    expect(scroller.style.overflowY).toBe('');
  });

  it('accepts `virtualized` as a bare boolean', () => {
    const { container } = render(
      <BetterTable table={usersTable} data={makeRows(500)} virtualized />
    );

    expect(dataRowCount(container)).toBeLessThan(500);
    const scroller = container.querySelector('div.border.rounded-md') as HTMLElement;
    // Falls back to the default viewport height.
    expect(scroller.style.height).toBe('480px');
  });

  it('puts each spacer height on a cell spanning every column, not on the bare row', () => {
    // Regression guard: a `<tr style="height:...">` with no cells collapses to
    // zero height in a real browser, which silently shrinks the scroll height
    // to the rendered window. The height has to be on a spanning `<td>`.
    const { container } = render(
      <BetterTable table={usersTable} data={makeRows(1000)} virtualized={{ height: 500 }} />
    );

    const spacerRows = container.querySelectorAll('tbody tr[data-virtual-spacer="true"]');
    expect(spacerRows.length).toBeGreaterThan(0);

    for (const spacerRow of spacerRows) {
      const cell = spacerRow.querySelector('td');
      expect(cell).not.toBeNull();
      // One visible column + no selection column here.
      expect(cell?.getAttribute('colspan')).toBe('1');
      expect(Number.parseFloat((cell as HTMLElement).style.height)).toBeGreaterThan(0);
      // The row itself must NOT be the thing carrying the height.
      expect((spacerRow as HTMLElement).style.height).toBe('');
    }
  });

  it('still renders the filter bar and header (virtualization is rendering-only)', () => {
    const { container } = render(
      <BetterTable table={usersTable} data={makeRows(1000)} virtualized />
    );

    // The header is present and pinned so it survives scrolling.
    const header = container.querySelector('thead');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('sticky');
    expect(document.body.textContent).toContain('Name');
  });
});
