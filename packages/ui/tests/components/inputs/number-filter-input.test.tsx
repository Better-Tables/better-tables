import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NumberFilterInput } from '../../../src/components/filters/inputs/number-filter-input';
import { baseFilter, makeNumberColumn } from '../../helpers/filter-input-fixtures';

afterEach(() => {
  cleanup();
});

describe('NumberFilterInput (plan 042 step 1)', () => {
  it('commits a single numeric value for operator "equals"', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeNumberColumn();

    render(
      <NumberFilterInput
        filter={baseFilter({ columnId: 'amount', type: 'number', operator: 'equals' })}
        column={column}
        onChange={onChange}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange.mock.calls[0]?.[0]).toEqual([42]);
  });

  it('commits min/max pair for operator "between"', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeNumberColumn();

    render(
      <NumberFilterInput
        filter={baseFilter({ columnId: 'amount', type: 'number', operator: 'between' })}
        column={column}
        onChange={onChange}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    const minInput = inputs[0];
    const maxInput = inputs[1];
    expect(minInput).toBeDefined();
    expect(maxInput).toBeDefined();
    fireEvent.change(minInput!, { target: { value: '10' } });
    fireEvent.change(maxInput!, { target: { value: '20' } });
    fireEvent.blur(maxInput!);

    expect(onChange.mock.calls[0]?.[0]).toEqual([10, 20]);
  });

  it('isNull renders without inputs and does not call onChange', () => {
    const onChange = mock(() => {});
    const column = makeNumberColumn();

    render(
      <NumberFilterInput
        filter={baseFilter({ columnId: 'amount', type: 'number', operator: 'isNull' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require a value/i)).toBeDefined();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
