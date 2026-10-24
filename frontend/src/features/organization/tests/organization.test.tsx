import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { HIERARCHY_CONFIG, getNextChildLevel, getAddChildButtonLabel } from "../utils/hierarchy";
import { OrganizationSummary } from "../components/OrganizationSummary";
import { OrganizationTree } from "../components/OrganizationTree";
import { OrganizationDetails } from "../components/OrganizationDetails";
import { HierarchyNode } from "../types/organization.types";

describe("Organization Hierarchy Rules Engine", () => {
  it("enforces correct parent-child relationship sequence", () => {
    expect(getNextChildLevel("MAIN_COMPANY")).toBe("SUB_COMPANY");
    expect(getNextChildLevel("SUB_COMPANY")).toBe("PROJECT");
    expect(getNextChildLevel("PROJECT")).toBe("CIRCLE");
    expect(getNextChildLevel("CIRCLE")).toBe("DOMAIN");
    expect(getNextChildLevel("DOMAIN")).toBe("DEPARTMENT");
    expect(getNextChildLevel("DEPARTMENT")).toBe("SUB_DEPARTMENT");
    expect(getNextChildLevel("SUB_DEPARTMENT")).toBe("USER");
    expect(getNextChildLevel("USER")).toBeNull();
  });

  it("generates correct dynamic button labels based on hierarchy rules", () => {
    expect(getAddChildButtonLabel("MAIN_COMPANY")).toBe("+ Add Sub Company");
    expect(getAddChildButtonLabel("SUB_COMPANY")).toBe("+ Add Project");
    expect(getAddChildButtonLabel("PROJECT")).toBe("+ Add Circle");
    expect(getAddChildButtonLabel("CIRCLE")).toBe("+ Add Domain");
    expect(getAddChildButtonLabel("DOMAIN")).toBe("+ Add Department");
    expect(getAddChildButtonLabel("DEPARTMENT")).toBe("+ Add Team");
    expect(getAddChildButtonLabel("SUB_DEPARTMENT")).toBe("+ Add User");
  });
});

describe("OrganizationSummary Component", () => {
  it("renders live counts from summary data", () => {
    const summary = {
      main_companies: 3,
      sub_companies: 6,
      projects: 9,
      circles: 12,
      domains: 39,
      departments: 15,
      sub_departments: 24,
    };

    render(<OrganizationSummary summary={summary} isLoading={false} />);

    expect(screen.getByText("Main Co.")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Sub Co.")).toBeDefined();
    expect(screen.getByText("6")).toBeDefined();
    expect(screen.getByText("Projects")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
    expect(screen.getByText("Departments")).toBeDefined();
    expect(screen.getByText("15")).toBeDefined();
    expect(screen.getByText("Sub-Depts")).toBeDefined();
    expect(screen.getByText("24")).toBeDefined();
  });
});

describe("OrganizationTree Component", () => {
  it("renders empty state when tree is empty", () => {
    const handleAddCompany = vi.fn();
    render(
      <OrganizationTree
        tree={[]}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        searchFilter=""
        onAddCompany={handleAddCompany}
      />
    );

    expect(screen.getByText("No Organization Structure Created Yet")).toBeDefined();
    expect(screen.getByText("+ Create Main Company")).toBeDefined();
  });

  it("renders tree nodes when data is present", () => {
    const sampleTree: HierarchyNode[] = [
      {
        id: "main_1",
        raw_id: 1,
        level: "MAIN_COMPANY",
        name: "Acme Group Holdings",
        code: "ACME_GRP",
        status: "ACTIVE",
        badge: "Main Company",
        badge_color: "purple",
        parent_id: null,
        parent_name: null,
        children: [
          {
            id: "sub_1",
            raw_id: 1,
            level: "SUB_COMPANY",
            name: "Acme Telecom Ltd",
            code: "ACME_TEL",
            status: "ACTIVE",
            badge: "Sub Company",
            badge_color: "indigo",
            parent_id: "main_1",
            parent_name: "Acme Group Holdings",
            children: [],
          },
        ],
      },
    ];

    render(
      <OrganizationTree
        tree={sampleTree}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        searchFilter=""
        onAddCompany={vi.fn()}
      />
    );

    expect(screen.getByText("Acme Group Holdings")).toBeDefined();
    expect(screen.getByText("(ACME_GRP)")).toBeDefined();
    expect(screen.getByText("Acme Telecom Ltd")).toBeDefined();
    expect(screen.getByText("(ACME_TEL)")).toBeDefined();
  });
});

describe("OrganizationDetails Inspector Component", () => {
  it("renders empty selection guide when no node is selected", () => {
    render(
      <OrganizationDetails
        nodeDetail={null}
        isLoading={false}
        onEdit={vi.fn()}
        onAddChild={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Select a Hierarchy Node")).toBeDefined();
  });

  it("renders full metadata and contextual buttons when node is selected", () => {
    const sampleDetail = {
      id: 10,
      level: "PROJECT" as const,
      name: "Rajasthan Network Rollout",
      code: "PRJ_RJ_ROLLOUT",
      description: "Fiber optic network rollout across 33 districts",
      status: "ACTIVE" as const,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-20T12:00:00Z",
      parent: {
        level: "SUB_COMPANY" as const,
        id: 2,
        name: "Telecrats Infrastructure",
        code: "TC_INFRA",
      },
      children: [
        {
          id: 1,
          name: "Jaipur Urban Circle",
          code: "CIR_JPR",
          status: "ACTIVE",
          level: "CIRCLE" as const,
        },
      ],
      children_count: 1,
      allowed_child_level: "CIRCLE" as const,
      audits: [],
    };

    render(
      <OrganizationDetails
        nodeDetail={sampleDetail}
        isLoading={false}
        onEdit={vi.fn()}
        onAddChild={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Rajasthan Network Rollout")).toBeDefined();
    expect(screen.getByText("Code: PRJ_RJ_ROLLOUT")).toBeDefined();
    expect(screen.getByText("Telecrats Infrastructure")).toBeDefined();
    expect(screen.getByText("Jaipur Urban Circle")).toBeDefined();
    expect(screen.getAllByText("+ Add Circle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Edit")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });
});
