import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GovernanceOwnerDashboardCard } from "../components/GovernanceOwnerDashboardCard";
import { MandatoryEvidenceClosureModal } from "../components/MandatoryEvidenceClosureModal";
import { GovernanceStatusMatrix } from "../components/GovernanceStatusMatrix";
import { GovernanceActiveFiltersBar } from "../components/GovernanceActiveFiltersBar";
import { GovernanceOverdueAnalysis } from "../components/GovernanceOverdueAnalysis";
import { GovernanceTargetTimeline } from "../components/GovernanceTargetTimeline";
import { GovernanceFollowUpSection } from "../components/GovernanceFollowUpSection";
import { GovernanceExecutionCard } from "../components/GovernanceExecutionCard";
import { GovernancePeriodControl } from "../components/GovernancePeriodControl";
import { WeeklyProgressTimeline } from "../components/WeeklyProgressTimeline";
import { ActionOwnerTasksPage } from "../pages/ActionOwnerTasksPage";
import { GovernanceDashboardPage } from "../pages/GovernanceDashboardPage";
import { GovernanceDetailDrawer } from "../components/GovernanceDetailDrawer";
import { TaskReviewsCard } from "../components/TaskReviewsCard";
import { AssignTaskReviewModal } from "../components/AssignTaskReviewModal";
import { SubmitTaskReviewModal } from "../components/SubmitTaskReviewModal";
import { governanceService } from "../api/governanceService";
import { MyProgressMetrics, GovernanceActionPoint, GovernanceMetrics, OwnerDistribution, GovernanceTaskReview } from "../types/governance.types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { api } from "../../../services/api";

describe("GovernanceOwnerDashboardCard Component", () => {
  const sampleProgress: MyProgressMetrics = {
    total: 12,
    open: 2,
    wip: 6,
    closed: 4,
    overdue: 1,
    upcoming: 3,
    missing_weekly: 2,
    completion_rate: 33.3,
    evidence_pending: 1,
    evidence_accepted: 3,
    evidence_rework: 1,
    evidence_not_submitted: 4,
  };

  it("renders owner progress metrics correctly", () => {
    const handleQuickFilter = vi.fn();
    render(
      <GovernanceOwnerDashboardCard
        myProgress={sampleProgress}
        onQuickFilter={handleQuickFilter}
      />
    );

    // Total Assigned
    expect(screen.getByText("TOTAL ASSIGNED")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    // In Progress
    expect(screen.getByText("IN PROGRESS (WIP)")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();

    // Completed
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    // Completion percentage
    expect(screen.getByText(/33\.3%/)).toBeInTheDocument();

    // Evidence status chips
    expect(screen.getByText("Accepted: 3")).toBeInTheDocument();
    expect(screen.getByText("Pending Review: 1")).toBeInTheDocument();
    expect(screen.getByText("Rework Needed: 1")).toBeInTheDocument();
  });

  it("triggers onQuickFilter when a card is clicked", () => {
    const handleQuickFilter = vi.fn();
    render(
      <GovernanceOwnerDashboardCard
        myProgress={sampleProgress}
        onQuickFilter={handleQuickFilter}
      />
    );

    const wipCard = screen.getByText("IN PROGRESS (WIP)");
    fireEvent.click(wipCard);
    expect(handleQuickFilter).toHaveBeenCalledWith({ status: "WIP", view_mode: "my_tasks" });
  }, 15000);
});

describe("MandatoryEvidenceClosureModal Component", () => {
  const sampleAction: GovernanceActionPoint = {
    id: 99,
    action_id: "ACT-RAJ-099",
    circle: { id: 1, name: "Rajasthan Circle", code: "RAJ", region: "North" },
    function_area: "Operations",
    action_point: "Test Mandatory Proof Enforcement",
    key_deliverable: "Deliver evidence or stay open",
    owner: { id: 1, username: "rverma", full_name: "Rahul Verma", email: "rverma@telecrats.com", role: "Auditee" },
    owner_name_override: "Rahul Verma",
    raised_date: "2026-10-01",
    target_closure_date: "2026-10-20",
    current_target_date: "2026-10-20",
    status: "WIP",
    priority: "High",
    evidence_required: true,
    evidence_status: "Not Submitted",
    evidence_items: [],
    revision_count: 0,
    ageing_days: 21,
    ageing_bucket: "16-30 Days",
    weeks_in_review: 2,
    last_update: "2026-10-15",
    is_overdue: true,
    is_escalated: false,
    current_progress_percent: 75,
    created_at: "2026-10-01",
    updated_at: "2026-10-15",
  };

  it("displays policy alert and upload fields when opened", () => {
    render(
      <MandatoryEvidenceClosureModal
        open={true}
        action={sampleAction}
        onClose={vi.fn()}
        onEvidenceUploaded={vi.fn()}
      />
    );

    expect(screen.getByText("Evidence Required Before Closure")).toBeInTheDocument();
    expect(screen.getByText("Task Closure Is Restricted")).toBeInTheDocument();
    expect(screen.getByText(/requires verified evidence/i)).toBeInTheDocument();
  }, 15000);
});

import { GovernanceMetricsBar } from "../components/GovernanceMetricsBar";
import { GovernanceBreakdownTabs } from "../components/GovernanceBreakdownTabs";


describe("GovernanceMetricsBar Component", () => {
  const sampleMetrics = {
    total_actions: 10,
    open_count: 3,
    wip_count: 4,
    closed_count: 3,
    overdue_count: 2,
    avg_days_late: 5,
    pending_evidence_count: 1,
    accepted_evidence_count: 2,
    rework_evidence_count: 0,
  } as unknown as GovernanceMetrics;

  it("renders metric cards with values and subtitles", () => {
    const handleFilterChange = vi.fn();
    render(
      <GovernanceMetricsBar
        metrics={sampleMetrics}
        onFilterChange={handleFilterChange}
      />
    );

    expect(screen.getByText("Total Actions")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();

    // Check subtitle
    expect(screen.getByText("4 in progress")).toBeInTheDocument();
    expect(screen.getByText("30% closed")).toBeInTheDocument();
    expect(screen.getByText("avg 5d late")).toBeInTheDocument();
  });

  it("triggers onFilterChange when Overdue card is clicked", () => {
    const handleFilterChange = vi.fn();
    render(
      <GovernanceMetricsBar
        metrics={sampleMetrics}
        onFilterChange={handleFilterChange}
      />
    );

    const overdueCard = screen.getByText("Overdue");
    fireEvent.click(overdueCard);
    expect(handleFilterChange).toHaveBeenCalledWith({ is_overdue: true });
  });
});

describe("GovernanceBreakdownTabs Component", () => {
  const sampleOwners = [
    {
      owner_id: 1,
      owner_name: "Rahul Verma",
      username: "rverma",
      initials: "RV",
      total: 5,
      open: 2,
      wip: 1,
      closed: 2,
      overdue: 1,
      evidence_pending: 0,
      completion_rate: 40,
    },
  ] as unknown as OwnerDistribution[];

  const sampleMetrics = {
    owner_distribution: sampleOwners,
    circle_distribution: [
      { circle__id: 1, circle__name: "Delhi", circle__code: "DEL", circle__region: "North", total: 6, open: 2, wip: 1, closed: 2, overdue: 1, escalated: 0, completion_rate: 33 },
    ],
    bucket_counts: { "0-7 Days": 2, "8-15 Days": 1, "16-30 Days": 0, "30+ Days": 0 },
    closure_performance: { on_time_closed: 2, delayed_closed: 0, on_time_rate: 100 },
  } as unknown as GovernanceMetrics;

  it("renders owner breakdown table with initials and allows selecting an owner", () => {
    const handleSelectOwner = vi.fn();
    const handleSelectCircle = vi.fn();
    const handleSelectBucket = vi.fn();

    render(
      <GovernanceBreakdownTabs
        metrics={sampleMetrics}
        onSelectOwner={handleSelectOwner}
        onSelectCircle={handleSelectCircle}
        onSelectBucket={handleSelectBucket}
      />
    );

    expect(screen.getByText("Owner-Wise Workload & Accountability")).toBeInTheDocument();
    expect(screen.getByText("Rahul Verma")).toBeInTheDocument();
    expect(screen.getByText("RV")).toBeInTheDocument();
    expect(screen.getByText("@rverma")).toBeInTheDocument();

    // Click owner row
    fireEvent.click(screen.getByText("Rahul Verma"));
    expect(handleSelectOwner).toHaveBeenCalledWith(1);
  });
});

describe("GovernanceStatusMatrix Component", () => {
  const sampleMetrics = {
    total_actions: 10,
    open_count: 3,
    wip_count: 2,
    closed_count: 5,
    overdue_count: 2,
    completion_rate: 50,
    circle_distribution: [
      {
        circle__id: 1,
        circle__name: "Punjab",
        circle__code: "PB",
        circle__region: "North",
        total: 10,
        open: 3,
        wip: 2,
        closed: 5,
        overdue: 2,
        completion_rate: 50,
      },
    ],
    owner_distribution: [
      {
        owner_id: 101,
        owner_name: "Amit Kumar",
        username: "akumar",
        initials: "AK",
        total: 10,
        open: 3,
        wip: 2,
        closed: 5,
        overdue: 2,
        completion_rate: 50,
      },
    ],
  } as unknown as GovernanceMetrics;

  it("renders status matrix with circles, grand totals, and triggers onCellClick", () => {
    const handleCellClick = vi.fn();
    render(
      <GovernanceStatusMatrix
        metrics={sampleMetrics}
        onCellClick={handleCellClick}
      />
    );

    expect(screen.getByText("Action Status Matrix")).toBeInTheDocument();
    expect(screen.getByText("Punjab")).toBeInTheDocument();
    expect(screen.getByText("PB")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Grand Total")).toBeInTheDocument();

    // Click Open cell for Punjab
    fireEvent.click(screen.getByText("Punjab"));
    expect(handleCellClick).toHaveBeenCalledWith({ circle_id: 1 });
  });

  it("allows switching grouping to By Owner", () => {
    const handleCellClick = vi.fn();
    render(
      <GovernanceStatusMatrix
        metrics={sampleMetrics}
        onCellClick={handleCellClick}
      />
    );

    const byOwnerBtn = screen.getByText("By Owner");
    fireEvent.click(byOwnerBtn);

    expect(screen.getByText("Amit Kumar")).toBeInTheDocument();
    expect(screen.getByText("AK")).toBeInTheDocument();
  });



  it("triggers onOwnerNavigate when an action owner is clicked in By Owner view", () => {
    const handleCellClick = vi.fn();
    const handleOwnerNavigate = vi.fn();
    render(
      <GovernanceStatusMatrix
        metrics={sampleMetrics}
        onCellClick={handleCellClick}
        onOwnerNavigate={handleOwnerNavigate}
      />
    );

    const byOwnerBtn = screen.getByText("By Owner");
    fireEvent.click(byOwnerBtn);

    const ownerName = screen.getByText("Amit Kumar");
    expect(ownerName).toBeInTheDocument();

    fireEvent.click(ownerName);
    expect(handleOwnerNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ owner_name: "Amit Kumar" })
    );
  });
});

describe("GovernanceActiveFiltersBar Component", () => {
  it("renders active filter chips and handles remove and clear all", () => {
    const handleFilterChange = vi.fn();
    const handleClearAll = vi.fn();

    render(
      <GovernanceActiveFiltersBar
        filters={{
          circle_id: 1,
          status: "Open",
          is_overdue: true,
        }}
        metadata={{
          circles: [{ id: 1, name: "Punjab", code: "PB", region: "North" }],
          users: [],
          statuses: [],
          priorities: [],
          evidence_statuses: [],
        } as unknown as any}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
      />
    );

    expect(screen.getByText(/Circle: Punjab \(PB\)/)).toBeInTheDocument();
    expect(screen.getByText(/Status: Open/)).toBeInTheDocument();
    expect(screen.getByText(/Overdue Actions Only/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear All Filters"));
    expect(handleClearAll).toHaveBeenCalledTimes(1);
  });
});

describe("GovernanceOverdueAnalysis Component", () => {
  it("renders clean zero empty state when no metrics or records exist", () => {
    const handleBucket = vi.fn();
    const handleOverdue = vi.fn();

    render(
      <GovernanceOverdueAnalysis
        metrics={undefined}
        onSelectBucket={handleBucket}
        onSelectOverdue={handleOverdue}
      />
    );

    expect(screen.getByText("Overdue Analysis & Ageing Performance")).toBeInTheDocument();
    expect(screen.getByText("Total Overdue Actions")).toBeInTheDocument();
    expect(screen.getByText("Average Delay")).toBeInTheDocument();
    expect(screen.getByText("Not Yet Due (On Track)")).toBeInTheDocument();
    expect(screen.getByText("> 15 Days Overdue (Critical)")).toBeInTheDocument();
  });
});

describe("GovernanceTargetTimeline Component", () => {
  it("renders friendly empty state when timeline has no deadlines", () => {
    const handleSelectAction = vi.fn();

    render(
      <GovernanceTargetTimeline
        timeline={[]}
        onSelectAction={handleSelectAction}
      />
    );

    expect(screen.getByText("Target Deadline Timeline")).toBeInTheDocument();
    expect(screen.getByText("No Upcoming Deadlines")).toBeInTheDocument();
  });
});

describe("GovernanceFollowUpSection Component", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const renderWithClient = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  it("renders clean zero risk empty state when urgentItems is empty", () => {
    const handleSelectAction = vi.fn();

    renderWithClient(
      <GovernanceFollowUpSection
        urgentItems={[]}
        onSelectAction={handleSelectAction}
      />
    );

    expect(screen.getByText("Actionable Risks & Urgent Follow-up")).toBeInTheDocument();
    expect(screen.getByText("Zero Urgent Risks")).toBeInTheDocument();
  });

  it("renders urgent task items with Inspect action button and confirms Send Email is NOT present", () => {
    const handleSelectAction = vi.fn();
    const urgentItems = [
      {
        id: 101,
        action_id: "ACT-00101",
        action_point: "Perform critical compliance review",
        owner_name: "Rahul Verma",
        circle_name: "Circle Delhi",
        circle_code: "DEL",
        status: "Open",
        priority: "High",
        current_target_date: "2026-10-25",
        is_overdue: true,
        days_overdue: 3,
        progress_percent: 25,
        evidence_status: "Pending Review",
      },
    ];

    renderWithClient(
      <GovernanceFollowUpSection
        urgentItems={urgentItems}
        onSelectAction={handleSelectAction}
      />
    );

    expect(screen.getByText("ACT-00101")).toBeInTheDocument();
    expect(screen.getByText("Perform critical compliance review")).toBeInTheDocument();
    expect(screen.getByText("Rahul Verma")).toBeInTheDocument();
    expect(screen.getByText("3d overdue")).toBeInTheDocument();

    // Verify Inspect button is rendered and Send Email is absent
    const inspectBtn = screen.getByRole("button", { name: /Inspect/i });
    expect(inspectBtn).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send Email/i })).not.toBeInTheDocument();

    // Clicking Inspect triggers onSelectAction with the task ID
    fireEvent.click(inspectBtn);
    expect(handleSelectAction).toHaveBeenCalledWith(101);
  });
});

describe("GovernanceExecutionCard Component", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  it("renders tabbed deadlines card and allows switching between timeline and urgent risks", () => {
    const handleSelectAction = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <GovernanceExecutionCard
          timeline={[]}
          urgentItems={[]}
          onSelectAction={handleSelectAction}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Target Timeline \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/Urgent Follow-Up \(0\)/)).toBeInTheDocument();

    // Default tab shows Target Timeline empty state
    expect(screen.getByText("No Upcoming Deadlines")).toBeInTheDocument();

    // Switch to Urgent Follow-Up tab
    fireEvent.click(screen.getByText(/Urgent Follow-Up \(0\)/));
    expect(screen.getByText("Zero Urgent Risks")).toBeInTheDocument();
  });
});

describe("GovernancePeriodControl Component", () => {
  it("renders with available weeks from imported data and displays selected week", () => {
    const handleChangePeriod = vi.fn();
    const availableWeeks = ["Week 43", "Week 42", "Week 41"];

    render(
      <GovernancePeriodControl
        currentReportingWeek="Week 43"
        asOfDate="23-Oct-26"
        selectedWeek="Week 42"
        availableWeeks={availableWeeks}
        onChangePeriod={handleChangePeriod}
      />
    );

    // Active button displays the selected week
    expect(screen.getByText("Week 42")).toBeInTheDocument();
    expect(screen.getByText("As of: 23-Oct-26")).toBeInTheDocument();

    // Clicking dropdown button opens menu listing available weeks
    fireEvent.click(screen.getByText("Week 42"));
    expect(screen.getByText("All Periods (Full Portfolio)")).toBeInTheDocument();
    expect(screen.getByText("Week 43 (Latest)")).toBeInTheDocument();
    expect(screen.getByText("Week 41")).toBeInTheDocument();

    // Selecting Week 43 calls onChangePeriod with Week 43
    fireEvent.click(screen.getByText("Week 43 (Latest)"));
    expect(handleChangePeriod).toHaveBeenCalledWith({ reporting_week: "Week 43" });
  });

  it("handles empty available weeks cleanly without falling back to arbitrary calendar weeks", () => {
    const handleChangePeriod = vi.fn();

    render(
      <GovernancePeriodControl
        asOfDate="23-Oct-26"
        selectedWeek={undefined}
        availableWeeks={[]}
        onChangePeriod={handleChangePeriod}
      />
    );

    expect(screen.getByText("All Periods")).toBeInTheDocument();

    // Opening dropdown shows empty state message
    fireEvent.click(screen.getByText("All Periods"));
    expect(screen.getByText("No reporting weeks in uploaded data")).toBeInTheDocument();
  });

  it("navigates older and newer weeks using step buttons", () => {
    const handleChangePeriod = vi.fn();
    const availableWeeks = ["Week 43", "Week 42", "Week 41"];

    render(
      <GovernancePeriodControl
        selectedWeek="Week 42"
        availableWeeks={availableWeeks}
        onChangePeriod={handleChangePeriod}
      />
    );

    // Step button to older week (<) should select Week 41
    const olderBtn = screen.getByTestId("ChevronLeftIcon").closest("button")!;
    fireEvent.click(olderBtn);
    expect(handleChangePeriod).toHaveBeenCalledWith({ reporting_week: "Week 41" });

    // Step button to newer week (>) should select Week 43
    const newerBtn = screen.getByTestId("ChevronRightIcon").closest("button")!;
    fireEvent.click(newerBtn);
    expect(handleChangePeriod).toHaveBeenCalledWith({ reporting_week: "Week 43" });
  });
});

describe("Governance Bucket Field UI Integration", () => {
  const sampleActionWithBucket: GovernanceActionPoint = {
    id: 101,
    action_id: "ACT-RAJ-101",
    circle: { id: 1, name: "Rajasthan Circle", code: "RAJ", region: "North" },
    function_area: "Operations",
    bucket: "Critical Infrastructure",
    action_point: "Deploy backup generator fuel sensors",
    key_deliverable: "Sensors calibrated and live",
    owner: { id: 1, username: "mgupta", full_name: "Mayank Gupta", email: "mgupta@mapar.com", role: "Auditee" },
    owner_name_override: "Mayank Gupta",
    raised_date: "2026-10-01",
    target_closure_date: "2026-10-25",
    current_target_date: "2026-10-25",
    status: "Open",
    priority: "High",
    evidence_required: true,
    evidence_status: "Pending Review",
    revision_count: 0,
    ageing_days: 10,
    ageing_bucket: "8-15 Days",
    weeks_in_review: 2,
    is_escalated: false,
    is_overdue: false,
    last_update: "Sensors arrived on site",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-05T10:00:00Z",
  };

  it("renders Bucket chip in GovernanceFollowUpSection urgent tasks table", () => {
    const handleSelectAction = vi.fn();
    const urgentItems = [
      {
        id: 101,
        action_id: "ACT-RAJ-101",
        action_point: "Deploy backup generator fuel sensors",
        bucket: "Critical Infrastructure",
        owner_name: "Mayank Gupta",
        circle_name: "Rajasthan Circle",
        circle_code: "RAJ",
        status: "Open",
        priority: "High",
        current_target_date: "2026-10-25",
        is_overdue: true,
        days_overdue: 2,
        progress_percent: 45,
        evidence_status: "Pending Review",
      },
    ];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GovernanceFollowUpSection
          urgentItems={urgentItems}
          onSelectAction={handleSelectAction}
        />
      </QueryClientProvider>
    );

    // Verify Bucket chip is displayed
    expect(screen.getByText("Critical Infrastructure")).toBeInTheDocument();
  });

  it("renders Bucket badge in WeeklyProgressTimeline updates", () => {
    const updates = [
      {
        id: 201,
        action_point: 101,
        action_id: "ACT-RAJ-101",
        action_point_title: "Deploy backup generator fuel sensors",
        bucket: "Statutory Compliance",
        reporting_week: "Week 42",
        work_completed: "Installed calibration modules",
        progress_percent: 60,
        status: "WIP" as const,
        submitted_at: "2026-10-20T10:00:00Z",
        updated_at: "2026-10-20T10:00:00Z",
        revision_number: 1,
      },
    ];

    render(<WeeklyProgressTimeline updates={updates} />);

    expect(screen.getByText("Bucket: Statutory Compliance")).toBeInTheDocument();
    expect(screen.getByText("Week 42")).toBeInTheDocument();
  });
});

describe("ActionOwnerTasksPage Component", () => {
  it("renders owner banner, KPI cards, and assigned tasks from API", async () => {
    vi.spyOn(governanceService, "getActions").mockResolvedValue({
      success: true,
      count: 1,
      total_pages: 1,
      current_page: 1,
      page_size: 150,
      results: [
        {
          id: 101,
          action_id: "ACT-00101",
          circle: { id: 1, name: "Punjab" },
          function_area: "Operations",
          action_point: "Quarterly Safety Protocol Review",
          key_deliverable: "Inspection checklist",
          owner: { id: 5, first_name: "Rahul", last_name: "Sharma", username: "rsharma" },
          status: "Open",
          priority: "High",
          current_progress_percent: 40,
          current_target_date: "2026-11-15",
          target_closure_date: "2026-11-15",
          revision_count: 0,
          is_overdue: false,
          days_overdue: 0,
        } as any,
      ],
    });

    render(
      <MemoryRouter initialEntries={["/governance/owners/5/tasks?name=Rahul%20Sharma"]}>
        <Routes>
          <Route path="/governance/owners/:ownerId/tasks" element={<ActionOwnerTasksPage mode="governance" />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Rahul Sharma/i)).length).toBeGreaterThan(0);
    expect(screen.getByText("ACT-00101")).toBeInTheDocument();
    expect(screen.getByText("Quarterly Safety Protocol Review")).toBeInTheDocument();
    expect(screen.getByText("Back to Action Status Matrix")).toBeInTheDocument();

    // Verify Send Email button is NOT rendered
    expect(screen.queryByRole("button", { name: /Send Email/i })).not.toBeInTheDocument();
  }, 15000);

  it("confirms Send Email button and email modal are NOT present in Governance mode", async () => {
    vi.spyOn(governanceService, "getActions").mockResolvedValue({
      success: true,
      count: 2,
      total_pages: 1,
      current_page: 1,
      page_size: 150,
      results: [
        {
          id: 101,
          action_id: "ACT-00101",
          circle: { id: 1, name: "Punjab" },
          function_area: "Operations",
          action_point: "Quarterly Safety Protocol Review",
          owner: { id: 5, full_name: "Rahul Sharma", email: "rahul@example.com" },
          status: "Open",
          priority: "High",
          current_progress_percent: 40,
          current_target_date: "2026-11-15",
          target_closure_date: "2026-11-15",
        } as any,
      ],
    });

    render(
      <MemoryRouter initialEntries={["/governance/owners/5/tasks?name=Rahul%20Sharma"]}>
        <Routes>
          <Route path="/governance/owners/:ownerId/tasks" element={<ActionOwnerTasksPage mode="governance" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("ACT-00101");
    expect(screen.queryByRole("button", { name: /Send Email/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms Send Email button and email modal are NOT present in Audit & Action Owner mode", async () => {
    vi.spyOn(governanceService, "getActions").mockResolvedValue({
      success: true,
      count: 2,
      total_pages: 1,
      current_page: 1,
      page_size: 150,
      results: [
        {
          id: 101,
          action_id: "ACT-00101",
          circle: { id: 1, name: "Punjab" },
          function_area: "Operations",
          action_point: "Quarterly Safety Protocol Review",
          owner: { id: 5, full_name: "Rahul Sharma", email: "rahul@example.com" },
          status: "Open",
          priority: "High",
          current_progress_percent: 40,
          current_target_date: "2026-11-15",
          target_closure_date: "2026-11-15",
        } as any,
      ],
    });

    render(
      <MemoryRouter initialEntries={["/audit/owners/5/tasks?name=Rahul%20Sharma"]}>
        <Routes>
          <Route path="/audit/owners/:ownerId/tasks" element={<ActionOwnerTasksPage mode="audit" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("ACT-00101");
    const sendEmailBtn = screen.queryByRole("button", { name: /Send Email/i });
    expect(sendEmailBtn).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Task Reviews & Reviewer Workflow Integration", () => {
  const sampleActiveReview: GovernanceTaskReview = {
    id: 501,
    action_point: 101,
    action_id: "ACT-00101",
    action_point_title: "Quarterly Safety Protocol Review",
    assigned_reviewer: {
      id: 8,
      username: "sgupta",
      full_name: "Shweta Gupta",
      email: "shweta@mapar.com",
      role: "Auditor",
    },
    requested_by: {
      id: 1,
      username: "admin",
      full_name: "Admin User",
      email: "admin@mapar.com",
      role: "Super Admin",
    },
    assigned_at: "2026-10-20T10:00:00Z",
    instructions: "Please verify valve pressure calibration logs against safety threshold.",
    status: "In Review",
    review_notes: "Preliminary inspection indicates all pressure gauges are within standard threshold.",
    submitted_by: {
      id: 8,
      username: "sgupta",
      full_name: "Shweta Gupta",
      email: "shweta@mapar.com",
      role: "Auditor",
    },
    submitted_at: "2026-10-21T14:30:00Z",
  };

  const samplePastReview: GovernanceTaskReview = {
    id: 500,
    action_point: 101,
    action_id: "ACT-00101",
    action_point_title: "Quarterly Safety Protocol Review",
    assigned_reviewer: {
      id: 9,
      username: "mverma",
      full_name: "Manoj Verma",
      email: "manoj@mapar.com",
      role: "Auditor",
    },
    requested_by: {
      id: 1,
      username: "admin",
      full_name: "Admin User",
      email: "admin@mapar.com",
      role: "Super Admin",
    },
    assigned_at: "2026-10-10T10:00:00Z",
    instructions: "Initial cycle review",
    status: "Reviewed",
    review_notes: "All clear for week 41.",
    submitted_by: {
      id: 9,
      username: "mverma",
      full_name: "Manoj Verma",
      email: "manoj@mapar.com",
      role: "Auditor",
    },
    submitted_at: "2026-10-12T11:00:00Z",
  };

  it("renders TaskReviewsCard with active review status, reviewer info, instructions, and notes", () => {
    const handleOpenAssign = vi.fn();
    const handleOpenSubmit = vi.fn();

    render(
      <TaskReviewsCard
        taskReviews={[sampleActiveReview, samplePastReview]}
        activeReview={sampleActiveReview}
        canAssignReview={true}
        canSubmitReview={true}
        onOpenAssignModal={handleOpenAssign}
        onOpenSubmitModal={handleOpenSubmit}
      />
    );

    expect(screen.getByText(/Review, Verification & Approval Workflow|Task Reviews/i)).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.getByText(/Shweta Gupta/i)).toBeInTheDocument();
    expect(screen.getByText(/Please verify valve pressure calibration logs/i)).toBeInTheDocument();
    expect(screen.getByText(/Preliminary inspection indicates all pressure gauges/i)).toBeInTheDocument();

    // Trigger submit review button
    const submitBtn = screen.getByRole("button", { name: /Submit Review/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);
    expect(handleOpenSubmit).toHaveBeenCalledWith(sampleActiveReview);

    // Expand previous reviews history
    const historyBtn = screen.getByRole("button", { name: /Show Previous Review History/i });
    expect(historyBtn).toBeInTheDocument();
    fireEvent.click(historyBtn);
    expect(screen.getByText(/Review by Manoj Verma/i)).toBeInTheDocument();
    expect(screen.getByText(/All clear for week 41/i)).toBeInTheDocument();
  });

  it("renders empty state when task has no reviews and allows assigning for review", () => {
    const handleOpenAssign = vi.fn();
    const handleOpenSubmit = vi.fn();

    render(
      <TaskReviewsCard
        taskReviews={[]}
        activeReview={null}
        canAssignReview={true}
        canSubmitReview={false}
        onOpenAssignModal={handleOpenAssign}
        onOpenSubmitModal={handleOpenSubmit}
      />
    );

    expect(screen.getByText(/No formal review/i)).toBeInTheDocument();
    const assignBtn = screen.getByRole("button", { name: /Assign for Review/i });
    fireEvent.click(assignBtn);
    expect(handleOpenAssign).toHaveBeenCalled();
  });
});

describe("Audit & Action Owner Summary Cards Scoping", () => {
  let queryClient: QueryClient;

  const mockMetrics: GovernanceMetrics = {
    total_actions: 10,
    open_count: 3,
    wip_count: 4,
    closed_count: 3,
    overdue_count: 2,
    avg_days_late: 5,
    upcoming_count: 2,
    due_in_3_days_count: 1,
    pending_evidence_count: 1,
    accepted_evidence_count: 2,
    rework_evidence_count: 1,
    reporting_week: "2026-W44",
  } as unknown as GovernanceMetrics;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(api, "get").mockResolvedValue({ data: {} });
    vi.spyOn(governanceService, "getMetrics").mockResolvedValue(mockMetrics);
    vi.spyOn(governanceService, "getActions").mockResolvedValue({
      success: true,
      count: 0,
      total_pages: 1,
      current_page: 1,
      page_size: 25,
      results: [],
    });
    vi.spyOn(governanceService, "getMetadata").mockResolvedValue({
      circles: [],
      categories: [],
      statuses: [],
      priorities: [],
      functions: [],
      available_weeks: [],
    } as any);
    vi.spyOn(governanceService, "getMyEvidence").mockResolvedValue({
      results: [],
      count: 0,
      total_pages: 1,
    } as any);
    vi.spyOn(governanceService, "getRevisionRequests").mockResolvedValue({
      results: [],
      count: 0,
      total_pages: 1,
    } as any);
    vi.spyOn(governanceService, "getHierarchyUsers").mockResolvedValue([] as any);
  });

  it("does NOT render the eight summary cards in Audit & Action Owner mode", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/audit"]}>
          <Routes>
            <Route path="/audit" element={<GovernanceDashboardPage mode="audit" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Audit & Action Owners")).toBeInTheDocument();

    // Verify all 8 summary cards are completely absent from Audit & Action Owner
    expect(screen.queryByText("Total Actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Due Soon")).not.toBeInTheDocument();
    expect(screen.queryByText("Rework Needed")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending Review")).not.toBeInTheDocument();
  });

  it("DOES render the eight summary cards in Governance & Action Tracker mode", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/governance"]}>
          <Routes>
            <Route path="/governance" element={<GovernanceDashboardPage mode="governance" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Governance & Action Tracker")).toBeInTheDocument();

    // Verify summary cards are rendered in Governance & Action Tracker
    expect((await screen.findAllByText("Total Actions")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Due Soon")).toBeInTheDocument();
    expect(screen.getByText("Rework Needed")).toBeInTheDocument();
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });
});

describe("Audit & Action Owner Upload Proof Button Scoping", () => {
  const sampleAction: GovernanceActionPoint = {
    id: 101,
    action_id: "ACT-00101",
    circle: { id: 1, name: "Circle Delhi", code: "DEL", region: "North" },
    function_area: "Operations",
    action_point: "Perform critical compliance review",
    key_deliverable: "Compliance report signed off",
    owner: { id: 5, username: "rverma", full_name: "Rahul Verma", email: "rahul@mapar.com", role: "Auditee" },
    owner_name_override: "Rahul Verma",
    raised_date: "2026-10-01",
    target_closure_date: "2026-10-25",
    current_target_date: "2026-10-25",
    status: "Open",
    priority: "High",
    evidence_required: true,
    evidence_status: "Pending Review",
    revision_count: 0,
    ageing_days: 3,
    ageing_bucket: "0-7 Days",
    weeks_in_review: 1,
    last_update: "Test update",
    is_escalated: false,
    is_overdue: true,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-05T10:00:00Z",
  };

  it("does NOT render Upload Proof button in GovernanceDetailDrawer in Audit & Action Owner mode", async () => {
    vi.spyOn(governanceService, "getWeeklyUpdates").mockResolvedValue({
      success: true,
      weekly_updates: [],
    });

    render(
      <MemoryRouter initialEntries={["/audit"]}>
        <GovernanceDetailDrawer
          open={true}
          action={sampleAction}
          onClose={vi.fn()}
          onReviseTarget={vi.fn()}
          onUploadEvidence={vi.fn()}
          onReviewEvidence={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Perform critical compliance review")).toBeInTheDocument();
    // Verify Upload Proof button is completely absent in Audit & Action Owner mode
    expect(screen.queryByRole("button", { name: /Upload Proof/i })).not.toBeInTheDocument();
  });

  it("DOES render Upload Proof button in GovernanceDetailDrawer in Governance & Action Tracker mode", async () => {
    vi.spyOn(governanceService, "getWeeklyUpdates").mockResolvedValue({
      success: true,
      weekly_updates: [],
    });

    render(
      <MemoryRouter initialEntries={["/governance"]}>
        <GovernanceDetailDrawer
          open={true}
          action={sampleAction}
          onClose={vi.fn()}
          onReviseTarget={vi.fn()}
          onUploadEvidence={vi.fn()}
          onReviewEvidence={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Perform critical compliance review")).toBeInTheDocument();
    // Verify Upload Proof button is present in Governance & Action Tracker mode
    expect(screen.getAllByRole("button", { name: /Upload Proof/i }).length).toBeGreaterThan(0);
  });
});
