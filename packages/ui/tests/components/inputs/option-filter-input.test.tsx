import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OptionFilterInput } from '../../../src/components/filters/inputs/option-filter-input';
import { baseFilter, makeOptionColumn } from '../../helpers/filter-input-fixtures';

afterEach(() => {
  cleanup();
});

describe('OptionFilterInput (plan 042 step 1)', () => {
  it('single-select (operator "is") replaces the previous value on a new selection', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeOptionColumn(3);

    render(
      <OptionFilterInput
        filter={baseFilter({
          columnId: 'status',
          type: 'option',
          operator: 'is',
          values: ['opt-0'],
        })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Option 1'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(['opt-1']);
  });

  it('multi-select (operator "isAnyOf") toggles values on and off', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeOptionColumn(3);

    const { rerender } = render(
      <OptionFilterInput
        filter={baseFilter({
          columnId: 'status',
          type: 'option',
          operator: 'isAnyOf',
          values: ['opt-0'],
        })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Option 1'));
    expect(onChange.mock.calls[0]?.[0]).toEqual(['opt-0', 'opt-1']);

    rerender(
      <OptionFilterInput
        filter={baseFilter({
          columnId: 'status',
          type: 'option',
          operator: 'isAnyOf',
          values: ['opt-0', 'opt-1'],
        })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Option 0'));
    expect(onChange.mock.calls[1]?.[0]).toEqual(['opt-1']);
  });

  it('isNull/isNotNull render without option controls and never call onChange', () => {
    const onChange = mock(() => {});
    const column = makeOptionColumn(3);

    const { rerender } = render(
      <OptionFilterInput
        filter={baseFilter({ columnId: 'status', type: 'option', operator: 'isNull' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require selecting options/i)).toBeDefined();
    expect(screen.queryByText('Option 0')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <OptionFilterInput
        filter={baseFilter({ columnId: 'status', type: 'option', operator: 'isNotNull' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require selecting options/i)).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows search only when the option list exceeds the search threshold', () => {
    const onChange = mock(() => {});
    const shortColumn = makeOptionColumn(8);
    const longColumn = makeOptionColumn(9);

    const { rerender } = render(
      <OptionFilterInput
        filter={baseFilter({ columnId: 'status', type: 'option', operator: 'is' })}
        column={shortColumn}
        onChange={onChange}
      />
    );

    expect(screen.queryByPlaceholderText('Search options...')).toBeNull();

    rerender(
      <OptionFilterInput
        filter={baseFilter({ columnId: 'status', type: 'option', operator: 'is' })}
        column={longColumn}
        onChange={onChange}
      />
    );

    const search = screen.getByPlaceholderText('Search options...');
    expect(search).toBeDefined();

    fireEvent.change(search, { target: { value: 'option 8' } });
    expect(screen.getByText('Option 8')).toBeDefined();
    expect(screen.queryByText('Option 0')).toBeNull();
  });
});
