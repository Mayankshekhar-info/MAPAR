import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UploadDropzoneModal } from "../components/UploadDropzoneModal";
import { UploadTemplate, ReportingPeriodOption } from "../types/uploads.types";

const mockTemplates: UploadTemplate[] = [
  {
    id: 1,
    name: "Site Performance Log",
    code: "SITE_PERF",
    description: "Daily site operational and power metrics",
    data_level: "CIRCLE",
    status: "ACTIVE",
    target_entity: "Operations",
    created_by_name: "Admin",
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
    latest_version_number: 1,
    columns_count: 5,
    batches_count: 2,
  },
];

const mockPeriods: ReportingPeriodOption[] = [
  {
    id: 10,
    name: "Daily: 2026-10-15",
    period_type: "DAILY",
    is_current: true,
    is_frozen: false,
  },
  {
    id: 11,
    name: "Weekly: 2026-10-12 to 2026-10-18",
    period_type: "WEEKLY",
    is_current: false,
    is_frozen: false,
  },
];

describe("UploadDropzoneModal 5-Step Workflow", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <UploadDropzoneModal
          open={true}
          templates={mockTemplates}
          reportingPeriods={mockPeriods}
          preselectedTemplate={mockTemplates[0]}
          isUploading={false}
          onClose={vi.fn()}
          onUpload={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it("renders the 5-step stepper and initial File & Template step", () => {
    renderComponent();
    expect(screen.getByText("Upload Business Data & Execute KPI Workflow")).toBeDefined();
    expect(screen.getByText("File & Template")).toBeDefined();
    expect(screen.getByText("Reporting Period")).toBeDefined();
    expect(screen.getByText("Select KPI")).toBeDefined();
    expect(screen.getByText("Validation & Preview")).toBeDefined();
    expect(screen.getByText("Process & Results")).toBeDefined();

    expect(screen.getByText(/Choose Target Template & Attach Excel Workbook/i)).toBeDefined();
  });

  it("advances through the wizard when file is attached", async () => {
    renderComponent();

    // Attach a mock Excel file
    const file = new File(["dummy content"], "network_data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const dropzone = screen.getByText(/Drag & drop completed Excel file here/i);
    expect(dropzone).toBeDefined();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [file],
    });
    fireEvent.change(input);

    expect(screen.getByText("network_data.xlsx")).toBeDefined();

    // Click Next to advance to Step 2: Reporting Period
    const nextBtn = screen.getByRole("button", { name: /Next Step/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Step 2: Configure Business Reporting Period/i)).toBeDefined();
    expect(screen.getByLabelText(/Daily Date/i)).toBeDefined();
    expect(screen.getByLabelText(/Weekly \(ISO-8601\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Monthly/i)).toBeDefined();

    // Click Weekly
    const weeklyRadio = screen.getByLabelText(/Weekly \(ISO-8601\)/i);
    fireEvent.click(weeklyRadio);
    expect(screen.getByText(/Consistent Week Boundaries/i)).toBeDefined();

    // Advance to Step 3: Select KPI
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    expect(screen.getByText(/Step 3: Select Compatible KPI for Immediate Calculation/i)).toBeDefined();

    // Advance to Step 4: Validation & Preview
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    expect(screen.getByText(/Step 4: Review Configuration & Dataset Schema Preview/i)).toBeDefined();
    expect(screen.getByText(/network_data.xlsx/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Validate & Process Actual Data/i })).toBeDefined();
  });

});
