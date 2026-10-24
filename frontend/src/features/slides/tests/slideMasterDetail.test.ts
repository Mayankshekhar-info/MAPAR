import { describe, it, expect } from "vitest";
import { SlideMasterRowData, SlideDetailData } from "../types/slide.types";

describe("Slide View Master Table & Detail Contracts", () => {
  const mockMasterDataRow: SlideMasterRowData = {
    id: 42,
    row_type: "data",
    circle_id: 1,
    circle_name: "Haryana",
    circle_code: "HR",
    region: "North",
    domain_id: 2,
    domain_name: "Asset Operations",
    domain_code: "ASSET_OPS",
    resource_code: "ASSET-01",
    resource_name: "Fiber Splicer Utilization",
    required: 100.0,
    available: 92.0,
    gap: 8.0,
    achievement_percentage: 92.0,
    rag_status: "AMBER",
    trend: "UP",
    unit: "%",
    is_clickable: true,
  };

  const mockSubtotalRow: SlideMasterRowData = {
    id: "subtotal-1",
    row_type: "subtotal",
    circle_id: 1,
    circle_name: "Total Haryana",
    circle_code: "HR",
    region: "North",
    resource_name: "Subtotal (Haryana)",
    required: 200.0,
    available: 185.0,
    gap: 15.0,
    achievement_percentage: 92.5,
    rag_status: "AMBER",
    record_count: 2,
    green_count: 1,
    amber_count: 1,
    red_count: 0,
    is_clickable: false,
  };

  const mockGrandTotalRow: SlideMasterRowData = {
    id: "grand-total",
    row_type: "grand_total",
    circle_name: "GRAND TOTAL OPERATIONAL RESOURCES",
    resource_name: "Grand Total",
    required: 1500.0,
    available: 1420.0,
    gap: 80.0,
    achievement_percentage: 94.7,
    rag_status: "AMBER",
    record_count: 18,
    green_count: 12,
    amber_count: 4,
    red_count: 2,
    is_clickable: false,
  };

  it("verifies master table data row attributes and clickability", () => {
    expect(mockMasterDataRow.is_clickable).toBe(true);
    expect(typeof mockMasterDataRow.id).toBe("number");
    expect(mockMasterDataRow.required - mockMasterDataRow.available).toBe(mockMasterDataRow.gap);
    expect(mockMasterDataRow.circle_name).toBe("Haryana");
    expect(mockMasterDataRow.resource_code).toBe("ASSET-01");
  });

  it("verifies subtotal row aggregation and non-clickability", () => {
    expect(mockSubtotalRow.row_type).toBe("subtotal");
    expect(mockSubtotalRow.is_clickable).toBe(false);
    expect(mockSubtotalRow.record_count).toBe(2);
    expect(mockSubtotalRow.gap).toBe(15.0);
  });

  it("verifies grand total row contract", () => {
    expect(mockGrandTotalRow.row_type).toBe("grand_total");
    expect(mockGrandTotalRow.is_clickable).toBe(false);
    expect(mockGrandTotalRow.record_count).toBe(18);
  });

  it("verifies deep detail payload structure", () => {
    const mockDetail: Partial<SlideDetailData> = {
      record_id: 42,
      resource: {
        id: 1,
        code: "ASSET-01",
        name: "Fiber Splicer Utilization",
        definition: "Utilization rate of fiber splicers",
        calculation_formula: "Available / Required * 100",
        unit: "%",
        direction: "HIGHER_BETTER",
        frequency: "MONTHLY",
        priority: "HIGH",
        default_owner: "Lead Engineer",
        is_executive: true,
      },
      hierarchy: {
        main_company: "Telecrats",
        main_company_code: "TC",
        sub_company: "Telecrats Infra",
        project: "Optics Expansion",
        project_code: "OPT-EXP",
        circle: "Haryana",
        circle_code: "HR",
        region: "North",
        circle_head: "Amit Verma",
        domain: "Asset Operations",
        domain_code: "ASSET_OPS",
      },
      metrics: {
        required: 100.0,
        available: 92.0,
        gap: 8.0,
        achievement_percentage: 92.0,
        rag_status: "AMBER",
        trend: "UP",
        variance: -8.0,
        variance_percentage: -8.0,
        unit: "%",
        direction: "HIGHER_BETTER",
        notes: "Operational notes",
      },
      source: {
        period_id: 1,
        period_name: "2026-09",
        is_frozen: false,
        is_current: true,
        start_date: "2026-09-01",
        end_date: "2026-09-30",
        created_at: "2026-09-15T00:00:00Z",
        updated_at: "2026-09-20T00:00:00Z",
        entered_by: {
          id: 1,
          name: "Admin User",
          email: "admin@telecrats.in",
        },
      },
      audit_history: [],
      issues: [],
      actions: [],
      related_records: [],
    };

    expect(mockDetail.record_id).toBe(42);
    expect(mockDetail.hierarchy?.circle).toBe("Haryana");
    expect(mockDetail.resource?.code).toBe("ASSET-01");
    expect(mockDetail.metrics?.gap).toBe(8.0);
    expect(mockDetail.source?.period_name).toBe("2026-09");
  });
});
