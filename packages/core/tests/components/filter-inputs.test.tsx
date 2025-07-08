import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TextFilterInput,
  NumberFilterInput,
  DateFilterInput,
  OptionFilterInput,
  MultiOptionFilterInput,
  BooleanFilterInput,
} from '../../src/components/filter-inputs';
import type { ColumnDefinition } from '../../src/types/column';
import type { FilterOperatorDefinition } from '../../src/types/filter';

// Mock column definitions
const mockTextColumn: ColumnDefinition = {
  id: 'name',
  displayName: 'Name',
  type: 'text',
  accessor: (row: any) => row.name,
  filterable: true,
  sortable: true,
  resizable: true,
  filter: {
    operators: ['contains', 'equals', 'startsWith', 'endsWith'],
    debounce: 300,
  },
};

const mockNumberColumn: ColumnDefinition = {
  id: 'age',
  displayName: 'Age',
  type: 'number',
  accessor: (row: any) => row.age,
  filterable: true,
  sortable: true,
  resizable: true,
  filter: {
    operators: ['equals', 'greaterThan', 'lessThan', 'between'],
    min: 0,
    max: 120,
  },
};

const mockOptionColumn: ColumnDefinition = {
  id: 'status',
  displayName: 'Status',
  type: 'option',
  accessor: (row: any) => row.status,
  filterable: true,
  sortable: true,
  resizable: true,
  filter: {
    operators: ['is', 'isNot', 'isAnyOf', 'isNoneOf'],
    options: [
      { value: 'active', label: 'Active', count: 10 },
      { value: 'inactive', label: 'Inactive', count: 5 },
      { value: 'pending', label: 'Pending', count: 3 },
    ],
  },
};

const mockDateColumn: ColumnDefinition = {
  id: 'createdAt',
  displayName: 'Created At',
  type: 'date',
  accessor: (row: any) => row.createdAt,
  filterable: true,
  sortable: true,
  resizable: true,
  filter: {
    operators: ['is', 'before', 'after', 'between'],
  },
};

const mockMultiOptionColumn: ColumnDefinition = {
  id: 'tags',
  displayName: 'Tags',
  type: 'multiOption',
  accessor: (row: any) => row.tags,
  filterable: true,
  sortable: true,
  resizable: true,
  filter: {
    operators: ['includes', 'excludes', 'includesAny', 'includesAll'],
    options: [
      { value: 'urgent', label: 'Urgent', count: 5 },
      { value: 'important', label: 'Important', count: 8 },
      { value: 'bug', label: 'Bug', count: 3 },
      { value: 'feature', label: 'Feature', count: 12 },
    ],
  },
};

const mockBooleanColumn: ColumnDefinition = {
  id: 'verified',
  displayName: 'Verified',
  type: 'boolean',
  accessor: (row: any) => row.verified,
  filterable: true,
  sortable: true,
  resizable: true,
  filter: {
    operators: ['isTrue', 'isFalse', 'isNull', 'isNotNull'],
  },
};

// Mock operators
const mockTextOperators: FilterOperatorDefinition[] = [
  {
    key: 'contains',
    label: 'Contains',
    description: 'Contains text',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'equals',
    label: 'Equals',
    description: 'Equals text',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'startsWith',
    label: 'Starts with',
    description: 'Starts with text',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'endsWith',
    label: 'Ends with',
    description: 'Ends with text',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
];

const mockNumberOperators: FilterOperatorDefinition[] = [
  {
    key: 'equals',
    label: 'Equals',
    description: 'Equals number',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'greaterThan',
    label: 'Greater than',
    description: 'Greater than number',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'lessThan',
    label: 'Less than',
    description: 'Less than number',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'between',
    label: 'Between',
    description: 'Between numbers',
    valueCount: 2,
    supportsNull: false,
    validate: values => values.length === 2,
  },
];

const mockOptionOperators: FilterOperatorDefinition[] = [
  {
    key: 'is',
    label: 'Is',
    description: 'Is option',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'isNot',
    label: 'Is not',
    description: 'Is not option',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'isAnyOf',
    label: 'Is any of',
    description: 'Is any of options',
    valueCount: 'variable',
    supportsNull: false,
    validate: values => values.length > 0,
  },
  {
    key: 'isNoneOf',
    label: 'Is none of',
    description: 'Is none of options',
    valueCount: 'variable',
    supportsNull: false,
    validate: values => values.length > 0,
  },
];

const mockDateOperators: FilterOperatorDefinition[] = [
  {
    key: 'is',
    label: 'Is',
    description: 'Is date',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'before',
    label: 'Before',
    description: 'Before date',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'after',
    label: 'After',
    description: 'After date',
    valueCount: 1,
    supportsNull: false,
    validate: values => values.length === 1,
  },
  {
    key: 'between',
    label: 'Between',
    description: 'Between dates',
    valueCount: 2,
    supportsNull: false,
    validate: values => values.length === 2,
  },
];

const mockMultiOptionOperators: FilterOperatorDefinition[] = [
  {
    key: 'includes',
    label: 'Includes',
    description: 'Includes any',
    valueCount: 'variable',
    supportsNull: false,
    validate: values => values.length > 0,
  },
  {
    key: 'excludes',
    label: 'Excludes',
    description: 'Excludes any',
    valueCount: 'variable',
    supportsNull: false,
    validate: values => values.length > 0,
  },
  {
    key: 'includesAny',
    label: 'Includes any',
    description: 'Includes any of',
    valueCount: 'variable',
    supportsNull: false,
    validate: values => values.length > 0,
  },
  {
    key: 'includesAll',
    label: 'Includes all',
    description: 'Includes all of',
    valueCount: 'variable',
    supportsNull: false,
    validate: values => values.length > 0,
  },
];

const mockBooleanOperators: FilterOperatorDefinition[] = [
  {
    key: 'isTrue',
    label: 'Is true',
    description: 'Is true',
    valueCount: 0,
    supportsNull: false,
    validate: values => values.length === 0,
  },
  {
    key: 'isFalse',
    label: 'Is false',
    description: 'Is false',
    valueCount: 0,
    supportsNull: false,
    validate: values => values.length === 0,
  },
  {
    key: 'isNull',
    label: 'Is null',
    description: 'Is null',
    valueCount: 0,
    supportsNull: true,
    validate: values => values.length === 0,
  },
  {
    key: 'isNotNull',
    label: 'Is not null',
    description: 'Is not null',
    valueCount: 0,
    supportsNull: true,
    validate: values => values.length === 0,
  },
];

describe('TextFilterInput', () => {
  const mockProps = {
    filter: {
      columnId: 'name',
      type: 'text' as const,
      operator: 'contains' as const,
      values: [''],
    },
    column: mockTextColumn,
    operators: mockTextOperators,
    operator: 'contains' as const,
    values: [''],
    onOperatorChange: vi.fn(),
    onValuesChange: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct initial state', () => {
    render(<TextFilterInput {...mockProps} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Contains')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('calls onOperatorChange when operator changes', () => {
    render(<TextFilterInput {...mockProps} />);

    const select = screen.getByDisplayValue('Contains');
    fireEvent.change(select, { target: { value: 'equals' } });

    expect(mockProps.onOperatorChange).toHaveBeenCalledWith('equals');
  });

  it('calls onValuesChange when text input changes', async () => {
    render(<TextFilterInput {...mockProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should debounce the input
    await waitFor(
      () => {
        expect(mockProps.onValuesChange).toHaveBeenCalledWith(['test']);
      },
      { timeout: 500 },
    );
  });

  it('calls onRemove when remove button is clicked', () => {
    render(<TextFilterInput {...mockProps} />);

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    expect(mockProps.onRemove).toHaveBeenCalled();
  });

  it('shows case sensitivity toggle when enabled', () => {
    render(<TextFilterInput {...mockProps} showCaseSensitive={true} />);

    expect(screen.getByLabelText(/case sensitive/i)).toBeInTheDocument();
  });

  it('hides input for no-value operators', () => {
    const propsWithNoValue = {
      ...mockProps,
      operator: 'isEmpty' as const,
      operators: [
        {
          key: 'isEmpty',
          label: 'Is empty',
          description: 'Is empty',
          valueCount: 0,
          supportsNull: false,
          validate: (values: any[]) => values.length === 0,
        },
      ] as FilterOperatorDefinition[],
    };

    render(<TextFilterInput {...propsWithNoValue} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('NumberFilterInput', () => {
  const mockProps = {
    filter: { columnId: 'age', type: 'number' as const, operator: 'equals' as const, values: [25] },
    column: mockNumberColumn,
    operators: mockNumberOperators,
    operator: 'equals' as const,
    values: [25],
    onOperatorChange: vi.fn(),
    onValuesChange: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct initial state', () => {
    render(<NumberFilterInput {...mockProps} />);

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Equals')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
  });

  it('shows two inputs for range operators', () => {
    const propsWithRange = {
      ...mockProps,
      operator: 'between' as const,
      values: [20, 30],
    };

    render(<NumberFilterInput {...propsWithRange} />);

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(20);
    expect(inputs[1]).toHaveValue(30);
  });

  it('formats currency values correctly', () => {
    const propsWithCurrency = {
      ...mockProps,
      format: 'currency' as const,
      values: [1234.56],
    };

    render(<NumberFilterInput {...propsWithCurrency} />);

    expect(screen.getByDisplayValue('1234.56')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('formats percentage values correctly', () => {
    const propsWithPercentage = {
      ...mockProps,
      format: 'percentage' as const,
      values: [0.25],
    };

    render(<NumberFilterInput {...propsWithPercentage} />);

    expect(screen.getByDisplayValue('25.00')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });
});

describe('OptionFilterInput', () => {
  const mockProps = {
    filter: {
      columnId: 'status',
      type: 'option' as const,
      operator: 'is' as const,
      values: ['active'],
    },
    column: mockOptionColumn,
    operators: mockOptionOperators,
    operator: 'is' as const,
    values: ['active'],
    onOperatorChange: vi.fn(),
    onValuesChange: vi.fn(),
    onRemove: vi.fn(),
    options: mockOptionColumn.filter!.options!,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct initial state', () => {
    render(<OptionFilterInput {...mockProps} />);

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Is')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows option counts when enabled', () => {
    render(<OptionFilterInput {...mockProps} showCounts={true} />);

    expect(screen.getByText('(10)')).toBeInTheDocument();
  });

  it('allows multiple selections for variable operators', () => {
    const propsWithMultiple = {
      ...mockProps,
      operator: 'isAnyOf' as const,
      values: ['active', 'pending'],
    };

    render(<OptionFilterInput {...propsWithMultiple} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows dropdown when search input is focused', () => {
    render(<OptionFilterInput {...mockProps} />);

    const searchInput = screen.getByRole('textbox');
    fireEvent.focus(searchInput);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('filters options based on search term', () => {
    render(<OptionFilterInput {...mockProps} />);

    const searchInput = screen.getByRole('textbox');
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'act' } });

    // Check that the dropdown contains the filtered options
    const dropdown = document.querySelector('.filter-input__option-dropdown');
    expect(dropdown).toBeInTheDocument();

    // Check for specific options in the dropdown by getting all buttons and filtering
    const dropdownButtons = screen
      .getAllByRole('button')
      .filter(button => button.closest('.filter-input__option-dropdown'));

    expect(dropdownButtons).toHaveLength(2);
    expect(dropdownButtons.some(btn => btn.textContent?.includes('Active'))).toBe(true);
    expect(dropdownButtons.some(btn => btn.textContent?.includes('Inactive'))).toBe(true);
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });
});

describe('BooleanFilterInput', () => {
  const mockProps = {
    filter: {
      columnId: 'verified',
      type: 'boolean' as const,
      operator: 'isTrue' as const,
      values: [],
    },
    column: mockBooleanColumn,
    operators: mockBooleanOperators,
    operator: 'isTrue' as const,
    values: [],
    onOperatorChange: vi.fn(),
    onValuesChange: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct initial state', () => {
    render(<BooleanFilterInput {...mockProps} />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Is true')).toBeInTheDocument();
    expect(screen.getByText('True')).toBeInTheDocument(); // Implied value display
  });

  it('shows radio buttons for value operators', () => {
    const propsWithValue = {
      ...mockProps,
      operator: 'equals' as const,
      operators: [
        {
          key: 'equals',
          label: 'Equals',
          description: 'Equals boolean',
          valueCount: 1,
          supportsNull: false,
          validate: (values: any[]) => values.length === 1,
        },
      ] as FilterOperatorDefinition[],
    };

    render(<BooleanFilterInput {...propsWithValue} />);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(2); // True and False
    expect(screen.getByLabelText('True')).toBeInTheDocument();
    expect(screen.getByLabelText('False')).toBeInTheDocument();
  });

  it('shows indeterminate option when enabled', () => {
    const propsWithIndeterminate = {
      ...mockProps,
      operator: 'equals' as const,
      operators: [
        {
          key: 'equals',
          label: 'Equals',
          description: 'Equals boolean',
          valueCount: 1,
          supportsNull: false,
          validate: (values: any[]) => values.length === 1,
        },
      ] as FilterOperatorDefinition[],
      showIndeterminate: true,
    };

    render(<BooleanFilterInput {...propsWithIndeterminate} />);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(3); // True, False, and Not Set
    expect(screen.getByLabelText('Not Set')).toBeInTheDocument();
  });

  it('calls onValuesChange when radio button is selected', () => {
    const propsWithValue = {
      ...mockProps,
      operator: 'equals' as const,
      operators: [
        {
          key: 'equals',
          label: 'Equals',
          description: 'Equals boolean',
          valueCount: 1,
          supportsNull: false,
          validate: (values: any[]) => values.length === 1,
        },
      ] as FilterOperatorDefinition[],
    };

    render(<BooleanFilterInput {...propsWithValue} />);

    const trueRadio = screen.getByLabelText('True');
    fireEvent.click(trueRadio);

    expect(mockProps.onValuesChange).toHaveBeenCalledWith([true]);
  });

  it('uses custom labels when provided', () => {
    const propsWithCustomLabels = {
      ...mockProps,
      operator: 'equals' as const,
      operators: [
        {
          key: 'equals',
          label: 'Equals',
          description: 'Equals boolean',
          valueCount: 1,
          supportsNull: false,
          validate: (values: any[]) => values.length === 1,
        },
      ] as FilterOperatorDefinition[],
      trueLabel: 'Yes',
      falseLabel: 'No',
      nullLabel: 'Unknown',
      showIndeterminate: true,
    };

    render(<BooleanFilterInput {...propsWithCustomLabels} />);

    expect(screen.getByLabelText('Yes')).toBeInTheDocument();
    expect(screen.getByLabelText('No')).toBeInTheDocument();
    expect(screen.getByLabelText('Unknown')).toBeInTheDocument();
  });
});

describe('DateFilterInput', () => {
  const mockProps = {
    filter: {
      columnId: 'createdAt',
      type: 'date' as const,
      operator: 'is' as const,
      values: [new Date('2023-01-01')],
    },
    column: mockDateColumn,
    operators: mockDateOperators,
    operator: 'is' as const,
    values: [new Date('2023-01-01')],
    onOperatorChange: vi.fn(),
    onValuesChange: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct initial state', () => {
    render(<DateFilterInput {...mockProps} />);

    expect(screen.getByText('Created At')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Is')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2023-01-01')).toBeInTheDocument();
  });

  it('shows two date inputs for range operators', () => {
    const propsWithRange = {
      ...mockProps,
      operator: 'between' as const,
      values: [new Date('2023-01-01'), new Date('2023-12-31')],
    };

    render(<DateFilterInput {...propsWithRange} />);

    const dateInputs = screen.getAllByDisplayValue(/2023-/);
    expect(dateInputs).toHaveLength(2);
    expect(screen.getByDisplayValue('2023-01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2023-12-31')).toBeInTheDocument();
  });

  it('shows presets when provided', () => {
    const presets = [
      {
        key: 'today',
        label: 'Today',
        range: {
          start: new Date(),
          end: new Date(),
        },
        relative: true,
      },
    ];

    render(<DateFilterInput {...mockProps} presets={presets} />);

    const presetsButton = screen.getByRole('button', { name: 'Toggle date presets' });
    expect(presetsButton).toBeInTheDocument();
  });

  it('calls onValuesChange when date input changes', async () => {
    render(<DateFilterInput {...mockProps} />);

    const dateInput = screen.getByDisplayValue('2023-01-01');
    fireEvent.change(dateInput, { target: { value: '2023-06-15' } });

    await waitFor(() => {
      expect(mockProps.onValuesChange).toHaveBeenCalled();
    });
  });
});

describe('MultiOptionFilterInput', () => {
  const mockProps = {
    filter: {
      columnId: 'tags',
      type: 'multiOption' as const,
      operator: 'includes' as const,
      values: ['urgent', 'important'],
    },
    column: mockMultiOptionColumn,
    operators: mockMultiOptionOperators,
    operator: 'includes' as const,
    values: ['urgent', 'important'],
    onOperatorChange: vi.fn(),
    onValuesChange: vi.fn(),
    onRemove: vi.fn(),
    options: mockMultiOptionColumn.filter!.options!,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct initial state', () => {
    render(<MultiOptionFilterInput {...mockProps} />);

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Includes')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('shows selected options as tags', () => {
    render(<MultiOptionFilterInput {...mockProps} />);

    const selectedOptions = screen.getAllByRole('button', { name: /Remove (Urgent|Important)/ });
    expect(selectedOptions).toHaveLength(2);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('opens dropdown when toggle button is clicked', () => {
    render(<MultiOptionFilterInput {...mockProps} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Tags options' });
    fireEvent.click(toggleButton);

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('shows option counts when enabled', () => {
    render(<MultiOptionFilterInput {...mockProps} showCounts={true} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Tags options' });
    fireEvent.click(toggleButton);

    expect(screen.getByText('(3)')).toBeInTheDocument(); // Bug count
    expect(screen.getByText('(12)')).toBeInTheDocument(); // Feature count
  });

  it('allows searching options', async () => {
    render(<MultiOptionFilterInput {...mockProps} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Tags options' });
    fireEvent.click(toggleButton);

    const searchInput = screen.getByPlaceholderText('Search options...');
    fireEvent.change(searchInput, { target: { value: 'bug' } });

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.queryByText('Feature')).not.toBeInTheDocument();
    });
  });

  it('calls onValuesChange when option is selected', () => {
    render(<MultiOptionFilterInput {...mockProps} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Tags options' });
    fireEvent.click(toggleButton);

    const bugOption = screen.getByRole('button', { name: 'Select Bug' });
    fireEvent.click(bugOption);

    expect(mockProps.onValuesChange).toHaveBeenCalledWith(['urgent', 'important', 'bug']);
  });

  it('removes option when remove button is clicked', () => {
    render(<MultiOptionFilterInput {...mockProps} />);

    const removeButton = screen.getByRole('button', { name: 'Remove Urgent' });
    fireEvent.click(removeButton);

    expect(mockProps.onValuesChange).toHaveBeenCalledWith(['important']);
  });
});
