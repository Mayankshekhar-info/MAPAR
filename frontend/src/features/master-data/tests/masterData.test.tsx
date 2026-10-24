import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { MasterDataFilterBar } from "../components/MasterDataFilterBar";
import { MasterDataTable } from "../components/MasterDataTable";
import { MasterDataEditModal } from "../components/MasterDataEditModal";
import { MasterDataUploadModal } from "../components/MasterDataUploadModal";
import { MasterDataColumn, MasterDataRecord, MasterDataMeta } from "../types/masterData.types";

const mockMeta: MasterDataMeta = {
  templates: [
    {
      id: 1,
      code: "TPL_OPS",
      name: "Field Operations Dataset",
      description: "Daily field metrics",
      data_level: "CIRCLE",
      target_entity: "OPERATIONS",
      latest_version_id: 1,
      columns: [],
    },
  ],
  reporting_periods: [
    {
      id: 1,
      name: "Oct 2026",
      period_type: "MONTHLY",
      is_current: true,
      is_frozen: false,
      start_date: "2026-10-01",
      end_date: "2026-10-31",
    },
  ],
  companies: [{ id: 1, name: "Pratap", code: "PTPL" }],
  sub_companies: [{ id: 1, name: "TELECRATS_BN3_O&M", code: "TELECRATS", main_company_id: 1 }],
  projects: [{ id: 1, name: "4G O&M", code: "BSNL_4G", sub_company_id: 1 }],
  circles: [{ id: 1, name: "Rajasthan", code: "RAJASTHAN", project_id: 1 }],
  departments: [{ id: 1, name: "Operations", code: "OPS" }],
};

const mockColumns: MasterDataColumn[] = [
  { id: 1, name: "site_code", display_label: "Site Code", data_type: "TEXT", is_required: true, column_order: 1 },
  { id: 2, name: "capacity", display_label: "Capacity", data_type: "DECIMAL", is_required: true, column_order: 2 },
  { id: 3, name: "is_active", display_label: "Active Status", data_type: "BOOLEAN", is_required: false, column_order: 3 },
];

const mockRecords: MasterDataRecord[] = [
  {
    id: 101,
    row_index: 2,
    raw_data: { site_code: "SITE_ALPHA", capacity: "94.50", is_active: "TRUE" },
    is_valid: true,
    validation_errors: [],
    is_imported: true,
    created_at: "2026-10-15T10:00:00Z",
    batch_id: "BATCH-TEST-001",
    batch_status: "COMPLETED",
    reporting_period: "Oct 2026",
    company: "Pratap",
    sub_company: "TELECRATS_BN3_O&M",
    project: "4G O&M",
    circle: "Rajasthan",
    department: "Operations",
  },
];

describe("Master Data Module - Frontend Unit Tests", () => {
  it("renders MasterDataFilterBar with action buttons and filter selects", () => {
    const handleFilterChange = vi.fn();
    const handleReset = vi.fn();
    const handleOpenUpload = vi.fn();
    const handleExport = vi.fn();

    render(
      <MasterDataFilterBar
        meta={mockMeta}
        filters={{
          companyId: null,
          subCompanyId: null,
          projectId: null,
          circleId: null,
          departmentId: null,
          periodId: null,
          templateId: null,
          search: "",
          isValid: null,
          page: 0,
          pageSize: 50,
        }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        onOpenUpload={handleOpenUpload}
        onExport={handleExport}
      />
    );

    expect(screen.getByText("Upload Excel")).toBeDefined();
    expect(screen.getByText("Export Excel")).toBeDefined();
    expect(screen.getByText("Reset Filters")).toBeDefined();
  });

  it("renders MasterDataTable with dynamic columns and record rows", () => {
    const handleEdit = vi.fn();

    render(
      <MasterDataTable
        columns={mockColumns}
        records={mockRecords}
        total={1}
        page={0}
        pageSize={50}
        search=""
        isLoading={false}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onEditRecord={handleEdit}
      />
    );

    expect(screen.getByText("Site Code")).toBeDefined();
    expect(screen.getByText("Capacity")).toBeDefined();
    expect(screen.getByText("Active Status")).toBeDefined();
    expect(screen.getByText("SITE_ALPHA")).toBeDefined();
    expect(screen.getByText("94.50")).toBeDefined();
  });

  it("renders MasterDataEditModal with dynamic field inputs", () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <MasterDataEditModal
        open={true}
        record={mockRecords[0]}
        columns={mockColumns}
        isSaving={false}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    expect(screen.getByText("Edit Master Data Record #2")).toBeDefined();
    expect(screen.getByLabelText(/Site Code/i)).toBeDefined();
    expect(screen.getByLabelText(/Capacity/i)).toBeDefined();
  });

  it("renders MasterDataUploadModal with dataset selection and hierarchy scope", () => {
    const handleClose = vi.fn();
    const handleUpload = vi.fn().mockResolvedValue({ success: true, message: "Uploaded" });

    render(
      <MasterDataUploadModal
        open={true}
        meta={mockMeta}
        currentFilters={{
          companyId: null,
          subCompanyId: null,
          projectId: null,
          circleId: null,
          departmentId: null,
          periodId: null,
          templateId: null,
          search: "",
          isValid: null,
          page: 0,
          pageSize: 50,
        }}
        isUploading={false}
        onClose={handleClose}
        onUpload={handleUpload}
      />
    );

    expect(screen.getByText("Upload Master Data Excel")).toBeDefined();
    expect(screen.getByLabelText(/Target Dataset \/ Template/i)).toBeDefined();
    expect(screen.getByLabelText(/^Company$/i)).toBeDefined();
    expect(screen.getByLabelText(/^Sub-Company$/i)).toBeDefined();
    expect(screen.getByLabelText(/^Project$/i)).toBeDefined();
    expect(screen.getByLabelText(/^Circle$/i)).toBeDefined();
  });
});
