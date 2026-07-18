import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DateFilterInput } from '../../../src/components/filters/inputs/date-filter-input';
import { baseFilter, makeDateColumn } from '../../helpers/filter-input-fixtures';

afterEach(() => {
  cleanup();
});

describe('DateFilterInput (plan 042 step 1)', () => {
  it('emits a single Date value when a quick-select preset is chosen', async () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeDateColumn();

    render(
      <DateFilterInput
        filter={baseFilter({ columnId: 'createdAt', type: 'date', operator: 'is' })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.calls.at(-1)?.[0] as unknown[];
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toBeInstanceOf(Date);
  });

  it('emits a from/to Date pair for operator "between"', async () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeDateColumn();

    render(
      <DateFilterInput
        filter={baseFilter({ columnId: 'createdAt', type: 'date', operator: 'between' })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0] as unknown[] | undefined;
      expect(lastCall?.length).toBe(2);
    });

    const emitted = onChange.mock.calls.at(-1)?.[0] as Date[];
    expect(emitted[0]).toBeInstanceOf(Date);
    expect(emitted[1]).toBeInstanceOf(Date);
    expect(emitted[0]!.getTime()).toBeLessThanOrEqual(emitted[1]!.getTime());
  });

  it('isToday renders without date controls and emits no values', () => {
    const onChange = mock(() => {});
    const column = makeDateColumn();

    render(
      <DateFilterInput
        filter={baseFilter({ columnId: 'createdAt', type: 'date', operator: 'isToday' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require a date selection/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /pick a date/i })).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0] as unknown[] | undefined)?.[0]).toEqual([]);
  });
});
