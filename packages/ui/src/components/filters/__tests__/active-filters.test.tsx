import type { ColumnDefinition, FilterState } from "@better-tables/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveFilters } from "../active-filters";

const mockColumns: ColumnDefinition[] = [
  {
    id: "name",
    displayName: "Name",
    accessor: (data: any) => data.name,
    type: "text",
    sortable: true,
    filterable: true,
  },
  {
    id: "age",
    displayName: "Age",
    accessor: (data: any) => data.age,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    id: "status",
    displayName: "Status",
    accessor: (data: any) => data.status,
    type: "option",
    sortable: true,
    filterable: true,
    filter: {
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  },
];

const mockFilters: FilterState[] = [
  {
    columnId: "name",
    type: "text",
    operator: "contains",
    values: ["John"],
  },
  {
    columnId: "age",
    type: "number",
    operator: "greaterThanOrEqual",
    values: [25],
  },
  {
    columnId: "status",
    type: "option",
    operator: "equals",
    values: ["active"],
  },
];

describe("ActiveFilters", () => {
  const defaultProps = {
    columns: mockColumns,
    filters: mockFilters,
    onUpdateFilter: vi.fn(),
    onRemoveFilter: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all active filters", () => {
    render(<ActiveFilters {...defaultProps} />);

    expect(screen.getByText('Name: contains "John"')).toBeInTheDocument();
    expect(screen.getByText("Age: ≥ 25")).toBeInTheDocument();
    expect(screen.getByText('Status: = "active"')).toBeInTheDocument();
  });

  it("should render remove buttons for each filter", () => {
    render(<ActiveFilters {...defaultProps} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(3);
  });

  it("should call onRemoveFilter when remove button is clicked", () => {
    render(<ActiveFilters {...defaultProps} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(defaultProps.onRemoveFilter).toHaveBeenCalledWith("name");
  });

  it("should render edit buttons for each filter", () => {
    render(<ActiveFilters {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    expect(editButtons).toHaveLength(3);
  });

  it("should open edit dialog when edit button is clicked", async () => {
    render(<ActiveFilters {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("should handle text filter value formatting", () => {
    const textFilter: FilterState = {
      columnId: "name",
      type: "text",
      operator: "startsWith",
      values: ["John"],
    };

    render(
      <ActiveFilters
        {...defaultProps}
        filters={[textFilter]}
      />
    );

    expect(screen.getByText('Name: starts with "John"')).toBeInTheDocument();
  });

  it("should handle number filter value formatting", () => {
    const numberFilter: FilterState = {
      columnId: "age",
      type: "number",
      operator: "between",
      values: [25, 65],
    };

    render(
      <ActiveFilters
        {...defaultProps}
        filters={[numberFilter]}
      />
    );

    expect(screen.getByText("Age: between 25 and 65")).toBeInTheDocument();
  });

  it("should handle option filter value formatting", () => {
    const optionFilter: FilterState = {
      columnId: "status",
      type: "option",
      operator: "isAnyOf",
      values: ["active", "inactive"],
    };

    render(
      <ActiveFilters
        {...defaultProps}
        filters={[optionFilter]}
      />
    );

    expect(
      screen.getByText('Status: in "active", "inactive"')
    ).toBeInTheDocument();
  });

  it("should handle boolean filter value formatting", () => {
    const booleanColumn: ColumnDefinition = {
      id: "isActive",
      displayName: "Active",
      accessor: (data: any) => data.isActive,
      type: "boolean",
      sortable: true,
      filterable: true,
    };

    const booleanFilter: FilterState = {
      columnId: "isActive",
      type: "boolean",
      operator: "equals",
      values: [true],
    };

    render(
      <ActiveFilters
        columns={[booleanColumn]}
        filters={[booleanFilter]}
        onUpdateFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
      />
    );

    expect(screen.getByText("Active: = true")).toBeInTheDocument();
  });

  it("should handle date filter value formatting", () => {
    const dateColumn: ColumnDefinition = {
      id: "createdAt",
      displayName: "Created",
      accessor: (data: any) => data.createdAt,
      type: "date",
      sortable: true,
      filterable: true,
    };

    const dateFilter: FilterState = {
      columnId: "createdAt",
      type: "date",
      operator: "after",
      values: [new Date("2023-01-01")],
    };

    render(
      <ActiveFilters
        columns={[dateColumn]}
        filters={[dateFilter]}
        onUpdateFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
      />
    );

    expect(screen.getByText(/Created: after/)).toBeInTheDocument();
  });

  it("should handle empty filters array", () => {
    render(
      <ActiveFilters
        {...defaultProps}
        filters={[]}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should handle disabled state", () => {
    render(
      <ActiveFilters
        {...defaultProps}
        disabled={true}
      />
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("should handle protected filters", () => {
    const isFilterProtected = (filter: FilterState) =>
      filter.columnId === "name";

    render(
      <ActiveFilters
        {...defaultProps}
        isFilterProtected={isFilterProtected}
      />
    );

    const nameFilter = screen.getByText('Name: contains "John"');
    expect(nameFilter.closest('[data-protected="true"]')).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <ActiveFilters
        {...defaultProps}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should handle filter with null values", () => {
    const nullFilter: FilterState = {
      columnId: "name",
      type: "text",
      operator: "isNull",
      values: [],
    };

    render(
      <ActiveFilters
        {...defaultProps}
        filters={[nullFilter]}
      />
    );

    expect(screen.getByText("Name: is null")).toBeInTheDocument();
  });

  it("should handle filter with multiple values", () => {
    const multiValueFilter: FilterState = {
      columnId: "age",
      type: "number",
      operator: "isAnyOf",
      values: [25, 30, 35],
    };

    render(
      <ActiveFilters
        {...defaultProps}
        filters={[multiValueFilter]}
      />
    );

    expect(screen.getByText("Age: in 25, 30, 35")).toBeInTheDocument();
  });

  it("should handle unknown column gracefully", () => {
    const unknownFilter: FilterState = {
      columnId: "unknown",
      type: "text",
      operator: "contains",
      values: ["test"],
    };

    render(
      <ActiveFilters
        {...defaultProps}
        filters={[unknownFilter]}
      />
    );

    expect(screen.getByText('unknown: contains "test"')).toBeInTheDocument();
  });

  it("should handle edit dialog interactions", async () => {
    render(<ActiveFilters {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Close dialog
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should handle keyboard navigation", () => {
    render(<ActiveFilters {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });

    // Test that buttons are focusable and can receive focus
    editButtons.forEach((button, index) => {
      button.focus();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("tabIndex", "0");
    });

    // Test Enter key interaction on focused button
    editButtons[0].focus();
    fireEvent.keyDown(editButtons[0], { key: "Enter" });

    // Verify the button can handle keyboard events without errors
    expect(editButtons[0]).toBeInTheDocument();
  });

  it("should handle escape key to close edit dialog", async () => {
    render(<ActiveFilters {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
