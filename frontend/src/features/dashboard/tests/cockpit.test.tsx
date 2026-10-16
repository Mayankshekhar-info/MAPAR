import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MasterSummaryMatrix } from "../components/MasterSummaryMatrix";
import { DetailBreakdownTable } from "../components/DetailBreakdownTable";
import { ObservationActionPanel } from "../components/ObservationActionPanel";
import { MasterSummaryRow, DetailBreakdownResponse } from "../types/cockpit.types";

const mockSummaryRows: MasterSummaryRow[] = [
  {
    id: "c1_d1",
    circle_id: 1,
    circle_name: "Rajasthan",
    circle_code: "RJ",
    circle_region: "North",
    domain_id: 1,
    domain_name: "Asset Operations",
    domain_code: "ASSET_OPS",
    kpi_count: 2,
    target: 193.0,
    actual: 189.99,
    achievement_pct: 98.4,
    green_count: 0,
    amber_count: 2,
    red_count: 0,
    status: "AMBER",
    is_subtotal: false,
    is_grand_total: false,
  },
  {
    id: "subtotal_c1",
    circle_id: 1,
    circle_name: "Rajasthan",
    circle_code: "RJ",
    circle_region: "North",
    domain_id: null,
    domain_name: "Rajasthan Total",
    domain_code: "TOTAL",
    kpi_count: 2,
    target: 193.0,
    actual: 189.99,
    achievement_pct: 98.4,
    green_count: 0,
    amber_count: 2,
    red_count: 0,
    status: "AMBER",
    is_subtotal: true,
    is_grand_total: false,
  },
];

const mockDetailData: DetailBreakdownResponse = {
  context: {
    circle_id: 1,
    circle_name: "Rajasthan",
    circle_code: "RJ",
    domain_id: 1,
    domain_name: "Asset Operations",
    domain_code: "ASSET_OPS",
    period_id: 1,
    period_name: "Sep-26 MTD",
  },
  total_records: 2,
  records: [
    {
      id: 101,
      kpi_id: 11,
      kpi_code: "KPI011",
      kpi_name: "Asset Availability %",
      kpi_unit: "%",
      frequency: "MONTHLY",
      direction: "HIGHER_BETTER",
      target: 95.0,
      actual: 94.8,
      variance_pct: -0.21,
      achievement_pct: 99.8,
      rag_status: "AMBER",
      trend: "UP",
      notes: "Power meter maintenance scheduled",
      domain_name: "Asset Operations",
      circle_name: "Rajasthan",
    },
  ],
  observations: [
    {
      id: 1,
      code: "ISS-2026-001",
      title: "Power Meter Shortage in Circle",
      description: "Shortage of 171 meters",
      severity: "CRITICAL",
      status: "IN_PROGRESS",
      rag_status: "RED",
      root_cause: "Vendor supply delay",
      corrective_action: "Expedited purchase order",
      owner: "Anil Gupta",
      target_date: "2026-10-15",
      is_repeat: false,
    },
  ],
  actions: [
    {
      id: 1,
      code: "ACT-2026-001",
      owner: "Anil Gupta",
      priority: "CRITICAL",
      status: "IN_PROGRESS",
      progress_pct: 65,
      target_date: "2026-10-10",
      latest_update: "PO approved and dispatched",
      rag: "GREEN",
      ageing_days: 12,
      overdue_days: 0,
    },
  ],
};

describe("MasterSummaryMatrix Component", () => {
  it("renders grouped table headers properly", () => {
    render(
      <MasterSummaryMatrix
        rows={mockSummaryRows}
        totalRecords={2}
        selectedRowId={null}
        isLoading={false}
        onSelectRow={vi.fn()}
      />
    );

    expect(screen.getByText("ORGANIZATIONAL UNIT")).toBeDefined();
    expect(screen.getByText("PERFORMANCE METRICS")).toBeDefined();
    expect(screen.getByText("CIRCLE")).toBeDefined();
    expect(screen.getByText("DEPARTMENT / DOMAIN")).toBeDefined();
    expect(screen.getByText("TARGET")).toBeDefined();
    expect(screen.getByText("ACTUAL")).toBeDefined();
    expect(screen.getByText("ACH %")).toBeDefined();
  }, 15000);

  it("renders row data with formatted values and handles row clicks", () => {
    const handleSelect = vi.fn();
    render(
      <MasterSummaryMatrix
        rows={mockSummaryRows}
        totalRecords={2}
        selectedRowId="c1_d1"
        isLoading={false}
        onSelectRow={handleSelect}
      />
    );

    expect(screen.getByText("Asset Operations")).toBeDefined();
    expect(screen.getByText("Rajasthan Total")).toBeDefined();

    const row = screen.getByText("Asset Operations");
    fireEvent.click(row);
    expect(handleSelect).toHaveBeenCalledWith(mockSummaryRows[0]);
  });
});

describe("DetailBreakdownTable Component", () => {
  it("renders selected context and KPI record data", () => {
    const handleSelectRecord = vi.fn();
    render(
      <DetailBreakdownTable
        detailData={mockDetailData}
        isLoading={false}
        onSelectRecord={handleSelectRecord}
      />
    );

    expect(screen.getByText("DETAIL BREAKDOWN")).toBeDefined();
    expect(screen.getByText(/Scope: Rajasthan → Asset Operations/)).toBeDefined();
    expect(screen.getByText("Asset Availability %")).toBeDefined();
    expect(screen.getByText("KPI011")).toBeDefined();

    fireEvent.click(screen.getByText("Asset Availability %"));
    expect(handleSelectRecord).toHaveBeenCalledWith(101);
  });
});

describe("ObservationActionPanel Component", () => {
  it("renders observations and actions with root cause and owners", () => {
    render(
      <ObservationActionPanel
        observations={mockDetailData.observations}
        actions={mockDetailData.actions}
      />
    );

    expect(screen.getByText("KEY OBSERVATION & ROOT CAUSE")).toBeDefined();
    expect(screen.getByText(/Power Meter Shortage in Circle/)).toBeDefined();
    expect(screen.getByText(/Vendor supply delay/)).toBeDefined();

    expect(screen.getByText("ACTION TAKEN & REMEDIATION")).toBeDefined();
    expect(screen.getByText(/ACT-2026-001 — Anil Gupta/)).toBeDefined();
    expect(screen.getByText(/PO approved and dispatched/)).toBeDefined();
  });
});
