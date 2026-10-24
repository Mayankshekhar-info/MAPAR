import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodSelector } from "./PeriodSelector";
import * as useReportingPeriodModule from "../../hooks/useReportingPeriod";
import { ReportingPeriod } from "../../types/period.types";

const mockPeriods: ReportingPeriod[] = [
  {
    id: 1,
    name: "February 2026",
    period_type: "MONTHLY",
    start_date: "2026-02-01",
    end_date: "2026-02-28",
    is_current: false,
    is_frozen: false,
  },
  {
    id: 2,
    name: "March 2026",
    period_type: "MONTHLY",
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    is_current: true,
    is_frozen: false,
  },
  {
    id: 3,
    name: "Q1 2026",
    period_type: "QUARTERLY",
    start_date: "2026-01-01",
    end_date: "2026-03-31",
    is_current: false,
    is_frozen: false,
  },
];

describe("PeriodSelector Component", () => {
  beforeEach(() => {
    vi.spyOn(useReportingPeriodModule, "useReportingPeriod").mockReturnValue({
      periods: mockPeriods,
      currentPeriod: mockPeriods[1],
      supportedFrequencies: ["MONTHLY", "WEEKLY", "QUARTERLY", "YEARLY", "DAILY", "CUSTOM"],
      isLoading: false,
      refetch: vi.fn(),
      resolvePeriod: vi.fn(),
      isResolving: false,
    });
  });

  it("renders trigger button with current period name and badge", () => {
    render(<PeriodSelector selectedPeriodId={2} />);

    expect(screen.getByText("March 2026")).toBeDefined();
    expect(screen.getByText("Current")).toBeDefined();
  });

  it("opens popover with frequency tabs and period options", () => {
    render(<PeriodSelector selectedPeriodId={2} />);

    const triggerBtn = screen.getByRole("button", { name: /March 2026/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByRole("tab", { name: "Monthly" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Weekly" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Quarterly" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Custom Range" })).toBeDefined();

    expect(screen.getByText("February 2026")).toBeDefined();
  });

  it("invokes onPeriodSelect and onRangeChange when period is chosen", () => {
    const handlePeriodSelect = vi.fn();
    const handleRangeChange = vi.fn();

    render(
      <PeriodSelector
        selectedPeriodId={2}
        onPeriodSelect={handlePeriodSelect}
        onRangeChange={handleRangeChange}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: /March 2026/i });
    fireEvent.click(triggerBtn);

    const febOption = screen.getByText("February 2026");
    fireEvent.click(febOption);

    expect(handlePeriodSelect).toHaveBeenCalledWith(mockPeriods[0]);
    expect(handleRangeChange).toHaveBeenCalledWith({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("supports cycle step navigation with prev/next buttons", () => {
    const handlePeriodSelect = vi.fn();

    render(
      <PeriodSelector
        selectedPeriodId={2}
        onPeriodSelect={handlePeriodSelect}
      />
    );

    const prevBtn = screen.getByTitle("Previous Period");
    fireEvent.click(prevBtn);

    expect(handlePeriodSelect).toHaveBeenCalledWith(mockPeriods[0]);
  });
});
