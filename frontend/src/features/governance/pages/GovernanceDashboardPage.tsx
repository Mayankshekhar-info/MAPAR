import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SecurityIcon from "@mui/icons-material/Security";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import FolderSharedOutlinedIcon from "@mui/icons-material/FolderSharedOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import {
  useGovernanceList,
  useGovernanceMetrics,
  useGovernanceMetadata,
  useMyEvidenceList,
  useCreateGovernanceAction,
  useUpdateGovernanceAction,
  useReviseTarget,
  useUploadEvidence,
  useReviewEvidence,
  useSubmitWeeklyUpdate,
  useBulkUpdateActions,
  useBulkSubmitWeekly,
  useBulkReviewEvidence,
  useUploadGovernanceExcel,
  useRevisionRequests,
  useSubmitTargetRevisionRequest,
  useReviewTargetRevisionRequest,
} from "../hooks/useGovernance";
import { useAuth } from "../../auth";
import { governanceService } from "../api/governanceService";
import {
  GovernanceActionPoint,
  GovernanceFilterParams,
  GovernanceEvidenceItem,
  CreateActionPayload,
  UpdateActionPayload,
  ReviseTargetPayload,
  ReviewEvidencePayload,
  SubmitWeeklyUpdatePayload,
  GovernanceTargetRevisionRequest,
} from "../types/governance.types";
import Grid from "@mui/material/Grid";

import { GovernanceMetricsBar } from "../components/GovernanceMetricsBar";
import { GovernanceStatusMatrix, StatusMatrixFilterPayload } from "../components/GovernanceStatusMatrix";
import { GovernanceExecutionCard } from "../components/GovernanceExecutionCard";
import { GovernancePeriodControl, PeriodSelection } from "../components/GovernancePeriodControl";
import { GovernanceActiveFiltersBar } from "../components/GovernanceActiveFiltersBar";
import { GovernanceTable } from "../components/GovernanceTable";
import { MyEvidenceTable } from "../components/MyEvidenceTable";
import { GovernanceActionModal } from "../components/GovernanceActionModal";
import { GovernanceRevisionModal } from "../components/GovernanceRevisionModal";
import { RequestTargetRevisionModal } from "../components/RequestTargetRevisionModal";
import { ReviewRevisionRequestDialog } from "../components/ReviewRevisionRequestDialog";
import { RevisionRequestsTable } from "../components/RevisionRequestsTable";
import { GovernanceWeeklyUpdateModal } from "../components/GovernanceWeeklyUpdateModal";
import { GovernanceBulkUpdateModal, BulkModalMode } from "../components/GovernanceBulkUpdateModal";
import { GovernanceExcelModal } from "../components/GovernanceExcelModal";
import { GovernanceWeeklyExcelModal } from "../components/GovernanceWeeklyExcelModal";
import { GovernanceEvidenceUploadModal } from "../components/GovernanceEvidenceUploadModal";
import { GovernanceEvidenceReviewModal } from "../components/GovernanceEvidenceReviewModal";
import { GovernanceOwnerDashboardCard } from "../components/GovernanceOwnerDashboardCard";
import { MandatoryEvidenceClosureModal } from "../components/MandatoryEvidenceClosureModal";

interface GovernanceDashboardPageProps {
  mode?: "governance" | "audit" | "documents";
}

export const GovernanceDashboardPage: React.FC<GovernanceDashboardPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Resolve mode from prop or current pathname
  const effectiveMode =
    mode ||
    (location.pathname.startsWith("/audit")
      ? "audit"
      : location.pathname.startsWith("/documents")
      ? "documents"
      : "governance");

  const [filters, setFilters] = useState<GovernanceFilterParams>({
    page: 1,
    page_size: 25,
    ordering: "-raised_date",
    view_mode: effectiveMode === "audit" ? "my_tasks" : "all",
  });

  useEffect(() => {
    if (effectiveMode === "audit") {
      setFilters((prev) => ({ ...prev, view_mode: "my_tasks", page: 1 }));
    } else if (effectiveMode === "governance") {
      setFilters((prev) => ({ ...prev, view_mode: "all", page: 1 }));
    }
    setSelectedTaskIds([]);
    setSelectedEvidenceIds([]);
  }, [effectiveMode]);

  // Multi-select state for bulk actions
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<number[]>([]);

  // Bulk Modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalMode, setBulkModalMode] = useState<BulkModalMode>("actions");

  // Evidence tab pagination & search
  const [myEvidencePage, setMyEvidencePage] = useState<number>(1);
  const [myEvidencePageSize, setMyEvidencePageSize] = useState<number>(25);
  const [myEvidenceSearch, setMyEvidenceSearch] = useState<string>("");

  const { user: currentUser } = useAuth();

  // Revision requests pagination & filter state
  const [revRequestsPage, setRevRequestsPage] = useState<number>(1);
  const [revRequestsPageSize, setRevRequestsPageSize] = useState<number>(25);
  const [revRequestsStatus, setRevRequestsStatus] = useState<string>("ALL");
  const [revRequestsSearch, setRevRequestsSearch] = useState<string>("");
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<GovernanceTargetRevisionRequest | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState<boolean>(false);
  const [isRequestRevisionOpen, setIsRequestRevisionOpen] = useState<boolean>(false);
  const [actionForRevisionRequest, setActionForRevisionRequest] = useState<GovernanceActionPoint | null>(null);

  // Queries
  const { data: actionsData, isLoading: isLoadingActions, refetch: refetchActions } = useGovernanceList(filters);
  const { data: metricsData, isLoading: isLoadingMetrics, refetch: refetchMetrics } = useGovernanceMetrics(
    filters.circle_id,
    filters.reporting_week
  );
  const { data: metadata } = useGovernanceMetadata();
  const {
    data: myEvidenceData,
    isLoading: isLoadingMyEvidence,
    refetch: refetchMyEvidence,
  } = useMyEvidenceList({
    page: myEvidencePage,
    page_size: myEvidencePageSize,
    search: myEvidenceSearch,
  });
  const {
    data: revisionRequestsData,
    isLoading: isLoadingRevisionRequests,
    refetch: refetchRevisionRequests,
  } = useRevisionRequests({
    page: revRequestsPage,
    page_size: revRequestsPageSize,
    status: revRequestsStatus,
    search: revRequestsSearch,
    circle_id: filters.circle_id || undefined,
  });

  // Mutations
  const createActionMutation = useCreateGovernanceAction();
  const updateActionMutation = useUpdateGovernanceAction();
  const reviseTargetMutation = useReviseTarget();
  const uploadEvidenceMutation = useUploadEvidence();
  const reviewEvidenceMutation = useReviewEvidence();
  const submitWeeklyMutation = useSubmitWeeklyUpdate();
  const bulkUpdateActionsMutation = useBulkUpdateActions();
  const bulkSubmitWeeklyMutation = useBulkSubmitWeekly();
  const bulkReviewEvidenceMutation = useBulkReviewEvidence();
  const uploadExcelMutation = useUploadGovernanceExcel();
  const submitRevisionRequestMutation = useSubmitTargetRevisionRequest();
  const reviewRevisionRequestMutation = useReviewTargetRevisionRequest();

  // Modals state
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<GovernanceActionPoint | null>(null);

  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisingAction, setRevisingAction] = useState<GovernanceActionPoint | null>(null);

  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [weeklyTargetAction, setWeeklyTargetAction] = useState<GovernanceActionPoint | null>(null);

  const [isEvidenceUploadOpen, setIsEvidenceUploadOpen] = useState(false);
  const [evidenceTargetAction, setEvidenceTargetAction] = useState<GovernanceActionPoint | null>(null);

  const [isEvidenceReviewOpen, setIsEvidenceReviewOpen] = useState(false);
  const [reviewingEvidenceItem, setReviewingEvidenceItem] = useState<GovernanceEvidenceItem | null>(null);

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isWeeklyExcelModalOpen, setIsWeeklyExcelModalOpen] = useState(false);
  const [mandatoryEvidenceAction, setMandatoryEvidenceAction] = useState<GovernanceActionPoint | null>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleFilterChange = (newFilters: Partial<GovernanceFilterParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const handleClearAllFilters = () => {
    setFilters({
      page: 1,
      page_size: 25,
      ordering: "-raised_date",
      view_mode: effectiveMode === "audit" ? "my_tasks" : "all",
    });
  };

  const handleMatrixCellClick = async (payload: StatusMatrixFilterPayload) => {
    // 1. Try to find matching action in already loaded actionsData
    const localMatch = actionsData?.results?.find((act) => {
      if (payload.circle_id !== undefined && payload.circle_id !== null && act.circle?.id !== payload.circle_id) return false;
      if (payload.owner_id !== undefined && payload.owner_id !== null && act.owner?.id !== payload.owner_id) return false;
      if (payload.status !== undefined && act.status !== payload.status) return false;
      if (payload.is_overdue !== undefined && act.is_overdue !== payload.is_overdue) return false;
      return true;
    });

    if (localMatch) {
      navigate(`/${effectiveMode}/tasks/${localMatch.id}`);
      return;
    }

    // 2. Fetch the matching action from API and redirect to detail page
    try {
      const res = await governanceService.getActions({
        circle_id: payload.circle_id ?? undefined,
        owner_id: payload.owner_id ?? undefined,
        status: payload.status ?? undefined,
        is_overdue: payload.is_overdue ?? undefined,
        page_size: 1,
      });
      if (res.results && res.results.length > 0) {
        navigate(`/${effectiveMode}/tasks/${res.results[0].id}`);
        return;
      }
    } catch {
      // Fallback
    }

    // 3. Fallback: filter list and scroll to table
    setFilters((prev) => ({
      ...prev,
      circle_id: payload.circle_id !== undefined ? payload.circle_id : prev.circle_id,
      owner_id: payload.owner_id !== undefined ? payload.owner_id : prev.owner_id,
      status: payload.status !== undefined ? payload.status : prev.status,
      is_overdue: payload.is_overdue !== undefined ? payload.is_overdue : prev.is_overdue,
      page: 1,
    }));
    const tableElem = document.getElementById("action-points-table");
    if (tableElem) {
      tableElem.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePeriodChange = (period: PeriodSelection) => {
    handleFilterChange({
      reporting_week: period.reporting_week,
      start_date: period.start_date,
      end_date: period.end_date,
      page: 1,
    });
  };

  const handleToggleSelectTask = (id: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTasks = (ids: number[]) => {
    setSelectedTaskIds(ids);
  };

  const handleToggleSelectEvidence = (id: number) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllEvidence = (ids: number[]) => {
    setSelectedEvidenceIds(ids);
  };

  const handleCreateOrUpdate = async (payload: CreateActionPayload | UpdateActionPayload) => {
    if (editingAction) {
      await updateActionMutation.mutateAsync({
        id: editingAction.id,
        payload: payload as UpdateActionPayload,
      });
      showToast("Task updated successfully!");
    } else {
      await createActionMutation.mutateAsync(payload as CreateActionPayload);
      showToast("New governance task created successfully!");
    }
    refetchActions();
    refetchMetrics();
  };

  const handleReviseTargetSubmit = async (id: number, payload: ReviseTargetPayload) => {
    const res = await reviseTargetMutation.mutateAsync({ id, payload });
    showToast(`Target date revised successfully (Revision #${res.revision.revision_number}).`);
    refetchActions();
    refetchMetrics();
  };

  const handleWeeklyUpdateSubmit = async (actionId: number, payload: SubmitWeeklyUpdatePayload) => {
    await submitWeeklyMutation.mutateAsync({ actionId, payload });
    showToast("Weekly progress update logged successfully!");
    refetchActions();
    refetchMetrics();
  };

  const handleUploadEvidenceSubmit = async (
    file: File,
    title: string,
    description: string,
    actionId?: number
  ) => {
    const targetId = actionId || evidenceTargetAction?.id;
    if (!targetId) return;
    const res = await uploadEvidenceMutation.mutateAsync({
      actionId: targetId,
      file,
      title,
      description,
    });
    showToast(res.message);
    refetchActions();
    refetchMetrics();
    refetchMyEvidence();
  };

  const handleReviewEvidenceSubmit = async (evidenceId: number, payload: ReviewEvidencePayload) => {
    const res = await reviewEvidenceMutation.mutateAsync({
      evidenceId,
      actionId: reviewingEvidenceItem ? reviewingEvidenceItem.action_point : 0,
      payload,
    });
    showToast(res.message);
    refetchActions();
    refetchMetrics();
    refetchMyEvidence();
  };

  const handleDownloadTemplate = async () => {
    try {
      await governanceService.downloadTemplate();
      showToast("Template downloaded successfully.");
    } catch {
      showToast("Failed to download template.", "error");
    }
  };

  const handleUploadExcel = async (file: File) => {
    const res = await uploadExcelMutation.mutateAsync(file);
    return res;
  };

  const handleRefresh = () => {
    refetchActions();
    refetchMetrics();
    refetchMyEvidence();
    refetchRevisionRequests();
    showToast("Data refreshed.");
  };

  const openBulkUpdate = (bulkMode: BulkModalMode) => {
    setBulkModalMode(bulkMode);
    setIsBulkModalOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Top Header customized per tab */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            {effectiveMode === "governance" && (
              <SecurityIcon sx={{ fontSize: 28, color: colorTokens.primary.main }} />
            )}
            {effectiveMode === "audit" && (
              <AssignmentTurnedInOutlinedIcon sx={{ fontSize: 28, color: colorTokens.primary.main }} />
            )}
            {effectiveMode === "documents" && (
              <FolderSharedOutlinedIcon sx={{ fontSize: 28, color: colorTokens.primary.main }} />
            )}
            <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.02em" }}>
              {effectiveMode === "governance" && "Governance and Action"}
              {effectiveMode === "audit" && "Audit & Action Owners"}
              {effectiveMode === "documents" && "Evidence Documents"}
            </Typography>
            {effectiveMode === "governance" && metricsData?.reporting_week && (
              <Chip
                label={`${metricsData.reporting_week} • as of ${metricsData.as_of_date || "Today"}`}
                size="small"
                sx={{
                  backgroundColor: "#F0F9FF",
                  color: colorTokens.primary.dark,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  border: "1px solid #BAE6FD",
                }}
              />
            )}
            {effectiveMode === "governance" && metricsData?.on_track_score !== undefined && (
              <Chip
                label={`${metricsData.on_track_score}% On Track`}
                size="small"
                sx={{
                  backgroundColor: metricsData.on_track_score >= 70 ? "#ECFDF5" : "#FFFBEB",
                  color: metricsData.on_track_score >= 70 ? "#065F46" : "#92400E",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  border: `1px solid ${metricsData.on_track_score >= 70 ? "#A7F3D0" : "#FDE68A"}`,
                }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            {effectiveMode === "governance" &&
              "Task creation across organization hierarchy, creator dashboard, live risk metrics, and detailed task analysis."}
            {effectiveMode === "audit" &&
              "Assigned task execution, week-wise progress reporting, blocker tracking, and revision history."}
            {effectiveMode === "documents" &&
              "Task-linked proof submission (images & PDFs), authorized review decisions, rework feedback, and document history."}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {effectiveMode === "governance" && (
            <GovernancePeriodControl
              currentReportingWeek={metricsData?.reporting_week}
              asOfDate={metricsData?.as_of_date}
              selectedWeek={filters.reporting_week}
              availableWeeks={metricsData?.available_weeks || metadata?.available_weeks || []}
              onChangePeriod={handlePeriodChange}
            />
          )}

          <Tooltip title="Refresh Data" arrow>
            <IconButton onClick={handleRefresh} size="small" sx={{ border: "1px solid #E2E8F0" }}>
              <RefreshIcon sx={{ fontSize: 20, color: colorTokens.text.secondary }} />
            </IconButton>
          </Tooltip>

          {effectiveMode === "governance" && (
            <>
              <Button
                variant="outlined"
                startIcon={<CloudDownloadOutlinedIcon />}
                onClick={async () => {
                  try {
                    await governanceService.exportGovernanceWorkbook(filters);
                    showToast("Governance & Action Tracking workbook exported successfully.");
                  } catch {
                    showToast("Failed to export workbook.", "error");
                  }
                }}
                sx={{
                  borderColor: colorTokens.workspace.border,
                  color: colorTokens.text.primary,
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
                }}
              >
                Export Workbook
              </Button>

              <Button
                variant="outlined"
                startIcon={<FileUploadOutlinedIcon />}
                onClick={() => setIsExcelModalOpen(true)}
                sx={{
                  borderColor: colorTokens.workspace.border,
                  color: colorTokens.text.primary,
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
                }}
              >
                Excel Synchronizer
              </Button>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingAction(null);
                  setIsActionModalOpen(true);
                }}
                sx={{
                  backgroundColor: colorTokens.primary.main,
                  fontWeight: 600,
                  textTransform: "none",
                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                  "&:hover": { backgroundColor: colorTokens.primary.dark },
                }}
              >
                Create Task
              </Button>
            </>
          )}

          {effectiveMode === "audit" && (
            <>
              <Button
                variant="outlined"
                startIcon={<CloudDownloadOutlinedIcon />}
                onClick={async () => {
                  try {
                    await governanceService.downloadWeeklyTemplate();
                    showToast("Downloaded weekly update template.", "success");
                  } catch (e) {
                    showToast("Failed to download template.", "error");
                  }
                }}
                sx={{
                  borderColor: colorTokens.workspace.border,
                  color: colorTokens.text.primary,
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
                }}
              >
                Download Weekly Template
              </Button>

              <Button
                variant="contained"
                startIcon={<CloudUploadOutlinedIcon />}
                onClick={() => setIsWeeklyExcelModalOpen(true)}
                sx={{
                  backgroundColor: colorTokens.primary.main,
                  fontWeight: 600,
                  textTransform: "none",
                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                  "&:hover": { backgroundColor: colorTokens.primary.dark },
                }}
              >
                Upload Weekly Updates (Excel)
              </Button>
            </>
          )}

          {effectiveMode === "documents" && (
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={() => {
                setEvidenceTargetAction(null);
                setIsEvidenceUploadOpen(true);
              }}
              sx={{
                backgroundColor: colorTokens.primary.main,
                fontWeight: 600,
                textTransform: "none",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                "&:hover": { backgroundColor: colorTokens.primary.dark },
              }}
            >
              Upload Proof / Evidence
            </Button>
          )}
        </Box>
      </Box>

      {/* Dynamic Summary Metrics Bar in Native MAPAR Theme */}
      {effectiveMode !== "documents" && (
        <GovernanceMetricsBar
          metrics={metricsData}
          isLoading={isLoadingMetrics}
          activeFilter={{
            status: filters.status,
            evidence_status: filters.evidence_status,
            is_escalated: filters.is_escalated,
            is_overdue: filters.is_overdue,
            is_due_soon: filters.is_due_soon,
            priority: filters.priority,
          }}
          onFilterChange={(metricFilter) => {
            handleFilterChange({
              status: metricFilter.status,
              evidence_status: metricFilter.evidence_status,
              is_escalated: metricFilter.is_escalated,
              is_overdue: metricFilter.is_overdue,
              is_due_soon: metricFilter.is_due_soon,
              priority: metricFilter.priority,
              page: 1,
            });
          }}
        />
      )}

      {/* Active Filters Synchronization Bar */}
      <GovernanceActiveFiltersBar
        filters={filters}
        metadata={metadata}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAllFilters}
      />

      {/* Executive Analytical Core in Native MAPAR Theme */}
      {effectiveMode === "governance" && (
        <Box sx={{ mb: 3 }}>
          {/* Action Status Matrix */}
          <GovernanceStatusMatrix
            metrics={metricsData}
            isLoading={isLoadingMetrics}
            activeCircleId={filters.circle_id}
            activeOwnerId={filters.owner_id}
            activeStatus={filters.status}
            activeOverdue={filters.is_overdue}
            onCellClick={handleMatrixCellClick}
          />

          {/* Target Timeline & Urgent Follow-up Execution Card */}
          <Box sx={{ mt: 2.5 }}>
            <GovernanceExecutionCard
              timeline={metricsData?.target_timeline || []}
              urgentItems={metricsData?.urgent_items || []}
              isLoading={isLoadingMetrics}
              onSelectAction={(actionId) => navigate(`/${effectiveMode}/tasks/${actionId}`)}
            />
          </Box>
        </Box>
      )}


      {effectiveMode === "audit" && (
        <GovernanceOwnerDashboardCard
          myProgress={metricsData?.my_progress_metrics}
          isLoading={isLoadingMetrics}
          onQuickFilter={(qFilter) => {
            handleFilterChange({
              status: qFilter.status,
              is_overdue: qFilter.is_overdue,
              view_mode: (qFilter.view_mode as any) || "my_tasks",
              page: 1,
            });
          }}
        />
      )}

      {/* Quick View Mode Filters for Governance and Action */}
      {effectiveMode === "governance" && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Button
            size="small"
            variant={filters.view_mode === "all" ? "contained" : "outlined"}
            onClick={() => handleFilterChange({ view_mode: "all", page: 1 })}
            sx={{ textTransform: "none", fontSize: "0.78rem" }}
          >
            All Enterprise Tasks
          </Button>
          <Button
            size="small"
            variant={filters.view_mode === "created_by_me" ? "contained" : "outlined"}
            onClick={() => handleFilterChange({ view_mode: "created_by_me", page: 1 })}
            sx={{ textTransform: "none", fontSize: "0.78rem" }}
          >
            Tasks Created by Me ({metricsData?.created_by_me_count || 0})
          </Button>
          <Button
            size="small"
            variant={filters.view_mode === "revision_requests" ? "contained" : "outlined"}
            onClick={() => handleFilterChange({ view_mode: "revision_requests" as any, page: 1 })}
            sx={{
              textTransform: "none",
              fontSize: "0.78rem",
              fontWeight: 700,
              backgroundColor: filters.view_mode === "revision_requests" ? colorTokens.primary.main : "transparent",
              color: filters.view_mode === "revision_requests" ? "#FFFFFF" : colorTokens.text.primary,
            }}
          >
            Target Date Revision Requests ({revisionRequestsData?.pending_count || 0})
          </Button>
        </Box>
      )}

      {/* Quick View Mode Filters for Audit & Action Owners */}
      {effectiveMode === "audit" && (
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant={filters.view_mode === "my_tasks" ? "contained" : "outlined"}
            onClick={() => handleFilterChange({ view_mode: "my_tasks", page: 1 })}
            sx={{ textTransform: "none", fontSize: "0.78rem" }}
          >
            My Assigned Tasks
          </Button>
          <Button
            size="small"
            variant={filters.view_mode === "missing_weekly" ? "contained" : "outlined"}
            onClick={() => handleFilterChange({ view_mode: "missing_weekly", page: 1 })}
            sx={{ textTransform: "none", fontSize: "0.78rem" }}
          >
            Missing Weekly Updates ({metricsData?.missing_weekly_count || 0})
          </Button>
          <Button
            size="small"
            variant={filters.view_mode === "all" ? "contained" : "outlined"}
            onClick={() => handleFilterChange({ view_mode: "all", page: 1 })}
            sx={{ textTransform: "none", fontSize: "0.78rem" }}
          >
            All Tasks in Scope
          </Button>
        </Box>
      )}

      {/* View Mode Switching: Revision Requests Table OR Tasks Table OR Evidence Table */}
      {effectiveMode === "governance" && (filters.view_mode as string) === "revision_requests" ? (
        <RevisionRequestsTable
          requests={revisionRequestsData?.results || []}
          totalCount={revisionRequestsData?.count || 0}
          pendingCount={revisionRequestsData?.pending_count || 0}
          page={revRequestsPage}
          pageSize={revRequestsPageSize}
          statusFilter={revRequestsStatus}
          search={revRequestsSearch}
          isLoading={isLoadingRevisionRequests}
          currentUserId={currentUser?.id}
          onPageChange={(p) => setRevRequestsPage(p)}
          onPageSizeChange={(ps) => setRevRequestsPageSize(ps)}
          onStatusFilterChange={(st) => setRevRequestsStatus(st)}
          onSearchChange={(sc) => setRevRequestsSearch(sc)}
          onOpenTask={(actId) => navigate(`/governance/tasks/${actId}`)}
          onReview={(req) => {
            setSelectedRequestForReview(req);
            setIsReviewDialogOpen(true);
          }}
        />
      ) : effectiveMode === "governance" || effectiveMode === "audit" ? (
        <Box id="action-points-table">
          <GovernanceTable
          actions={actionsData?.results || []}
          totalCount={actionsData?.count || 0}
          filters={filters}
          metadata={metadata}
          isLoading={isLoadingActions}
          selectedTaskIds={selectedTaskIds}
          onToggleSelectTask={handleToggleSelectTask}
          onSelectAllTasks={handleSelectAllTasks}
          onOpenBulkModal={() => openBulkUpdate(effectiveMode === "audit" ? "weekly" : "actions")}
          onFilterChange={handleFilterChange}
          onSelectAction={(action) => navigate(`/${effectiveMode}/tasks/${action.id}`)}
          onEditAction={(action) => {
            setEditingAction(action);
            setIsActionModalOpen(true);
          }}
          onReviseTarget={(action) => {
            if (effectiveMode === "audit") {
              setActionForRevisionRequest(action);
              setIsRequestRevisionOpen(true);
            } else {
              setRevisingAction(action);
              setIsRevisionModalOpen(true);
            }
          }}
          onUploadEvidence={(action) => {
            setEvidenceTargetAction(action);
            setIsEvidenceUploadOpen(true);
          }}
          onOpenWeeklyModal={(action) => {
            setWeeklyTargetAction(action);
            setIsWeeklyModalOpen(true);
          }}
        />
        </Box>
      ) : (
        /* TAB 3: Evidence Documents Table */
        <MyEvidenceTable
          evidenceList={myEvidenceData?.results || []}
          totalCount={myEvidenceData?.count || 0}
          page={myEvidencePage}
          pageSize={myEvidencePageSize}
          search={myEvidenceSearch}
          isLoading={isLoadingMyEvidence}
          selectedEvidenceIds={selectedEvidenceIds}
          onToggleSelectEvidence={handleToggleSelectEvidence}
          onSelectAllEvidence={handleSelectAllEvidence}
          onOpenBulkReviewModal={() => openBulkUpdate("evidence")}
          onSearchChange={(search) => setMyEvidenceSearch(search)}
          onPageChange={(page) => setMyEvidencePage(page)}
          onPageSizeChange={(pageSize) => setMyEvidencePageSize(pageSize)}
          onSelectActionById={(actionId) => navigate(`/documents/tasks/${actionId}`)}
          onReviewItem={(item) => {
            setReviewingEvidenceItem(item);
            setIsEvidenceReviewOpen(true);
          }}
        />
      )}


      {/* Modals */}
      <GovernanceActionModal
        open={isActionModalOpen}
        action={editingAction}
        metadata={metadata}
        isLoading={createActionMutation.isPending || updateActionMutation.isPending}
        onClose={() => {
          setIsActionModalOpen(false);
          setEditingAction(null);
        }}
        onSubmit={handleCreateOrUpdate}
        onRequireEvidence={(act) => {
          setIsActionModalOpen(false);
          setMandatoryEvidenceAction(act);
        }}
      />

      <GovernanceRevisionModal
        open={isRevisionModalOpen}
        action={revisingAction}
        isLoading={reviseTargetMutation.isPending}
        onClose={() => {
          setIsRevisionModalOpen(false);
          setRevisingAction(null);
        }}
        onSubmit={handleReviseTargetSubmit}
      />

      <GovernanceWeeklyUpdateModal
        open={isWeeklyModalOpen}
        action={weeklyTargetAction}
        isLoading={submitWeeklyMutation.isPending}
        onClose={() => {
          setIsWeeklyModalOpen(false);
          setWeeklyTargetAction(null);
        }}
        onSubmit={handleWeeklyUpdateSubmit}
        onRequireEvidence={(act) => {
          setIsWeeklyModalOpen(false);
          setMandatoryEvidenceAction(act);
        }}
      />

      <MandatoryEvidenceClosureModal
        open={Boolean(mandatoryEvidenceAction)}
        action={mandatoryEvidenceAction}
        onClose={() => setMandatoryEvidenceAction(null)}
        onEvidenceUploaded={() => {
          setMandatoryEvidenceAction(null);
          refetchActions();
          refetchMetrics();
          showToast("Evidence submitted. Pending review before final closure.");
        }}
      />

      <GovernanceBulkUpdateModal
        open={isBulkModalOpen}
        mode={bulkModalMode}
        selectedIds={bulkModalMode === "evidence" ? selectedEvidenceIds : selectedTaskIds}
        users={metadata?.users || []}
        onClose={() => {
          setIsBulkModalOpen(false);
          setSelectedTaskIds([]);
          setSelectedEvidenceIds([]);
          refetchActions();
          refetchMetrics();
          refetchMyEvidence();
        }}
        onBulkUpdateActions={async (payload) => {
          const res = await bulkUpdateActionsMutation.mutateAsync(payload);
          refetchActions();
          refetchMetrics();
          return res;
        }}
        onBulkSubmitWeekly={async (payload) => {
          const res = await bulkSubmitWeeklyMutation.mutateAsync(payload);
          refetchActions();
          refetchMetrics();
          return res;
        }}
        onBulkReviewEvidence={async (payload) => {
          const res = await bulkReviewEvidenceMutation.mutateAsync(payload);
          refetchMyEvidence();
          refetchMetrics();
          return res;
        }}
      />

      <GovernanceEvidenceUploadModal
        open={isEvidenceUploadOpen}
        action={evidenceTargetAction}
        availableActions={actionsData?.results || []}
        isLoading={uploadEvidenceMutation.isPending}
        onClose={() => {
          setIsEvidenceUploadOpen(false);
          setEvidenceTargetAction(null);
        }}
        onSubmit={handleUploadEvidenceSubmit}
      />

      <GovernanceEvidenceReviewModal
        open={isEvidenceReviewOpen}
        evidence={reviewingEvidenceItem}
        isLoading={reviewEvidenceMutation.isPending}
        onClose={() => {
          setIsEvidenceReviewOpen(false);
          setReviewingEvidenceItem(null);
        }}
        onSubmit={handleReviewEvidenceSubmit}
      />

      <GovernanceWeeklyExcelModal
        open={isWeeklyExcelModalOpen}
        onClose={() => setIsWeeklyExcelModalOpen(false)}
        onSuccess={() => {
          handleRefresh();
          showToast("Weekly task updates imported successfully!");
        }}
      />

      <GovernanceExcelModal
        open={isExcelModalOpen}
        isLoading={uploadExcelMutation.isPending}
        onClose={() => setIsExcelModalOpen(false)}
        onDownloadTemplate={handleDownloadTemplate}
        onUpload={handleUploadExcel}
        onSuccess={() => {
          refetchActions();
          refetchMetrics();
          showToast("Excel records imported successfully.");
        }}
      />

      {/* Target Date Revision Request Modal (for Audit & Action Owners) */}
      <RequestTargetRevisionModal
        open={isRequestRevisionOpen}
        action={actionForRevisionRequest}
        onClose={() => {
          setIsRequestRevisionOpen(false);
          setActionForRevisionRequest(null);
        }}
        onSubmit={async (actId, requestedDate, reason) => {
          const res = await submitRevisionRequestMutation.mutateAsync({
            actionId: actId,
            payload: { requested_target_date: requestedDate, reason },
          });
          showToast(res.message);
          refetchActions();
          refetchMetrics();
          refetchRevisionRequests();
        }}
      />

      {/* Target Date Revision Request Review Dialog (for Governance reviewers) */}
      <ReviewRevisionRequestDialog
        open={isReviewDialogOpen}
        request={selectedRequestForReview}
        currentUserId={currentUser?.id}
        onClose={() => {
          setIsReviewDialogOpen(false);
          setSelectedRequestForReview(null);
        }}
        onSubmit={async (requestId, decision, comment) => {
          const res = await reviewRevisionRequestMutation.mutateAsync({
            requestId,
            actionId: selectedRequestForReview?.action_point,
            payload: { decision, reviewer_comment: comment },
          });
          showToast(res.message);
          refetchActions();
          refetchMetrics();
          refetchRevisionRequests();
        }}
      />

      {/* Global Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
