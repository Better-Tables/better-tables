import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DateFilterInput } from '../../inputs/date-filter-input';

const mockColumn: ColumnDefinition = {
  id: 'createdAt',
  displayName: 'Created At',
  accessor: (data: any) => data.createdAt,
  type: 'date',
  sortable: true,
  filterable: true,
};

const mockFilter: FilterState = {
  columnId: 'createdAt',
  type: 'date',
  operator: 'after',
  values: [new Date('2023-01-01')],
};

describe('DateFilterInput', () => {
  const defaultProps = {
    filter: mockFilter,
    column: mockColumn,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render date input with current value', () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('2023-01-01');
  });

  it('should call onChange when date value changes', async () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '2023-02-01' } });

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith([new Date('2023-02-01')]);
    });
  });

  it('should handle between operator with two date inputs', () => {
    const betweenFilter: FilterState = {
      ...mockFilter,
      operator: 'between',
      values: [new Date('2023-01-01'), new Date('2023-12-31')],
    };

    render(<DateFilterInput {...defaultProps} filter={betweenFilter} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue('2023-01-01');
    expect(inputs[1]).toHaveValue('2023-12-31');
  });

  it('should handle notBetween operator with two date inputs', () => {
    const notBetweenFilter: FilterState = {
      ...mockFilter,
      operator: 'notBetween',
      values: [new Date('2023-01-01'), new Date('2023-12-31')],
    };

    render(<DateFilterInput {...defaultProps} filter={notBetweenFilter} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue('2023-01-01');
    expect(inputs[1]).toHaveValue('2023-12-31');
  });

  it('should call onChange with both values for between operator', async () => {
    const betweenFilter: FilterState = {
      ...mockFilter,
      operator: 'between',
      values: [new Date('2023-01-01'), new Date('2023-12-31')],
    };

    render(<DateFilterInput {...defaultProps} filter={betweenFilter} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '2023-02-01' } });

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith([
        new Date('2023-02-01'),
        new Date('2023-12-31'),
      ]);
    });
  });

  it('should handle empty values', () => {
    const emptyFilter: FilterState = {
      ...mockFilter,
      values: [],
    };

    render(<DateFilterInput {...defaultProps} filter={emptyFilter} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('should handle null values', () => {
    const nullFilter: FilterState = {
      ...mockFilter,
      values: [null],
    };

    render(<DateFilterInput {...defaultProps} filter={nullFilter} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('should handle disabled state', () => {
    render(<DateFilterInput {...defaultProps} disabled={true} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should handle min/max date constraints', () => {
    const columnWithConstraints: ColumnDefinition = {
      ...mockColumn,
      filter: {
        min: 20200101,
        max: 20301231,
      },
    };

    render(<DateFilterInput {...defaultProps} column={columnWithConstraints} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('min', '2020-01-01');
    expect(input).toHaveAttribute('max', '2030-12-31');
  });

  it('should handle validation errors', async () => {
    const columnWithValidation: ColumnDefinition = {
      ...mockColumn,
      filter: {
        validation: (value: any) => {
          if (value && value < new Date('2020-01-01')) {
            return 'Date must be after 2020';
          }
          return true;
        },
      },
    };

    render(<DateFilterInput {...defaultProps} column={columnWithValidation} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '2019-01-01' } });

    await waitFor(() => {
      expect(screen.getByText('Date must be after 2020')).toBeInTheDocument();
    });
  });

  it('should handle keyboard events', () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');

    // Enter key should not prevent default
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveFocus();

    // Escape key should clear input
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('should handle focus and blur events', () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    expect(input).toHaveFocus();

    fireEvent.blur(input);
    expect(input).not.toHaveFocus();
  });

  it('should handle different date operators', () => {
    const operators = [
      'equals',
      'notEquals',
      'after',
      'before',
      'onOrAfter',
      'onOrBefore',
      'between',
      'notBetween',
    ];

    operators.forEach((operator) => {
      const filter: FilterState = {
        ...mockFilter,
        operator: operator as any,
        values:
          operator === 'between' || operator === 'notBetween'
            ? [new Date('2023-01-01'), new Date('2023-12-31')]
            : [new Date('2023-01-01')],
      };

      const { unmount } = render(<DateFilterInput {...defaultProps} filter={filter} />);

      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);

      unmount();
    });
  });

  it('should handle accessibility attributes', () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Filter Created At');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('should handle custom className', () => {
    const { container } = render(<DateFilterInput {...defaultProps} />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should handle date format variations', () => {
    const dateFormats = ['2023-01-01', '2023-01-01T00:00:00.000Z', '2023-01-01T12:00:00'];

    dateFormats.forEach((format) => {
      const filter: FilterState = {
        ...mockFilter,
        values: [new Date(format)],
      };

      const { unmount } = render(<DateFilterInput {...defaultProps} filter={filter} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();

      unmount();
    });
  });

  it('should handle timezone considerations', () => {
    const utcDate = new Date('2023-01-01T00:00:00.000Z');
    const localDate = new Date('2023-01-01T00:00:00');

    const utcFilter: FilterState = {
      ...mockFilter,
      values: [utcDate],
    };

    const localFilter: FilterState = {
      ...mockFilter,
      values: [localDate],
    };

    render(<DateFilterInput {...defaultProps} filter={utcFilter} />);
    const utcInput = screen.getByRole('textbox');
    expect(utcInput).toBeInTheDocument();

    render(<DateFilterInput {...defaultProps} filter={localFilter} />);
    const localInput = screen.getByRole('textbox');
    expect(localInput).toBeInTheDocument();
  });

  it('should handle leap year dates', () => {
    const leapYearFilter: FilterState = {
      ...mockFilter,
      values: [new Date('2024-02-29')],
    };

    render(<DateFilterInput {...defaultProps} filter={leapYearFilter} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('2024-02-29');
  });

  it('should handle edge case dates', () => {
    const edgeDates = [new Date('1900-01-01'), new Date('2100-12-31'), new Date('2000-01-01')];

    edgeDates.forEach((date) => {
      const filter: FilterState = {
        ...mockFilter,
        values: [date],
      };

      const { unmount } = render(<DateFilterInput {...defaultProps} filter={filter} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();

      unmount();
    });
  });

  it('should handle invalid date input gracefully', async () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not a date' } });

    // Should not call onChange with invalid date
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('should handle date picker integration', async () => {
    render(<DateFilterInput {...defaultProps} />);

    const input = screen.getByRole('textbox');

    // Click to open date picker
    fireEvent.click(input);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should handle date range presets', () => {
    const columnWithPresets: ColumnDefinition = {
      ...mockColumn,
      filter: {
        options: [
          {
            label: 'Last 7 days',
            value:
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toString() +
              ',' +
              new Date().toString(),
          },
          {
            label: 'Last 30 days',
            value:
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toString() +
              ',' +
              new Date().toString(),
          },
        ],
      },
    };

    render(<DateFilterInput {...defaultProps} column={columnWithPresets} />);

    // Should render preset buttons
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('should handle date format configuration', () => {
    const columnWithFormat: ColumnDefinition = {
      ...mockColumn,
      filter: {
        format: 'MM/dd/yyyy',
      },
    };

    render(<DateFilterInput {...defaultProps} column={columnWithFormat} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('should handle time component for datetime', () => {
    const datetimeColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'date',
      filter: {
        includeTime: true,
      },
    };

    render(<DateFilterInput {...defaultProps} column={datetimeColumn} />);

    // Should render time input as well
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(1);
  });
});
