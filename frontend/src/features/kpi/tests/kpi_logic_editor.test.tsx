import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KPILogicEditor } from "../components/KPILogicEditor";
import { DatasetField } from "../types/kpi";
import { kpiService } from "../api/kpiService";

vi.mock("../api/kpiService", () => ({
  kpiService: {
    testLogic: vi.fn(),
  },
}));

describe("KPILogicEditor Component", () => {
  const mockFields: DatasetField[] = [
    { id: 1, name: "Circle", display_label: "Circle Code", data_type: "TEXT", is_required: true, column_order: 1 },
    { id: 2, name: "Department", display_label: "Department", data_type: "TEXT", is_required: true, column_order: 2 },
    { id: 3, name: "Sites_Up", display_label: "Sites Up", data_type: "DECIMAL", is_required: true, column_order: 3 },
    { id: 4, name: "Total_Sites", display_label: "Total Sites", data_type: "DECIMAL", is_required: true, column_order: 4 },
    { id: 5, name: "Amount", display_label: "Revenue Amount", data_type: "DECIMAL", is_required: false, column_order: 5 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders natural language mode by default with tabs and schema chips", () => {
    const onChangeLogic = vi.fn();
    render(
      <KPILogicEditor
        datasetId={10}
        datasetName="Telecom Site Dataset"
        fields={mockFields}
        naturalLanguageRule="From the selected uploaded dataset, consider only records where Department is Operations."
        onChangeNaturalLanguageRule={vi.fn()}
        logicExpression='FILTER records WHERE [Department] = "Operations" CALCULATE SUM([Amount])'
        onChangeLogicExpression={onChangeLogic}
        filters={[]}
        onChangeFilters={vi.fn()}
        parameters={[]}
        onChangeParameters={vi.fn()}
        formulaExpression="SUM([Amount])"
        onChangeFormulaExpression={vi.fn()}
        calculationType="FORMULA"
        onChangeCalculationType={vi.fn()}
      />
    );

    expect(screen.getByText("Plain English Business Rule")).toBeDefined();
    expect(screen.getByText("Visual Rule Builder")).toBeDefined();
    expect(screen.getByText("Expression Code")).toBeDefined();
    expect(screen.getByText("Test Logic on Real Uploaded Records")).toBeDefined();
    expect(screen.getByText("Write Business Rules in Plain English:")).toBeDefined();
    expect(screen.getByText("Circle")).toBeDefined();
    expect(screen.getByText("Department")).toBeDefined();
  });

  it("inserts bracketed field into logic expression when field chip is clicked in expression mode", () => {
    const onChangeLogic = vi.fn();
    render(
      <KPILogicEditor
        datasetId={10}
        fields={mockFields}
        logicExpression="FILTER records WHERE"
        onChangeLogicExpression={onChangeLogic}
        filters={[]}
        onChangeFilters={vi.fn()}
        parameters={[]}
        onChangeParameters={vi.fn()}
        formulaExpression=""
        onChangeFormulaExpression={vi.fn()}
        calculationType="FORMULA"
        onChangeCalculationType={vi.fn()}
      />
    );

    // Switch to Expression Code tab
    fireEvent.click(screen.getByText("Expression Code"));
    fireEvent.click(screen.getByText("Department"));
    expect(onChangeLogic).toHaveBeenCalledWith("FILTER records WHERE [Department]");
  });

  it("switches to Visual Rule Builder tab and allows adding conditions", () => {
    const onChangeFilters = vi.fn();
    const onChangeLogic = vi.fn();

    render(
      <KPILogicEditor
        datasetId={10}
        fields={mockFields}
        logicExpression=""
        onChangeLogicExpression={onChangeLogic}
        filters={[]}
        onChangeFilters={onChangeFilters}
        parameters={[]}
        onChangeParameters={vi.fn()}
        formulaExpression=""
        onChangeFormulaExpression={vi.fn()}
        calculationType="FORMULA"
        onChangeCalculationType={vi.fn()}
      />
    );

    // Switch to Visual tab
    fireEvent.click(screen.getByText("Visual Rule Builder"));
    expect(screen.getByText("Row-Level Filter Conditions:")).toBeDefined();

    // Add Condition
    fireEvent.click(screen.getByText("Add Condition"));
    expect(onChangeFilters).toHaveBeenCalledWith([
      {
        field_name: "Circle",
        operator: "EQUALS",
        value: "",
        conjunction: undefined,
      },
    ]);
  });

  it("runs ad-hoc test on real data and displays calculated value & preview table", async () => {
    const mockTestResponse = {
      success: true,
      is_valid: true,
      status: "SUCCESS" as const,
      error: null,
      message: null,
      records_considered: 15,
      calculated_value: 95.5,
      unit: "%",
      columns: ["Circle", "Department", "Sites_Up"],
      refined_records_preview: [
        { Circle: "DL", Department: "Operations", Sites_Up: 95 },
        { Circle: "MUM", Department: "Operations", Sites_Up: 96 },
      ],
      parsed_filters: [],
      parsed_parameters: [],
      rewritten_formula: "p_sites_up_sum",
      node_name: "Delhi Circle",
      period_name: "Oct 2026",
      dataset_name: "Telecom Site Dataset",
    };

    (kpiService.testLogic as any).mockResolvedValueOnce(mockTestResponse);

    render(
      <KPILogicEditor
        datasetId={10}
        datasetName="Telecom Site Dataset"
        fields={mockFields}
        logicExpression="FILTER records WHERE [Department] = 'Operations' CALCULATE SUM([Sites_Up])"
        onChangeLogicExpression={vi.fn()}
        filters={[]}
        onChangeFilters={vi.fn()}
        parameters={[]}
        onChangeParameters={vi.fn()}
        formulaExpression=""
        onChangeFormulaExpression={vi.fn()}
        calculationType="FORMULA"
        onChangeCalculationType={vi.fn()}
        unit="%"
      />
    );

    const testBtn = screen.getByText("Test Logic on Real Uploaded Records");
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(kpiService.testLogic).toHaveBeenCalled();
      expect(screen.getByText("Logic Successfully Verified on Actual Uploaded Data")).toBeDefined();
      expect(screen.getByText("Matching Records: 15")).toBeDefined();
      expect(screen.getByText("Calculated Value: 95.5 %")).toBeDefined();
      expect(screen.getByText("DL")).toBeDefined();
      expect(screen.getByText("MUM")).toBeDefined();
    });
  });

  it("displays actionable error message when test fails", async () => {
    const mockErrorResponse = {
      success: false,
      is_valid: false,
      status: "ERROR" as const,
      error: "Field '[UnknownColumn]' does not exist in the selected dataset schema.",
      message: "Field '[UnknownColumn]' does not exist in the selected dataset schema.",
      records_considered: 0,
      calculated_value: null,
      unit: "%",
      columns: [],
      refined_records_preview: [],
      parsed_filters: [],
      parsed_parameters: [],
      rewritten_formula: "",
      node_name: "",
      period_name: "",
      dataset_name: "Telecom Site Dataset",
    };

    (kpiService.testLogic as any).mockResolvedValueOnce(mockErrorResponse);

    render(
      <KPILogicEditor
        datasetId={10}
        fields={mockFields}
        logicExpression="FILTER records WHERE [UnknownColumn] = 'Test' CALCULATE COUNT()"
        onChangeLogicExpression={vi.fn()}
        filters={[]}
        onChangeFilters={vi.fn()}
        parameters={[]}
        onChangeParameters={vi.fn()}
        formulaExpression=""
        onChangeFormulaExpression={vi.fn()}
        calculationType="FORMULA"
        onChangeCalculationType={vi.fn()}
      />
    );

    const testBtn = screen.getByText("Test Logic on Real Uploaded Records");
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText("Logic Execution Error:")).toBeDefined();
      expect(screen.getByText(/Field '\[UnknownColumn\]' does not exist/)).toBeDefined();
    });
  });
});
