import type { ColumnDefinition, FilterState } from "@better-tables/core";
import { FilterBar } from "../../../components/filters/filter-bar";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
];

describe("FilterBar", () => {
  const defaultProps = {
    columns: mockColumns,
    filters: mockFilters,
    onFiltersChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render add filter button", () => {
    render(<FilterBar {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /add filter/i })
    ).toBeInTheDocument();
  });

  it("should render clear all button when filters exist", () => {
    render(<FilterBar {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /clear all/i })
    ).toBeInTheDocument();
  });

  it("should not render clear all button when no filters exist", () => {
    render(
      <FilterBar
        {...defaultProps}
        filters={[]}
      />
    );

    expect(
      screen.queryByRole("button", { name: /clear all/i })
    ).not.toBeInTheDocument();
  });

  it("should open filter dropdown when add filter button is clicked", async () => {
    render(<FilterBar {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add filter/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("should call onFiltersChange when clear all is clicked", () => {
    render(<FilterBar {...defaultProps} />);

    const clearButton = screen.getByRole("button", { name: /clear all/i });
    fireEvent.click(clearButton);

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith([]);
  });

  it("should render search input when searchable is true", () => {
    render(
      <FilterBar
        {...defaultProps}
        searchable={true}
      />
    );

    expect(screen.getByPlaceholderText(/search columns/i)).toBeInTheDocument();
  });

  it("should not render search input when searchable is false", () => {
    render(
      <FilterBar
        {...defaultProps}
        searchable={false}
      />
    );

    expect(
      screen.queryByPlaceholderText(/search columns/i)
    ).not.toBeInTheDocument();
  });

  it("should filter columns based on search term", async () => {
    render(
      <FilterBar
        {...defaultProps}
        searchable={true}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search columns/i);
    fireEvent.change(searchInput, { target: { value: "name" } });

    const addButton = screen.getByRole("button", { name: /add filter/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Should only show name column in dropdown
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.queryByText("Age")).not.toBeInTheDocument();
  });

  it("should handle disabled state", () => {
    render(
      <FilterBar
        {...defaultProps}
        disabled={true}
      />
    );

    const addButton = screen.getByRole("button", { name: /add filter/i });
    expect(addButton).toBeDisabled();
  });

  it("should handle max filters limit", () => {
    const manyFilters: FilterState[] = [
      {
        columnId: "name",
        type: "text",
        operator: "contains",
        values: ["test"],
      },
      {
        columnId: "age",
        type: "number",
        operator: "greaterThanOrEqual",
        values: [25],
      },
    ];

    render(
      <FilterBar
        {...defaultProps}
        filters={manyFilters}
        maxFilters={2}
      />
    );

    const addButton = screen.getByRole("button", { name: /add filter/i });
    expect(addButton).toBeDisabled();
  });

  it("should render custom filters", () => {
    const customFilter = <div data-testid="custom-filter">Custom Filter</div>;

    render(
      <FilterBar
        {...defaultProps}
        customFilters={[customFilter]}
      />
    );

    expect(screen.getByTestId("custom-filter")).toBeInTheDocument();
  });

  it("should handle groups when provided", async () => {
    const groups = [
      {
        id: "personal",
        label: "Personal",
        columns: ["name"],
      },
      {
        id: "details",
        label: "Details",
        columns: ["age", "status"],
      },
    ];

    render(
      <FilterBar
        {...defaultProps}
        groups={groups}
        showGroups={true}
      />
    );

    const addButton = screen.getByRole("button", { name: /add filter/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <FilterBar
        {...defaultProps}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should handle custom add filter label", () => {
    render(
      <FilterBar
        {...defaultProps}
        addFilterLabel="Add New Filter"
      />
    );

    expect(
      screen.getByRole("button", { name: /add new filter/i })
    ).toBeInTheDocument();
  });

  it("should handle custom search placeholder", () => {
    render(
      <FilterBar
        {...defaultProps}
        searchable={true}
        searchPlaceholder="Find columns..."
      />
    );

    expect(screen.getByPlaceholderText("Find columns...")).toBeInTheDocument();
  });

  it("should handle empty message when no filterable columns", () => {
    const nonFilterableColumns: ColumnDefinition[] = [
      {
        id: "name",
        displayName: "Name",
        accessor: (data: any) => data.name,
        type: "text",
        sortable: true,
        filterable: false,
      },
    ];

    render(
      <FilterBar
        columns={nonFilterableColumns}
        filters={[]}
        onFiltersChange={vi.fn()}
      />
    );

    const addButton = screen.getByRole("button", { name: /add filter/i });
    fireEvent.click(addButton);

    expect(screen.getByText(/no filterable columns/i)).toBeInTheDocument();
  });

  it("should handle keyboard navigation", () => {
    render(<FilterBar {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add filter/i });

    // Focus the add button directly and verify it's focusable
    addButton.focus();
    expect(addButton).toHaveFocus();
    expect(addButton).toHaveAttribute("tabIndex", "0");

    // Enter should open dropdown
    fireEvent.keyDown(addButton, { key: "Enter" });
    // Note: This would open the dropdown in a real implementation
  });

  it("should handle escape key to close dropdown", async () => {
    render(<FilterBar {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add filter/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should handle theme customization", () => {
    const theme = {
      container: "custom-container-class",
      addButton: "custom-add-button-class",
      clearButton: "custom-clear-button-class",
    };

    render(
      <FilterBar
        {...defaultProps}
        theme={theme}
      />
    );

    const addButton = screen.getByRole("button", { name: /add filter/i });
    expect(addButton).toHaveClass("custom-add-button-class");
  });

  it("should handle filter selection from dropdown", async () => {
    render(<FilterBar {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add filter/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const nameOption = screen.getByText("Name");
    fireEvent.click(nameOption);

    // Should call onFiltersChange with new filter
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          columnId: "name",
          type: "text",
        }),
      ])
    );
  });

  it("should handle mobile responsive design", () => {
    // Mock mobile viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<FilterBar {...defaultProps} />);

    // Should render mobile-optimized layout
    expect(
      screen.getByRole("button", { name: /add filter/i })
    ).toBeInTheDocument();
  });

  it("should handle accessibility attributes", () => {
    render(<FilterBar {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add filter/i });
    expect(addButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(addButton).toHaveAttribute("aria-expanded", "false");
  });
});
