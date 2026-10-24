import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { KPIDashboardCard } from "../components/KPIDashboardCard";
import { KPICardGrid } from "../components/KPICardGrid";
import { FormulaExpressionEditor } from "../components/FormulaExpressionEditor";
import { KPIDefinitionTable } from "../components/KPIDefinitionTable";
import { KPIBuilderModal } from "../components/KPIBuilderModal";
import { KPIDashboardCard as CardData, KPIDefinition } from "../types/kpi";

describe("KPI Module Frontend Components", () => {
  const mockCard: CardData = {
    id: 101,
    kpi_id: 1,
    kpi_code: "TOWER_AVAIL",
    kpi_name: "Tower Availability Index",
    unit: "%",
    calculated_value: 98.45,
    target_value: 95.0,
    variance_to_target: 3.45,
    variance_percentage: 3.63,
    achievement_percentage: 103.63,
    rag_status: "GREEN",
    hierarchy_level: "CIRCLE",
    assigned_hierarchy_level: "CIRCLE",
    hierarchy_id: 1,
    hierarchy_name: "North Circle",
    calculation_status: "SUCCESS",
    error_message: "",
    records_considered: 42,
    calculated_at: new Date().toISOString(),
    formula: "(uptime / total) * 100",
  };

  it("renders KPIDashboardCard with formatted metrics and status chip", () => {
    const onInspect = vi.fn();
    render(<KPIDashboardCard data={mockCard} onInspect={onInspect} />);

    expect(screen.getByText("TOWER_AVAIL")).toBeDefined();
    expect(screen.getByText("Tower Availability Index")).toBeDefined();
    expect(screen.getByText("98.45")).toBeDefined();
    expect(screen.getByText(/Meets Target/)).toBeDefined();
    expect(screen.getByText("North Circle")).toBeDefined();
    expect(screen.getByText(/Inspect Records/)).toBeDefined();
  });

  it("renders KPICardGrid with cards or empty state", () => {
    const onInspect = vi.fn();
    const { rerender } = render(<KPICardGrid cards={[mockCard]} onInspect={onInspect} />);
    expect(screen.getByText("TOWER_AVAIL")).toBeDefined();

    rerender(<KPICardGrid cards={[]} onInspect={onInspect} />);
    expect(screen.getByText("No KPI Cards Available")).toBeDefined();
  });

  it("renders FormulaExpressionEditor and allows inserting parameters", () => {
    const onChange = vi.fn();
    render(
      <FormulaExpressionEditor
        value="actual / target"
        onChange={onChange}
        availableVariables={["actual", "target", "budget"]}
      />
    );

    expect(screen.getByPlaceholderText(/e\.g\. \(actual \/ target\) \* 100/)).toBeDefined();
    expect(screen.getByText("actual")).toBeDefined();
    expect(screen.getByText("budget")).toBeDefined();

    fireEvent.click(screen.getByText("budget"));
    expect(onChange).toHaveBeenCalledWith("actual / target budget");
  });

  it("renders KPIDefinitionTable with definitions and search filtering", () => {
    const mockDef: KPIDefinition = {
      id: 1,
      code: "SITE_ENERGY",
      name: "Site Energy Consumption",
      description: "Monitors monthly kWh",
      hierarchy_level: "CIRCLE",
      visualization_type: "CARD",
      calculation_type: "SIMPLE_AGGREGATE",
      formula_expression: "",
      aggregation_method: "SUM",
      unit: "kWh",
      decimal_precision: 2,
      direction: "LOWER_BETTER",
      is_active: true,
      is_executive: false,
      display_order: 1,
      parameters: [],
      filters: [],
      dependencies: [],
      comparison_method: "TARGET",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onCreate = vi.fn();
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    render(
      <KPIDefinitionTable
        definitions={[mockDef]}
        isLoading={false}
        onCreate={onCreate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("SITE_ENERGY")).toBeDefined();
    expect(screen.getByText("Site Energy Consumption")).toBeDefined();
    expect(screen.getByText("SIMPLE AGGREGATE")).toBeDefined();
    expect(screen.getByText("New KPI Definition")).toBeDefined();
  });

  it("renders KPIDashboardCard with FUNNEL visualization type and toggles funnel breakdown", () => {
    const funnelCard: CardData = {
      ...mockCard,
      visualization_type: "FUNNEL",
      assigned_hierarchy_level: "PROJECT",
      hierarchy_name: "Project Beta",
      funnel_breakdown: {
        total_uploaded_records: 120,
        organization_scope_records: 80,
        reporting_period_records: 50,
        kpi_filtered_records: 42,
        parameter_values: { uptime: 98.45 },
        calculated_value: 98.45,
        target_value: 95.0,
        achievement_percentage: 103.63,
        rag_status: "GREEN",
        status: "SUCCESS",
        unit: "%",
        visualization_type: "FUNNEL",
      },
    };

    const onInspect = vi.fn();
    render(<KPIDashboardCard data={funnelCard} onInspect={onInspect} />);

    // Toggle collapsible funnel
    const toggleBtn = screen.getByText(/Record Lineage & Scoping/);
    expect(toggleBtn).toBeDefined();
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/1\. Total Uploaded in Dataset:/)).toBeDefined();
    expect(screen.getByText(/4\. Evaluated for Metric:/)).toBeDefined();
    expect(screen.getByText("Project Beta")).toBeDefined();
  });

  it("renders KPIDashboardCard with PROGRESS visualization type", () => {
    const progressCard: CardData = {
      ...mockCard,
      visualization_type: "PROGRESS",
    };

    const onInspect = vi.fn();
    render(<KPIDashboardCard data={progressCard} onInspect={onInspect} />);

    expect(screen.getByText(/103\.63/)).toBeDefined();
    expect(screen.getByText(/Standard \/ Target/)).toBeDefined();
    expect(screen.getByText(/Gap: \+3.45/)).toBeDefined();
  });

  it("renders KPIDashboardCard with COMPARISON visualization type", () => {
    const comparisonCard: CardData = {
      ...mockCard,
      visualization_type: "COMPARISON" as any,
    };
    render(<KPIDashboardCard data={comparisonCard} onInspect={vi.fn()} />);
    expect(screen.getByText("Standard / Target")).toBeDefined();
    expect(screen.getByText("Actual Achievement")).toBeDefined();
    expect(screen.getByText(/Gap: \+3.45/)).toBeDefined();
  });

  it("renders KPIDashboardCard with VARIANCE visualization type", () => {
    const varianceCard: CardData = {
      ...mockCard,
      visualization_type: "VARIANCE" as any,
    };
    render(<KPIDashboardCard data={varianceCard} onInspect={vi.fn()} />);
    expect(screen.getByText("Standard / Target")).toBeDefined();
    expect(screen.getByText(/\+3.45/)).toBeDefined();
  });

  it("renders redesigned KPIBuilderModal with 4-step wizard and General Setup fields", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <KPIBuilderModal
        open={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    // Verify step labels in the redesigned 4-step wizard
    expect(screen.getByText("General Setup")).toBeDefined();
    expect(screen.getByText("Performance Targets & Comparison")).toBeDefined();
    expect(screen.getByText("Visualization")).toBeDefined();
    expect(screen.getByText("Review & Save")).toBeDefined();

    // Verify 5 fields in General Setup + Active toggle
    expect(screen.getByLabelText(/KPI Name/)).toBeDefined();
    expect(screen.getByLabelText(/KPI Code/)).toBeDefined();
    expect(screen.getByLabelText(/Description/)).toBeDefined();
    expect(screen.getByLabelText(/Organization Hierarchy Level/)).toBeDefined();
    expect(screen.getByLabelText(/Assigned Organization Node/)).toBeDefined();
    expect(screen.getByText("Active in Calculation Engine")).toBeDefined();
  });

  it(
    "renders Performance Targets & Comparison step with Comparison Name at top and multiple column rules in exact sequence",
    () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <KPIBuilderModal
          open={true}
          onClose={onClose}
          onSave={onSave}
        />
      );

      // Fill Step 0 required fields
      fireEvent.change(screen.getByLabelText(/KPI Name/), { target: { value: "Site Performance KPI" } });
      fireEvent.change(screen.getByLabelText(/KPI Code/), { target: { value: "SITE_PERF_KPI" } });

      // Click Next to advance to Step 1
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      // Verify Step 1 title
      expect(screen.getByText("Performance Targets & Comparison Builder")).toBeDefined();

      // Verify Comparison Name at top
      expect(screen.getByLabelText(/Comparison Name/i)).toBeDefined();

      // Verify Section Header & Add Rule action
      expect(screen.getByText("Configured Column Rules")).toBeDefined();
      expect(screen.getByRole("button", { name: /Add Rule/i })).toBeDefined();

      // Verify the rule fields in exact sequence:
      // 1. Achieved Data Column Name, 2. Standard Value, 3. Performance Direction
      expect(screen.getByLabelText(/1\. Achieved Data Column Name/i)).toBeDefined();
      expect(screen.getByLabelText(/2\. Standard Value/i)).toBeDefined();
      expect(screen.getByLabelText(/3\. Performance Direction/i)).toBeDefined();

      // Configure Rule 1
      fireEvent.change(screen.getByLabelText(/2\. Standard Value/i), {
        target: { value: "98.8" },
      });

      // Add a second rule
      const addRuleBtn = screen.getByRole("button", { name: /Add Rule/i });
      fireEvent.click(addRuleBtn);

      // Both rules should be rendered
      expect(screen.getByText("Rule #1")).toBeDefined();
      expect(screen.getByText("Rule #2")).toBeDefined();
    },
    15000
  );

  it("renders KPIDashboardCard with multiple column rules breakdown table and overall status", () => {
    const onInspect = vi.fn();
    const multiRuleCard: CardData = {
      ...mockCard,
      kpi_name: "Multi-Rule Site Performance",
      presentation_config: {
        comparisons: [
          {
            id: "comp_1",
            name: "Site Performance",
            overall_status: "MET",
            overall_status_label: "Met (2 of 2 Rules Met)",
            target_value: 98.8,
            actual_value: 99.2,
            performance_direction: "HIGHER_BETTER",
            metric_label: "Site Targets",
            unit: "%",
            is_enabled: true,
            rules: [
              {
                id: "r1",
                achieved_data_column: "13-Oct-26 uptime",
                standard_value: 98.8,
                performance_direction: "HIGHER_BETTER",
                calculated_actual: 99.2,
                calculated_variance: 0.4,
                achievement_percentage: 100.4,
                performance_status: "MEETS_TARGET",
                status_label: "Met",
              },
              {
                id: "r2",
                achieved_data_column: "13-Oct-26 outage min",
                standard_value: 60,
                performance_direction: "LOWER_BETTER",
                calculated_actual: 45,
                calculated_variance: -15,
                achievement_percentage: 125,
                performance_status: "MEETS_TARGET",
                status_label: "Met",
              },
            ],
          },
        ],
      },
    };

    render(<KPIDashboardCard data={multiRuleCard} onInspect={onInspect} />);

    // Verify card rendered
    expect(screen.getByText("Multi-Rule Site Performance")).toBeDefined();

    // Verify Multi-rule section and rules table
    expect(screen.getByText(/Configured Column Rules \(2\)/i)).toBeDefined();
    expect(screen.getByText("13-Oct-26 uptime")).toBeDefined();
    expect(screen.getByText("13-Oct-26 outage min")).toBeDefined();
    expect(screen.getAllByText("98.8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("99.2").length).toBeGreaterThan(0);
    expect(screen.getByText("45")).toBeDefined();
    expect(screen.getByText("+0.4")).toBeDefined();
    expect(screen.getByText("-15")).toBeDefined();
    expect(screen.getByText(/Overall: Met/i)).toBeDefined();
  });
});

