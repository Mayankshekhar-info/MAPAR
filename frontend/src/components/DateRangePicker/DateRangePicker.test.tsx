import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangePicker } from "./DateRangePicker";

describe("DateRangePicker Component", () => {
  it("renders trigger button with default label", () => {
    render(<DateRangePicker label="Select Custom Range" />);
    expect(screen.getByText("Select Custom Range")).toBeDefined();
  });

  it("renders formatted date range when startDate and endDate are provided", () => {
    render(
      <DateRangePicker
        startDate="2026-03-01"
        endDate="2026-03-31"
        label="Date Range"
      />
    );
    expect(screen.getByText("01 Mar 2026 – 31 Mar 2026")).toBeDefined();
  });

  it("opens popover with presets and calendar when clicked", () => {
    render(<DateRangePicker label="Pick Dates" />);
    const button = screen.getByRole("button", { name: /Pick Dates/i });
    fireEvent.click(button);

    // Should display presets and calendar
    expect(screen.getByText("QUICK PRESETS")).toBeDefined();
    expect(screen.getByText("This Month")).toBeDefined();
    expect(screen.getByText("Last 7 Days")).toBeDefined();
    expect(screen.getByText("Apply")).toBeDefined();
    expect(screen.getByText("Clear")).toBeDefined();
  });

  it("triggers onChange when a preset is clicked", () => {
    const handleChange = vi.fn();
    render(<DateRangePicker onChange={handleChange} label="Pick Dates" />);

    const button = screen.getByRole("button", { name: /Pick Dates/i });
    fireEvent.click(button);

    const thisMonthPreset = screen.getByRole("button", { name: "This Month" });
    fireEvent.click(thisMonthPreset);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const callArg = handleChange.mock.calls[0][0];
    expect(callArg.startDate).toBeDefined();
    expect(callArg.endDate).toBeDefined();
  });

  it("renders inline and triggers onChange on date click with autoApply", () => {
    const handleChange = vi.fn();
    render(
      <DateRangePicker
        inline
        autoApply
        onChange={handleChange}
        startDate="2026-03-01"
        endDate="2026-03-31"
      />
    );
    expect(screen.getByText("QUICK PRESETS")).toBeDefined();

    const day15 = screen.getByText("15");
    fireEvent.click(day15);

    expect(handleChange).toHaveBeenCalled();
  });
});

