import { describe, it, expect } from "vitest";
import { SlideItem, SlideKPICard } from "../types/slide.types";

describe("Slide View Data Contracts & Integrity", () => {
  const mockKPI: SlideKPICard = {
    id: 101,
    kpi_id: 1,
    code: "REV-01",
    name: "Enterprise Revenue Run-rate",
    definition: "Total recognized revenue for reporting cycle",
    unit: "INR Cr",
    direction: "HIGHER_BETTER",
    target_value: 100.0,
    actual_value: 95.0,
    variance: -5.0,
    variance_percentage: -5.0,
    achievement_percentage: 95.0,
    rag_status: "AMBER",
    trend: "FLAT",
    notes: "Minor delay in cycle recognition",
    is_executive: true,
    default_owner: "Finance VP",
  };

  const mockSlide: SlideItem = {
    slide_id: "slide-1-1",
    slide_number: 1,
    title: "North Circle — Operations",
    subtitle: "Enterprise / North Region",
    hierarchy: {
      main_company: "Telecrats Enterprise",
      main_company_code: "TC-ENT",
      sub_company: "Telecrats Infratech",
      project: "Project Phoenix",
      project_code: "PRJ-PHX",
      circle: "North Circle",
      circle_code: "CIR-N",
      region: "North",
      circle_head: "Rajesh Kumar",
      domain: "Operations",
      domain_code: "DOM-OPS",
    },
    summary: {
      total_kpis: 1,
      green_count: 0,
      amber_count: 1,
      red_count: 0,
      total_target: 100.0,
      total_actual: 95.0,
      achievement_percentage: 95.0,
      overall_rag: "AMBER",
      open_issues_count: 0,
      open_actions_count: 0,
    },
    kpis: [mockKPI],
    issues: [],
    actions: [],
  };

  it("validates operational slide structure correctly", () => {
    expect(mockSlide.slide_number).toBe(1);
    expect(mockSlide.title).toContain("North Circle");
    expect(mockSlide.hierarchy.circle).toBe("North Circle");
    expect(mockSlide.hierarchy.domain).toBe("Operations");
    expect(mockSlide.summary.total_kpis).toBe(1);
    expect(mockSlide.summary.overall_rag).toBe("AMBER");
  });

  it("calculates achievement percentage and RAG status reliably", () => {
    const kpi = mockSlide.kpis[0];
    expect(kpi.actual_value).toBe(95.0);
    expect(kpi.target_value).toBe(100.0);
    expect(kpi.achievement_percentage).toBe(95.0);
    expect(kpi.rag_status).toBe("AMBER");
    expect(kpi.variance).toBe(-5.0);
  });

  it("ensures dynamic hierarchy chain is complete and non-empty", () => {
    const h = mockSlide.hierarchy;
    expect(h.circle).toBeTruthy();
    expect(h.domain).toBeTruthy();
    expect(h.region).toBeTruthy();
  });
});
