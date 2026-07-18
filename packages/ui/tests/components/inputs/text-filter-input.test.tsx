import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TextFilterInput } from '../../../src/components/filters/inputs/text-filter-input';
import { baseFilter, makeTextColumn } from '../../helpers/filter-input-fixtures';

afterEach(() => {
  cleanup();
});

describe('TextFilterInput (plan 042 step 1)', () => {
  it('commits typed text on blur for operator "contains"', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeTextColumn();

    render(
      <TextFilterInput
        filter={baseFilter({ columnId: 'name', type: 'text', operator: 'contains' })}
        column={column}
        onChange={onChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(['alice']);
  });

  it('commits typed text on Enter for operator "equals"', () => {
    const onChange = mock((values: unknown[]) => values);
    const column = makeTextColumn();

    render(
      <TextFilterInput
        filter={baseFilter({ columnId: 'name', type: 'text', operator: 'equals' })}
        column={column}
        onChange={onChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'exact' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange.mock.calls[0]?.[0]).toEqual(['exact']);
  });

  it('isEmpty/isNotEmpty render without a value input', () => {
    const onChange = mock(() => {});
    const column = makeTextColumn();

    const { rerender } = render(
      <TextFilterInput
        filter={baseFilter({ columnId: 'name', type: 'text', operator: 'isEmpty' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require a value/i)).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();

    rerender(
      <TextFilterInput
        filter={baseFilter({ columnId: 'name', type: 'text', operator: 'isNotEmpty' })}
        column={column}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/doesn't require a value/i)).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();
  });
});
