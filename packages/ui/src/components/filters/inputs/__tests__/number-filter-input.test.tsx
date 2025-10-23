import type { ColumnDefinition, FilterState } from '@better-tables/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NumberFilterInput } from '../components/filters/inputs/number-filter-input';

const mockColumn: ColumnDefinition = {
  id: 'age',
  displayName: 'Age',
  accessor: (data: any) => data.age,
  type: 'number',
  sortable: true,
  filterable: true,
};

const mockFilter: FilterState = {
  columnId: 'age',
  type: 'number',
  operator: 'gte',
  values: [25],
};

describe('NumberFilterInput', () => {
  const defaultProps = {
    filter: mockFilter,
    column: mockColumn,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render number input with current value', () => {
    render(<NumberFilterInput {...defaultProps} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(25);
  });

  it('should call onChange when input value changes', async () => {
    render(<NumberFilterInput {...defaultProps} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '30' } });

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith([30]);
    });
  });

  it('should handle between operator with two inputs', () => {
    const betweenFilter: FilterState = {
      ...mockFilter,
      operator: 'between',
      values: [25, 65],
    };

    render(<NumberFilterInput {...defaultProps} filter={betweenFilter} />);

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(25);
    expect(inputs[1]).toHaveValue(65);
  });

  it('should handle notBetween operator with two inputs', () => {
    const notBetweenFilter: FilterState = {
      ...mockFilter,
      operator: 'notBetween',
      values: [25, 65],
    };

    render(<NumberFilterInput {...defaultProps} filter={notBetweenFilter} />);

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(25);
    expect(inputs[1]).toHaveValue(65);
  });

  it('should call onChange with both values for between operator', async () => {
    const betweenFilter: FilterState = {
      ...mockFilter,
      operator: 'between',
      values: [25, 65],
    };

    render(<NumberFilterInput {...defaultProps} filter={betweenFilter} />);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '30' } });

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith([30, 65]);
    });
  });

  it('should handle empty values', () => {
    const emptyFilter: FilterState = {
      ...mockFilter,
      values: [],
    };

    render(<NumberFilterInput {...defaultProps} filter={emptyFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(null);
  });

  it('should handle null values', () => {
    const nullFilter: FilterState = {
      ...mockFilter,
      values: [null],
    };

    render(<NumberFilterInput {...defaultProps} filter={nullFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(null);
  });

  it('should handle disabled state', () => {
    render(<NumberFilterInput {...defaultProps} disabled={true} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toBeDisabled();
  });

  it('should handle min/max constraints', () => {
    const columnWithConstraints: ColumnDefinition = {
      ...mockColumn,
      filter: {
        min: 0,
        max: 100,
      },
    };

    render(<NumberFilterInput {...defaultProps} column={columnWithConstraints} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });

  it('should handle step attribute for decimal values', () => {
    const decimalColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'currency',
    };

    render(<NumberFilterInput {...defaultProps} column={decimalColumn} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('step', '0.01');
  });

  it('should handle validation errors', async () => {
    const columnWithValidation: ColumnDefinition = {
      ...mockColumn,
      filter: {
        min: 0,
        max: 100,
        validation: (value: any) => {
          if (value < 0) {
            return 'Value must be positive';
          }
          return true;
        },
      },
    };

    render(<NumberFilterInput {...defaultProps} column={columnWithValidation} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-10' } });

    await waitFor(() => {
      expect(screen.getByText('Value must be positive')).toBeInTheDocument();
    });
  });

  it('should handle currency formatting', () => {
    const currencyColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'currency',
    };

    const currencyFilter: FilterState = {
      ...mockFilter,
      type: 'currency',
      values: [1000],
    };

    render(<NumberFilterInput {...defaultProps} column={currencyColumn} filter={currencyFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);
  });

  it('should handle percentage formatting', () => {
    const percentageColumn: ColumnDefinition = {
      ...mockColumn,
      type: 'percentage',
    };

    const percentageFilter: FilterState = {
      ...mockFilter,
      type: 'percentage',
      values: [0.25],
    };

    render(
      <NumberFilterInput {...defaultProps} column={percentageColumn} filter={percentageFilter} />
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0.25);
  });

  it('should handle keyboard events', () => {
    render(<NumberFilterInput {...defaultProps} />);

    const input = screen.getByRole('spinbutton');

    // Enter key should not prevent default
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveFocus();

    // Escape key should clear input
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue(null);
  });

  it('should handle focus and blur events', () => {
    render(<NumberFilterInput {...defaultProps} />);

    const input = screen.getByRole('spinbutton');

    fireEvent.focus(input);
    expect(input).toHaveFocus();

    fireEvent.blur(input);
    expect(input).not.toHaveFocus();
  });

  it('should handle different number operators', () => {
    const operators = [
      'equals',
      'notEquals',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'notBetween',
      'in',
    ];

    operators.forEach((operator) => {
      const filter: FilterState = {
        ...mockFilter,
        operator: operator as any,
        values: operator === 'between' || operator === 'notBetween' ? [25, 65] : [25],
      };

      const { unmount } = render(<NumberFilterInput {...defaultProps} filter={filter} />);

      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBeGreaterThan(0);

      unmount();
    });
  });

  it('should handle in operator with multiple values', () => {
    const inFilter: FilterState = {
      ...mockFilter,
      operator: 'in',
      values: [25, 30, 35],
    };

    render(<NumberFilterInput {...defaultProps} filter={inFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue('25, 30, 35');
  });

  it('should handle accessibility attributes', () => {
    render(<NumberFilterInput {...defaultProps} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('aria-label', 'Filter Age');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('should handle custom className', () => {
    const { container } = render(<NumberFilterInput {...defaultProps} className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should handle very large numbers', () => {
    const largeNumberFilter: FilterState = {
      ...mockFilter,
      values: [999999999],
    };

    render(<NumberFilterInput {...defaultProps} filter={largeNumberFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(999999999);
  });

  it('should handle very small numbers', () => {
    const smallNumberFilter: FilterState = {
      ...mockFilter,
      values: [0.0001],
    };

    render(<NumberFilterInput {...defaultProps} filter={smallNumberFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0.0001);
  });

  it('should handle negative numbers', () => {
    const negativeFilter: FilterState = {
      ...mockFilter,
      values: [-25],
    };

    render(<NumberFilterInput {...defaultProps} filter={negativeFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(-25);
  });

  it('should handle zero values', () => {
    const zeroFilter: FilterState = {
      ...mockFilter,
      values: [0],
    };

    render(<NumberFilterInput {...defaultProps} filter={zeroFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0);
  });

  it('should handle invalid number input gracefully', async () => {
    render(<NumberFilterInput {...defaultProps} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: 'not a number' } });

    // Should not call onChange with invalid value
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('should handle decimal precision', () => {
    const decimalFilter: FilterState = {
      ...mockFilter,
      values: [25.123],
    };

    render(<NumberFilterInput {...defaultProps} filter={decimalFilter} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(25.123);
  });
});
