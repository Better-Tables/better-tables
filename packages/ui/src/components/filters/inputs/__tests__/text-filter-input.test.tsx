import type { ColumnDefinition, FilterState } from "@better-tables/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextFilterInput } from "../text-filter-input";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockColumn: ColumnDefinition = {
  id: "name",
  displayName: "Name",
  accessor: (data: any) => data.name,
  type: "text",
  sortable: true,
  filterable: true,
};

const mockFilter: FilterState = {
  columnId: "name",
  type: "text",
  operator: "contains",
  values: ["John"],
};

describe("TextFilterInput", () => {
  const defaultProps = {
    filter: mockFilter,
    column: mockColumn,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render text input with current value", () => {
    render(<TextFilterInput {...defaultProps} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("John");
  });

  it("should call onChange when input value changes", async () => {
    render(<TextFilterInput {...defaultProps} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Jane" } });

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith(["Jane"]);
    });
  });

  it("should debounce input changes", async () => {
    vi.useFakeTimers();

    render(<TextFilterInput {...defaultProps} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "J" } });
    fireEvent.change(input, { target: { value: "Ja" } });
    fireEvent.change(input, { target: { value: "Jane" } });

    // Should not call onChange immediately
    expect(defaultProps.onChange).not.toHaveBeenCalled();

    // Fast forward time
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith(["Jane"]);
    });

    vi.useRealTimers();
  });

  it("should show placeholder based on operator", () => {
    const containsFilter: FilterState = {
      ...mockFilter,
      operator: "contains",
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={containsFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "Contains...");
  });

  it("should show different placeholder for different operators", () => {
    const startsWithFilter: FilterState = {
      ...mockFilter,
      operator: "startsWith",
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={startsWithFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "Starts with...");
  });

  it("should handle empty values", () => {
    const emptyFilter: FilterState = {
      ...mockFilter,
      values: [],
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={emptyFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("should handle null values", () => {
    const nullFilter: FilterState = {
      ...mockFilter,
      values: [null],
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={nullFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("should handle disabled state", () => {
    render(
      <TextFilterInput
        {...defaultProps}
        disabled={true}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should handle validation errors", async () => {
    const columnWithValidation: ColumnDefinition = {
      ...mockColumn,
      filter: {
        validation: (value: any) => {
          if (value && value.length < 3) {
            return "Value must be at least 3 characters";
          }
          return true;
        },
      },
    };

    render(
      <TextFilterInput
        {...defaultProps}
        column={columnWithValidation}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "ab" } });

    await waitFor(() => {
      expect(
        screen.getByText("Value must be at least 3 characters")
      ).toBeInTheDocument();
    });
  });

  it("should clear validation error when value becomes valid", async () => {
    const columnWithValidation: ColumnDefinition = {
      ...mockColumn,
      filter: {
        validation: (value: any) => {
          if (value && value.length < 3) {
            return "Value must be at least 3 characters";
          }
          return true;
        },
      },
    };

    render(
      <TextFilterInput
        {...defaultProps}
        column={columnWithValidation}
      />
    );

    const input = screen.getByRole("textbox");

    // Enter invalid value
    fireEvent.change(input, { target: { value: "ab" } });

    await waitFor(() => {
      expect(
        screen.getByText("Value must be at least 3 characters")
      ).toBeInTheDocument();
    });

    // Enter valid value
    fireEvent.change(input, { target: { value: "abc" } });

    await waitFor(() => {
      expect(
        screen.queryByText("Value must be at least 3 characters")
      ).not.toBeInTheDocument();
    });
  });

  it("should handle keyboard events", () => {
    render(<TextFilterInput {...defaultProps} />);

    const input = screen.getByRole("textbox");

    // Enter key should not prevent default
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveFocus();

    // Escape key should clear input
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("should handle focus and blur events", () => {
    render(<TextFilterInput {...defaultProps} />);

    const input = screen.getByRole("textbox");

    fireEvent.focus(input);
    expect(input).toHaveFocus();

    fireEvent.blur(input);
    expect(input).not.toHaveFocus();
  });

  it("should handle different text operators", () => {
    const operators = [
      "contains",
      "equals",
      "startsWith",
      "endsWith",
      "notContains",
    ];

    operators.forEach((operator) => {
      const filter: FilterState = {
        ...mockFilter,
        operator: operator as any,
      };

      const { unmount } = render(
        <TextFilterInput
          {...defaultProps}
          filter={filter}
        />
      );

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();

      unmount();
    });
  });

  it("should handle email column type", () => {
    const emailColumn: ColumnDefinition = {
      ...mockColumn,
      type: "email",
    };

    render(
      <TextFilterInput
        {...defaultProps}
        column={emailColumn}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "email");
  });

  it("should handle url column type", () => {
    const urlColumn: ColumnDefinition = {
      ...mockColumn,
      type: "url",
    };

    render(
      <TextFilterInput
        {...defaultProps}
        column={urlColumn}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "url");
  });

  it("should handle phone column type", () => {
    const phoneColumn: ColumnDefinition = {
      ...mockColumn,
      type: "phone",
    };

    render(
      <TextFilterInput
        {...defaultProps}
        column={phoneColumn}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "tel");
  });

  it("should handle accessibility attributes", () => {
    render(<TextFilterInput {...defaultProps} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-label", "Filter Name");
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("should handle multiple values for multi-value operators", () => {
    const multiValueFilter: FilterState = {
      ...mockFilter,
      operator: "isAnyOf",
      values: ["John", "Jane"],
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={multiValueFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("John, Jane");
  });

  it("should handle case sensitivity for case-sensitive operators", () => {
    const caseSensitiveFilter: FilterState = {
      ...mockFilter,
      operator: "equals",
      values: ["John"],
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={caseSensitiveFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("John");
  });

  it("should handle special characters in values", () => {
    const specialCharFilter: FilterState = {
      ...mockFilter,
      values: ["John & Jane"],
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={specialCharFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("John & Jane");
  });

  it("should handle very long values", () => {
    const longValue = "a".repeat(1000);
    const longValueFilter: FilterState = {
      ...mockFilter,
      values: [longValue],
    };

    render(
      <TextFilterInput
        {...defaultProps}
        filter={longValueFilter}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue(longValue);
  });
});
