import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MultiOptionFilterInput } from '../../../src/components/filters/inputs/multi-option-filter-input';
import { baseFilter, makeMultiOptionColumn } from '../../helpers/filter-input-fixtures';

afterEach(() => {
  cleanup();
});

describe('MultiOptionFilterInput (plan 042 step 1)', () => {
  it('toggles selected values via the option list', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeMultiOptionColumn();

    const { rerender } = render(
      <MultiOptionFilterInput
        filter={baseFilter({ columnId: 'tags', type: 'multiOption', operator: 'includes' })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Alpha'));
    expect(onChange.mock.calls[0]?.[0]).toEqual(['alpha']);

    rerender(
      <MultiOptionFilterInput
        filter={baseFilter({
          columnId: 'tags',
          type: 'multiOption',
          operator: 'includes',
          values: ['alpha'],
        })}
        column={column}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText('Beta'));
    expect(onChange.mock.calls[1]?.[0]).toEqual(['alpha', 'beta']);
  });

  it('removes a selected badge when its clear control is clicked', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeMultiOptionColumn();

    render(
      <MultiOptionFilterInput
        filter={baseFilter({
          columnId: 'tags',
          type: 'multiOption',
          operator: 'includes',
          values: ['alpha', 'beta'],
        })}
        column={column}
        onChange={onChange}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: '' });
    fireEvent.click(removeButtons[0]!);

    expect(onChange.mock.calls[0]?.[0]).toEqual(['beta']);
  });

  it('isNull renders without option controls', () => {
    const onChange = mock(() => {});
    const column = makeMultiOptionColumn();

    render(
      <MultiOptionFilterInput
        filter={baseFilter({ columnId: 'tags', type: 'multiOption', operator: 'isNull' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require selecting options/i)).toBeDefined();
    expect(screen.queryByText('Add options...')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
