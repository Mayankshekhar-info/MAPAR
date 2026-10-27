import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DownloadIcon from "@mui/icons-material/Download";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import RateReviewIcon from "@mui/icons-material/RateReview";
import SendIcon from "@mui/icons-material/Send";
import VerifiedIcon from "@mui/icons-material/Verified";
import dayjs from "dayjs";


import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import {
  useTaskFullDetail,
  useSubmitWeeklyUpdate,
  useUploadEvidence,
  useReviewEvidence,
  useReviseTarget,
  useUpdateGovernanceAction,
  useSubmitTargetRevisionRequest,
  useReviewTargetRevisionRequest,
} from "../hooks/useGovernance";
import { useAuth } from "../../auth";
import { governanceService } from "../api/governanceService";
import { ProgressTrendChart } from "../components/ProgressTrendChart";
import { WeeklyProgressTimeline } from "../components/WeeklyProgressTimeline";
import { GovernanceWeeklyUpdateModal } from "../components/GovernanceWeeklyUpdateModal";
import { GovernanceEvidenceUploadModal } from "../components/GovernanceEvidenceUploadModal";
import { GovernanceEvidenceReviewModal } from "../components/GovernanceEvidenceReviewModal";
import { GovernanceRevisionModal } from "../components/GovernanceRevisionModal";
import { RequestTargetRevisionModal } from "../components/RequestTargetRevisionModal";
import { ReviewRevisionRequestDialog } from "../components/ReviewRevisionRequestDialog";
import { MandatoryEvidenceClosureModal } from "../components/MandatoryEvidenceClosureModal";
import { SendTaskEmailModal } from "../components/SendTaskEmailModal";
import { AssignTaskReviewModal } from "../components/AssignTaskReviewModal";
import { SubmitTaskReviewModal } from "../components/SubmitTaskReviewModal";
import { SubmitForVerificationModal } from "../components/SubmitForVerificationModal";
import { VerifyReviewModal } from "../components/VerifyReviewModal";
import { ApproveReviewModal } from "../components/ApproveReviewModal";
import { TaskReviewsCard } from "../components/TaskReviewsCard";
import {
  GovernanceEvidenceItem,
  SubmitWeeklyUpdatePayload,
  ReviseTargetPayload,
  ReviewEvidencePayload,
  GovernanceTargetRevisionRequest,
  GovernanceTaskReview,
} from "../types/governance.types";


export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuditMode = location.pathname.startsWith("/audit");
  const isDocsMode = location.pathname.startsWith("/documents");
  const taskId = id ? parseInt(id, 10) : null;

  const { user: currentUser } = useAuth();
  const { data, isLoading, error, refetch } = useTaskFullDetail(taskId);

  // Mutations
  const submitWeeklyMutation = useSubmitWeeklyUpdate();
  const uploadEvidenceMutation = useUploadEvidence();
  const reviewEvidenceMutation = useReviewEvidence();
  const reviseTargetMutation = useReviseTarget();
  const updateActionMutation = useUpdateGovernanceAction();
  const submitRevisionRequestMutation = useSubmitTargetRevisionRequest();
  const reviewRevisionRequestMutation = useReviewTargetRevisionRequest();

  // Modals
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [isEvidenceUploadOpen, setIsEvidenceUploadOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isRequestRevisionOpen, setIsRequestRevisionOpen] = useState(false);
  const [isReviewRevisionDialogOpen, setIsReviewRevisionDialogOpen] = useState(false);
  const [selectedRevisionRequestForReview, setSelectedRevisionRequestForReview] = useState<GovernanceTargetRevisionRequest | null>(null);
  const [isEvidenceReviewOpen, setIsEvidenceReviewOpen] = useState(false);
  const [isMandatoryEvidenceModalOpen, setIsMandatoryEvidenceModalOpen] = useState(false);
  const [selectedEvidenceForReview, setSelectedEvidenceForReview] = useState<GovernanceEvidenceItem | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAssignReviewOpen, setIsAssignReviewOpen] = useState(false);
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [selectedReviewForSubmit, setSelectedReviewForSubmit] = useState<GovernanceTaskReview | null>(null);
  const [isSubmitForVerificationOpen, setIsSubmitForVerificationOpen] = useState(false);
  const [isVerifyReviewOpen, setIsVerifyReviewOpen] = useState(false);
  const [isApproveReviewOpen, setIsApproveReviewOpen] = useState(false);

  const [notification, setNotification] = useState<{ message: string; severity: "success" | "error" } | null>(null);


  if (isLoading) {
    return (
      <Box sx={{ p: 6, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress size={36} sx={{ color: colorTokens.primary.main }} />
      </Box>
    );
  }

  if (error || !data || !data.action) {
    const backPath = isAuditMode ? "/audit" : isDocsMode ? "/documents" : "/governance";
    return (
      <Box sx={{ p: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backPath)}
          sx={{ mb: 2, color: colorTokens.text.secondary }}
        >
          {isAuditMode
            ? "Back to Audit & Action Owners"
            : isDocsMode
            ? "Back to Evidence Documents"
            : "Back to Governance Dashboard"}
        </Button>
        <Alert severity="error">
          Failed to load task details or outside authorized organizational scope.
        </Alert>
      </Box>
    );
  }

  const {
    action,
    resolved_hierarchy_path,
    weekly_updates,
    progress_trend,
    revisions,
    evidence_items,
    revision_requests = [],
    task_reviews = [],
    active_review = null,
    can_assign_review = true,
    can_submit_for_verification = false,
    can_verify_review = false,
    can_approve_review = false,
    can_close_task = true,
    closure_block_reason = null,
    can_submit_review = false,
    can_review_revision = false,
    can_request_revision = false,
    can_review_evidence = false,
    has_pending_revision = false,
  } = data;


  const handleDownloadEvidence = async (ev: GovernanceEvidenceItem) => {
    try {
      await governanceService.downloadEvidence(ev.id, ev.file_name);
    } catch {
      setNotification({ message: "Failed to download file.", severity: "error" });
    }
  };

  const handleOpenReview = (ev: GovernanceEvidenceItem) => {
    setSelectedEvidenceForReview(ev);
    setIsEvidenceReviewOpen(true);
  };

  const handleAttemptClose = async () => {
    // Task closure allowed if review is approved or review submitted, or none
    const allowedReviewStatuses = ["Approved", "Review Submitted", "Awaiting Final Approval", "None"];
    if (action.review_workflow_status && !allowedReviewStatuses.includes(action.review_workflow_status)) {
      setNotification({
        message: "Task closure is not allowed until reviewer verification and approval or review submission are completed.",
        severity: "error",
      });
      return;
    }
    if (action.evidence_required && action.evidence_status !== "Accepted") {
      setIsMandatoryEvidenceModalOpen(true);
      return;
    }
    try {
      await updateActionMutation.mutateAsync({
        id: action.id,
        payload: { status: "Closed" },
      });
      setNotification({ message: "Task marked as Closed successfully.", severity: "success" });
      refetch();
    } catch (err: any) {
      const msg =
        err.response?.data?.status?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to close task.";
      if (msg.toLowerCase().includes("evidence")) {
        setIsMandatoryEvidenceModalOpen(true);
      } else {
        setNotification({ message: msg, severity: "error" });
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, margin: "0 auto" }}>
      {/* Notification */}
      {notification && (
        <Alert
          severity={notification.severity}
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      )}

      {/* Top Navigation & Breadcrumb */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => {
            if (isAuditMode) navigate("/audit");
            else if (isDocsMode) navigate("/documents");
            else navigate("/governance");
          }}
          size="small"
          sx={{ color: colorTokens.text.secondary, fontWeight: 600, textTransform: "none" }}
        >
          {isAuditMode
            ? "Back to Audit & Action Owners"
            : isDocsMode
            ? "Back to Evidence Documents"
            : "Back to Governance Dashboard"}
        </Button>
      </Box>

      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: colorTokens.workspace.surface,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
          {/* Title and ID */}
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1 }}>
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.01em" }}
              >
                {action.action_id}
              </Typography>
              <Chip
                label={action.status}
                sx={{
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  backgroundColor:
                    action.status === "Closed"
                      ? `${colorTokens.status.success.main}15`
                      : action.status === "WIP"
                      ? `${colorTokens.primary.main}15`
                      : `${colorTokens.status.warning.main}15`,
                  color:
                    action.status === "Closed"
                      ? colorTokens.status.success.main
                      : action.status === "WIP"
                      ? colorTokens.primary.main
                      : colorTokens.status.warning.main,
                }}
              />
              {action.review_workflow_status && action.review_workflow_status !== "None" && (
                <Chip
                  label={`Workflow: ${action.review_workflow_status}`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    backgroundColor:
                      action.review_workflow_status === "Approved"
                        ? "#F0FDF4"
                        : action.review_workflow_status === "Rework Required"
                        ? "#FEF2F2"
                        : action.review_workflow_status === "Awaiting Final Approval"
                        ? "#F0F9FF"
                        : "#EFF6FF",
                    color:
                      action.review_workflow_status === "Approved"
                        ? "#166534"
                        : action.review_workflow_status === "Rework Required"
                        ? "#991B1B"
                        : action.review_workflow_status === "Awaiting Final Approval"
                        ? "#0369A1"
                        : "#1D4ED8",
                    border: `1px solid ${
                      action.review_workflow_status === "Approved"
                        ? "#BBF7D0"
                        : action.review_workflow_status === "Rework Required"
                        ? "#FECACA"
                        : action.review_workflow_status === "Awaiting Final Approval"
                        ? "#BAE6FD"
                        : "#BFDBFE"
                    }`,
                  }}
                />
              )}
              <Chip
                label={`Priority: ${action.priority}`}
                sx={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  backgroundColor:
                    action.priority === "High"
                      ? `${colorTokens.status.error.main}15`
                      : action.priority === "Medium"
                      ? `${colorTokens.status.warning.main}15`
                      : colorTokens.workspace.borderSubtle,
                  color:
                    action.priority === "High"
                      ? colorTokens.status.error.main
                      : action.priority === "Medium"
                      ? colorTokens.status.warning.main
                      : colorTokens.text.secondary,
                }}
              />
              <Chip
                label={`${action.ageing_days} Days Ageing (${action.ageing_bucket})`}
                size="small"
                sx={{ fontSize: "0.72rem", backgroundColor: colorTokens.secondary.lighter, color: colorTokens.text.secondary }}
              />
              {action.is_overdue && (
                <Chip
                  icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                  label="Overdue"
                  size="small"
                  sx={{ backgroundColor: `${colorTokens.status.error.main}15`, color: colorTokens.status.error.main, fontWeight: 700 }}
                />
              )}
              {action.is_escalated && (
                <Chip
                  label="Escalated (>30 Days)"
                  size="small"
                  sx={{ backgroundColor: `${colorTokens.status.error.main}20`, color: colorTokens.status.error.main, fontWeight: 800 }}
                />
              )}
              {action.bucket && (
                <Chip
                  label={`Bucket: ${action.bucket}`}
                  size="small"
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    backgroundColor: "#EFF6FF",
                    color: "#1D4ED8",
                    border: "1px solid #DBEAFE",
                  }}
                />
              )}
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
              {action.action_point}
            </Typography>
          </Box>

          {/* Quick Action Buttons */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            {/* Close Task: Governance Only (Never allowed in Audit Mode) */}
            {!isAuditMode && action.status !== "Closed" && (() => {
              const allowedReviewStatuses = ["Approved", "Review Submitted", "Awaiting Final Approval", "None"];
              const isClosureReviewSatisfied = !action.review_workflow_status || allowedReviewStatuses.includes(action.review_workflow_status);
              const isEvidenceSatisfied = !action.evidence_required || action.evidence_status === "Accepted";
              const isClosureBlocked = !isClosureReviewSatisfied || !isEvidenceSatisfied;

              return (
                <Tooltip
                  title={
                    !isClosureReviewSatisfied
                      ? "Task closure is not allowed until reviewer verification and approval or review submission are completed."
                      : !isEvidenceSatisfied
                      ? "Required evidence must be Accepted before closure."
                      : "Close this task"
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      startIcon={isClosureBlocked ? <LockOutlinedIcon /> : <CheckCircleIcon />}
                      onClick={handleAttemptClose}
                      disabled={updateActionMutation.isPending || isClosureBlocked}
                      sx={{
                        backgroundColor: isClosureBlocked ? "#94A3B8" : colorTokens.status.success.main,
                        color: "#fff",
                        borderRadius: radiusTokens.sm,
                        fontWeight: 700,
                        textTransform: "none",
                        "&:hover": {
                          backgroundColor: isClosureBlocked ? "#94A3B8" : colorTokens.status.success.text,
                        },
                      }}
                    >
                      Close Task
                    </Button>
                  </span>
                </Tooltip>
              );
            })()}

            {/* Governance Only Decision Buttons */}
            {!isAuditMode && action.status !== "Closed" && can_submit_for_verification && (
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => setIsSubmitForVerificationOpen(true)}
                sx={{
                  backgroundColor: "#2563EB",
                  color: "#fff",
                  borderRadius: radiusTokens.sm,
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#1D4ED8" },
                }}
              >
                Submit for Review
              </Button>
            )}

            {!isAuditMode && action.status !== "Closed" && can_verify_review && (
              <Button
                variant="contained"
                startIcon={<FactCheckIcon />}
                onClick={() => setIsVerifyReviewOpen(true)}
                sx={{
                  backgroundColor: "#0284C7",
                  color: "#fff",
                  borderRadius: radiusTokens.sm,
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#0369A1" },
                }}
              >
                Verify Task
              </Button>
            )}

            {!isAuditMode && action.status !== "Closed" && can_approve_review && (
              <Button
                variant="contained"
                startIcon={<VerifiedIcon />}
                onClick={() => setIsApproveReviewOpen(true)}
                sx={{
                  backgroundColor: colorTokens.status.success.main,
                  color: "#fff",
                  borderRadius: radiusTokens.sm,
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": { backgroundColor: colorTokens.status.success.text },
                }}
              >
                Decision / Return for Rework
              </Button>
            )}

            <Button
              variant="outlined"
              startIcon={<EventRepeatIcon />}
              onClick={() => setIsWeeklyModalOpen(true)}
              sx={{
                color: colorTokens.primary.main,
                borderColor: colorTokens.primary.main,
                borderRadius: radiusTokens.sm,
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              Log Weekly Update
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => setIsEvidenceUploadOpen(true)}
              sx={{
                color: colorTokens.text.primary,
                borderColor: colorTokens.workspace.border,
                borderRadius: radiusTokens.sm,
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              Upload Proof
            </Button>
            <Button
              variant="outlined"
              startIcon={<EmailOutlinedIcon />}
              onClick={() => setIsEmailModalOpen(true)}
              sx={{
                color: colorTokens.primary.main,
                borderColor: colorTokens.workspace.border,
                borderRadius: radiusTokens.sm,
                fontWeight: 600,
                textTransform: "none",
                "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
              }}
            >
              Send Email
            </Button>
            {!isAuditMode && can_assign_review && (
              <Button
                variant="outlined"
                startIcon={<FactCheckIcon />}
                onClick={() => setIsAssignReviewOpen(true)}
                sx={{
                  color: colorTokens.primary.main,
                  borderColor: colorTokens.workspace.border,
                  borderRadius: radiusTokens.sm,
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
                }}
              >
                {task_reviews.length > 0 ? "Reassign for Review" : "Assign for Review"}
              </Button>
            )}
            {can_submit_review && active_review && (
              <Button
                variant="contained"
                startIcon={<RateReviewIcon />}
                onClick={() => {
                  setSelectedReviewForSubmit(active_review);
                  setIsSubmitReviewOpen(true);
                }}
                sx={{
                  backgroundColor: colorTokens.primary.main,
                  color: "#fff",
                  borderRadius: radiusTokens.sm,
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": { backgroundColor: colorTokens.primary.dark },
                }}
              >
                {active_review.status === "Review Submitted" ? "Update Review Findings" : "Submit Review"}
              </Button>
            )}
            {/* Target Date Action: In Audit mode or for assignees, offer Request Target Date Revision */}

            {isAuditMode || !can_review_revision ? (
              <Tooltip
                title={
                  has_pending_revision
                    ? "A target date revision request is already pending Governance review."
                    : "Request an extension to the target closure date."
                }
              >
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<EventRepeatIcon />}
                    onClick={() => setIsRequestRevisionOpen(true)}
                    disabled={has_pending_revision}
                    sx={{
                      color: has_pending_revision ? colorTokens.text.muted : colorTokens.primary.main,
                      borderColor: has_pending_revision ? colorTokens.workspace.border : colorTokens.primary.main,
                      borderRadius: radiusTokens.sm,
                      fontWeight: 600,
                      textTransform: "none",
                    }}
                  >
                    {has_pending_revision ? "Revision Pending Review" : "Request Target Date Revision"}
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                variant="outlined"
                startIcon={<EditCalendarIcon />}
                onClick={() => setIsRevisionModalOpen(true)}
                sx={{
                  color: colorTokens.text.primary,
                  borderColor: colorTokens.workspace.border,
                  borderRadius: radiusTokens.sm,
                  fontWeight: 600,
                  textTransform: "none",
                }}
              >
                Revise Target Date
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Main Grid: Details & Visuals */}
      <Grid container spacing={3}>
        {/* Left Column: Metadata & Weekly History */}
        <Grid size={{ xs: 12, md: 7 }}>
          {/* Key Deliverable & Scope Box */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: radiusTokens.md,
              border: `1px solid ${colorTokens.workspace.border}`,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
              Key Deliverable & Target
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.primary, mb: 2, whiteSpace: "pre-wrap" }}>
              {action.key_deliverable || "No specific deliverable statement provided."}
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 2, pt: 1, borderTop: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Assigned Owner
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {action.owner?.full_name || action.owner_name_override || "Unassigned"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Created By
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {action.created_by?.full_name || action.assigned_by?.full_name || "System"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Raised Date
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {action.raised_date}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Current Target Date
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: action.is_overdue ? colorTokens.status.error.main : colorTokens.text.primary }}>
                  {action.current_target_date}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Bucket
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: action.bucket ? colorTokens.primary.main : colorTokens.text.primary }}>
                  {action.bucket || "—"}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Progress Trend Chart */}
          <Box sx={{ mb: 3 }}>
            <ProgressTrendChart
              progressTrend={progress_trend}
              currentProgress={action.current_progress_percent}
              status={action.status}
              isOverdue={action.is_overdue}
            />
          </Box>

          {/* Weekly Updates Timeline */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: radiusTokens.md,
              border: `1px solid ${colorTokens.workspace.border}`,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                Weekly Progress Reports
              </Typography>
              <Button
                size="small"
                startIcon={<EventRepeatIcon />}
                onClick={() => setIsWeeklyModalOpen(true)}
                sx={{ color: colorTokens.primary.main, fontWeight: 600, textTransform: "none" }}
              >
                + Add Week
              </Button>
            </Box>
            <WeeklyProgressTimeline updates={weekly_updates} />
          </Paper>
        </Grid>

        {/* Right Column: Evidence Proofs & Revision History */}
        <Grid size={{ xs: 12, md: 5 }}>
          {/* Dedicated Task Review & Reviewer Notes Card */}
          <TaskReviewsCard
            taskReviews={task_reviews}
            activeReview={active_review}
            workflowStatus={action.review_workflow_status}
            isAuditMode={isAuditMode}
            canAssignReview={!isAuditMode && can_assign_review}
            canSubmitForVerification={!isAuditMode && can_submit_for_verification}
            canVerifyReview={!isAuditMode && can_verify_review}
            canApproveReview={!isAuditMode && can_approve_review}
            canSubmitReview={can_submit_review}
            onOpenAssignModal={() => setIsAssignReviewOpen(true)}
            onOpenSubmitModal={(rev) => {
              setSelectedReviewForSubmit(rev);
              setIsSubmitReviewOpen(true);
            }}
            onOpenSubmitVerificationModal={() => setIsSubmitForVerificationOpen(true)}
            onOpenVerifyModal={() => setIsVerifyReviewOpen(true)}
            onOpenApproveModal={() => setIsApproveReviewOpen(true)}
          />

          {/* Supporting Evidence Proofs Card */}

          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: radiusTokens.md,
              border: `1px solid ${colorTokens.workspace.border}`,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "1rem" }}>
                    Supporting Evidence Proof
                  </Typography>
                  <Chip
                    label={evidence_items.length}
                    size="small"
                    sx={{
                      height: 20,
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      backgroundColor: colorTokens.workspace.borderSubtle,
                      color: colorTokens.text.secondary,
                      borderRadius: "10px",
                    }}
                  />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 500 }}>
                    Overall Status:
                  </Typography>
                  <Chip
                    label={action.evidence_status}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      backgroundColor:
                        action.evidence_status === "Accepted"
                          ? colorTokens.status.success.light
                          : action.evidence_status === "Pending Review"
                          ? colorTokens.status.warning.light
                          : action.evidence_status === "Rework Required"
                          ? colorTokens.status.error.light
                          : colorTokens.status.neutral.light,
                      color:
                        action.evidence_status === "Accepted"
                          ? colorTokens.status.success.text
                          : action.evidence_status === "Pending Review"
                          ? colorTokens.status.warning.text
                          : action.evidence_status === "Rework Required"
                          ? colorTokens.status.error.text
                          : colorTokens.status.neutral.text,
                      border: `1px solid ${
                        action.evidence_status === "Accepted"
                          ? colorTokens.status.success.border
                          : action.evidence_status === "Pending Review"
                          ? colorTokens.status.warning.border
                          : action.evidence_status === "Rework Required"
                          ? colorTokens.status.error.border
                          : colorTokens.status.neutral.border
                      }`,
                    }}
                  />
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => setIsEvidenceUploadOpen(true)}
                sx={{
                  borderColor: colorTokens.primary.light,
                  color: colorTokens.primary.main,
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: radiusTokens.sm,
                  backgroundColor: "#FFFFFF",
                  "&:hover": {
                    borderColor: colorTokens.primary.main,
                    backgroundColor: colorTokens.primary.lighter,
                  },
                }}
              >
                Upload Proof
              </Button>
            </Box>

            {evidence_items.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", backgroundColor: "#F8FAFC", borderRadius: radiusTokens.sm }}>
                <UploadFileIcon sx={{ fontSize: 32, color: colorTokens.text.muted, mb: 1 }} />
                <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.muted }}>
                  No supporting documents or pictures uploaded yet.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {evidence_items.map((ev) => (
                  <Box
                    key={ev.id}
                    sx={{
                      p: 2,
                      borderRadius: radiusTokens.md,
                      border: `1px solid ${colorTokens.workspace.border}`,
                      backgroundColor: "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        borderColor: colorTokens.primary.light,
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                      },
                    }}
                  >
                    {/* Header: Title, Version, Uploader Info & Status Chip */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: colorTokens.primary.lighter,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: colorTokens.primary.main,
                            flexShrink: 0,
                            mt: 0.25,
                          }}
                        >
                          <DescriptionOutlinedIcon fontSize="small" />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              color: colorTokens.text.primary,
                              fontSize: "0.92rem",
                              lineHeight: 1.3,
                            }}
                          >
                            {ev.title}{" "}
                            <Box
                              component="span"
                              sx={{
                                ml: 0.5,
                                px: 0.75,
                                py: 0.2,
                                backgroundColor: "#F1F5F9",
                                borderRadius: "4px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: colorTokens.text.secondary,
                              }}
                            >
                              v{ev.version}
                            </Box>
                          </Typography>
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 0.25 }}>
                            Uploaded by {ev.submitted_by?.full_name || "Assignee"}
                            {ev.submitted_at ? ` • ${dayjs(ev.submitted_at).format("DD MMM YYYY, HH:mm")}` : ""}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Status Chip */}
                      <Chip
                        icon={
                          ev.status === "Accepted" ? (
                            <CheckCircleOutlineIcon sx={{ fontSize: "14px !important", color: `${colorTokens.status.success.main} !important` }} />
                          ) : ev.status === "Pending Review" ? (
                            <HourglassEmptyIcon sx={{ fontSize: "14px !important", color: `${colorTokens.status.warning.main} !important` }} />
                          ) : (
                            <ErrorOutlineIcon sx={{ fontSize: "14px !important", color: `${colorTokens.status.error.main} !important` }} />
                          )
                        }
                        label={ev.status}
                        size="small"
                        sx={{
                          height: 24,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          backgroundColor:
                            ev.status === "Accepted"
                              ? colorTokens.status.success.light
                              : ev.status === "Pending Review"
                              ? colorTokens.status.warning.light
                              : colorTokens.status.error.light,
                          color:
                            ev.status === "Accepted"
                              ? colorTokens.status.success.text
                              : ev.status === "Pending Review"
                              ? colorTokens.status.warning.text
                              : colorTokens.status.error.text,
                          border: `1px solid ${
                            ev.status === "Accepted"
                              ? colorTokens.status.success.border
                              : ev.status === "Pending Review"
                              ? colorTokens.status.warning.border
                              : colorTokens.status.error.border
                          }`,
                        }}
                      />
                    </Box>

                    {/* Description (if provided) */}
                    {ev.description && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: colorTokens.text.secondary,
                          fontSize: "0.825rem",
                          mt: 1.5,
                          p: 1.25,
                          backgroundColor: "#F8FAFC",
                          borderRadius: radiusTokens.sm,
                          border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                        }}
                      >
                        {ev.description}
                      </Typography>
                    )}

                    {/* Attached File Row with Dedicated Download Button */}
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.25,
                        px: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#F8FAFC",
                        borderRadius: radiusTokens.sm,
                        border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, mr: 1 }}>
                        <DescriptionOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main, flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: colorTokens.text.primary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={ev.file_name}
                        >
                          {ev.file_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, flexShrink: 0 }}>
                          • {(ev.file_size / 1024).toFixed(1)} KB
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                        onClick={() => handleDownloadEvidence(ev)}
                        sx={{
                          flexShrink: 0,
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          height: 28,
                          px: 1.25,
                          borderColor: colorTokens.workspace.border,
                          color: colorTokens.primary.main,
                          backgroundColor: "#FFFFFF",
                          "&:hover": {
                            borderColor: colorTokens.primary.main,
                            backgroundColor: colorTokens.primary.lighter,
                          },
                        }}
                      >
                        Download
                      </Button>
                    </Box>

                    {/* Review Feedback Banner */}
                    {ev.review_comment && (
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1.5,
                          borderRadius: radiusTokens.sm,
                          backgroundColor:
                            ev.status === "Accepted"
                              ? colorTokens.status.success.light
                              : ev.status === "Rework Required"
                              ? colorTokens.status.error.light
                              : "#F8FAFC",
                          border: `1px solid ${
                            ev.status === "Accepted"
                              ? colorTokens.status.success.border
                              : ev.status === "Rework Required"
                              ? colorTokens.status.error.border
                              : colorTokens.workspace.border
                          }`,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            {ev.status === "Accepted" ? (
                              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: colorTokens.status.success.main }} />
                            ) : (
                              <ErrorOutlineIcon sx={{ fontSize: 16, color: colorTokens.status.error.main }} />
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color:
                                  ev.status === "Accepted"
                                    ? colorTokens.status.success.text
                                    : colorTokens.status.error.text,
                              }}
                            >
                              Review Feedback ({ev.reviewed_by?.full_name || "Reviewer"}):
                            </Typography>
                          </Box>
                          {ev.reviewed_at && (
                            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                              {dayjs(ev.reviewed_at).format("DD MMM YYYY, HH:mm")}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            color:
                              ev.status === "Accepted"
                                ? colorTokens.status.success.text
                                : colorTokens.status.error.text,
                            lineHeight: 1.5,
                            pl: 2.75,
                          }}
                        >
                          {ev.review_comment}
                        </Typography>
                      </Box>
                    )}

                    {/* Dedicated Review & Confirmation Action Footer */}
                    <Box
                      sx={{
                        mt: 2,
                        pt: 1.5,
                        borderTop: `1px solid ${colorTokens.workspace.borderSubtle}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        {ev.status === "Pending Review" && (
                          <Typography variant="caption" sx={{ color: colorTokens.status.warning.text, fontWeight: 600 }}>
                            Awaiting verification & sign-off
                          </Typography>
                        )}
                        {ev.status === "Accepted" && (
                          <Typography variant="caption" sx={{ color: colorTokens.status.success.text, fontWeight: 600 }}>
                            Verified & Accepted
                          </Typography>
                        )}
                        {ev.status === "Rework Required" && (
                          <Typography variant="caption" sx={{ color: colorTokens.status.error.text, fontWeight: 600 }}>
                            Rework required by action owner
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {/* Evidence Review: Strict separation of duties */}
                        {ev.submitted_by?.id === currentUser?.id ? (
                          <Tooltip title="Uploaders cannot approve or review their own uploaded evidence (Separation of Duties enforced)">
                            <Chip
                              icon={<LockOutlinedIcon sx={{ fontSize: "14px !important", color: `${colorTokens.text.muted} !important` }} />}
                              label="Uploader (Self-review locked)"
                              size="small"
                              sx={{
                                backgroundColor: "#F1F5F9",
                                color: colorTokens.text.secondary,
                                fontWeight: 600,
                                fontSize: "0.72rem",
                                border: `1px solid ${colorTokens.workspace.border}`,
                              }}
                            />
                          </Tooltip>
                        ) : can_review_evidence ? (
                          ev.status === "Pending Review" ? (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<FactCheckIcon />}
                              onClick={() => handleOpenReview(ev)}
                              sx={{
                                backgroundColor: colorTokens.primary.main,
                                color: "#FFFFFF",
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                px: 2.25,
                                py: 0.75,
                                height: 36,
                                borderRadius: radiusTokens.sm,
                                textTransform: "none",
                                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                                "&:hover": {
                                  backgroundColor: colorTokens.primary.dark,
                                  boxShadow: "0 4px 10px rgba(2, 132, 199, 0.4)",
                                },
                              }}
                            >
                              Review & Confirm Evidence
                            </Button>
                          ) : (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<FactCheckIcon />}
                              onClick={() => handleOpenReview(ev)}
                              sx={{
                                borderColor: colorTokens.primary.main,
                                color: colorTokens.primary.main,
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                px: 1.75,
                                py: 0.5,
                                height: 32,
                                borderRadius: radiusTokens.sm,
                                textTransform: "none",
                                backgroundColor: "#FFFFFF",
                                "&:hover": {
                                  borderColor: colorTokens.primary.dark,
                                  backgroundColor: colorTokens.primary.lighter,
                                },
                              }}
                            >
                              Update Review
                            </Button>
                          )
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* Target Date Revisions Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: radiusTokens.md,
              border: `1px solid ${colorTokens.workspace.border}`,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1.5 }}>
              Target Date Revision History
            </Typography>

            {revisions.length === 0 ? (
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                Initial target closure date ({action.target_closure_date}) has not been revised.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {revisions.map((rev) => (
                  <Box
                    key={rev.id}
                    sx={{
                      p: 1.5,
                      borderRadius: radiusTokens.sm,
                      border: `1px solid ${colorTokens.workspace.border}`,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        Revision #{rev.revision_number}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        {rev.revision_date}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: colorTokens.primary.main, fontWeight: 600 }}>
                      {rev.previous_target} → {rev.revised_target}
                    </Typography>
                    {rev.reason && (
                      <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.secondary, mt: 0.5 }}>
                        Reason: {rev.reason}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* Target Date Revision Requests Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: radiusTokens.md,
              border: `1px solid ${colorTokens.workspace.border}`,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                Revision Requests ({revision_requests.length})
              </Typography>
              {!has_pending_revision && (isAuditMode || can_request_revision) && (
                <Button
                  size="small"
                  startIcon={<EventRepeatIcon />}
                  onClick={() => setIsRequestRevisionOpen(true)}
                  sx={{ color: colorTokens.primary.main, fontWeight: 600, textTransform: "none" }}
                >
                  + Request Extension
                </Button>
              )}
            </Box>

            {revision_requests.length === 0 ? (
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                No target date revision requests submitted for this task.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {revision_requests.map((req) => {
                  const isRequester = Boolean(currentUser && req.requested_by?.id === currentUser.id);
                  const isPending = req.status === "Pending";
                  return (
                    <Box
                      key={req.id}
                      sx={{
                        p: 1.5,
                        borderRadius: radiusTokens.sm,
                        border: `1px solid ${isPending ? "#FDE68A" : colorTokens.workspace.border}`,
                        backgroundColor: isPending ? "#FFFBEB" : "#FFFFFF",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip
                            label={req.status}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              height: 20,
                              backgroundColor:
                                req.status === "Approved"
                                  ? "#DCFCE7"
                                  : req.status === "Pending"
                                  ? "#FEF3C7"
                                  : "#FEE2E2",
                              color:
                                req.status === "Approved"
                                  ? "#15803D"
                                  : req.status === "Pending"
                                  ? "#B45309"
                                  : "#B91C1C",
                            }}
                          />
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                            {new Date(req.requested_at).toLocaleDateString()}
                          </Typography>
                        </Box>

                        {/* Review Action if pending & user is authorized reviewer & not requester */}
                        {isPending && can_review_revision && !isRequester && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setSelectedRevisionRequestForReview(req);
                              setIsReviewRevisionDialogOpen(true);
                            }}
                            sx={{
                              fontSize: "0.7rem",
                              py: 0.25,
                              px: 1,
                              backgroundColor: colorTokens.primary.main,
                              textTransform: "none",
                              fontWeight: 700,
                            }}
                          >
                            Review
                          </Button>
                        )}
                      </Box>

                      <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        Requested: {req.current_target_date} →{" "}
                        <span style={{ color: colorTokens.primary.main, fontWeight: 800 }}>
                          {req.requested_target_date}
                        </span>
                      </Typography>

                      <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.secondary, mt: 0.5 }}>
                        <strong>Reason:</strong> {req.reason}
                      </Typography>

                      <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.muted, mt: 0.25 }}>
                        Submitted by: {req.requested_by?.full_name || req.requested_by?.username || "Assignee"}
                      </Typography>

                      {req.reviewed_by && (
                        <Box sx={{ mt: 1, p: 1, borderRadius: "4px", backgroundColor: "#F8FAFC", border: `1px dashed ${colorTokens.workspace.border}` }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary, display: "block" }}>
                            Decision by {req.reviewed_by.full_name || req.reviewed_by.username} ({req.status}):
                          </Typography>
                          {req.reviewer_comment && (
                            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontStyle: "italic", display: "block" }}>
                              "{req.reviewer_comment}"
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Modals */}
      <GovernanceWeeklyUpdateModal
        open={isWeeklyModalOpen}
        action={action}
        onClose={() => setIsWeeklyModalOpen(false)}
        onSubmit={async (actId, payload: SubmitWeeklyUpdatePayload) => {
          await submitWeeklyMutation.mutateAsync({ actionId: actId, payload });
          setNotification({ message: "Weekly progress update logged successfully.", severity: "success" });
          refetch();
        }}
        onRequireEvidence={(act) => {
          setIsWeeklyModalOpen(false);
          setIsMandatoryEvidenceModalOpen(true);
        }}
        isLoading={submitWeeklyMutation.isPending}
      />

      <MandatoryEvidenceClosureModal
        open={isMandatoryEvidenceModalOpen}
        action={action}
        onClose={() => setIsMandatoryEvidenceModalOpen(false)}
        onEvidenceUploaded={() => {
          setIsMandatoryEvidenceModalOpen(false);
          setNotification({ message: "Evidence submitted. Pending review before final closure.", severity: "success" });
          refetch();
        }}
      />

      <GovernanceEvidenceUploadModal
        open={isEvidenceUploadOpen}
        action={action}
        onClose={() => setIsEvidenceUploadOpen(false)}
        onSubmit={async (file: File, title: string, desc: string) => {
          if (!taskId) return;
          await uploadEvidenceMutation.mutateAsync({ actionId: taskId, file, title, description: desc });
          setNotification({ message: "Evidence uploaded successfully.", severity: "success" });
          refetch();
        }}
        isLoading={uploadEvidenceMutation.isPending}
      />

      <GovernanceRevisionModal
        open={isRevisionModalOpen}
        action={action}
        onClose={() => setIsRevisionModalOpen(false)}
        onSubmit={async (actId: number, payload: ReviseTargetPayload) => {
          await reviseTargetMutation.mutateAsync({ id: actId, payload });
          setNotification({ message: "Target date revised successfully.", severity: "success" });
          refetch();
        }}
        isLoading={reviseTargetMutation.isPending}
      />

      <GovernanceEvidenceReviewModal
        open={isEvidenceReviewOpen}
        evidence={selectedEvidenceForReview}
        onClose={() => setIsEvidenceReviewOpen(false)}
        onSubmit={async (evidenceId: number, payload: ReviewEvidencePayload) => {
          if (!taskId) return;
          await reviewEvidenceMutation.mutateAsync({
            evidenceId,
            actionId: taskId,
            payload,
          });
          setNotification({ message: `Evidence marked as ${payload.decision}.`, severity: "success" });
          refetch();
        }}
        isLoading={reviewEvidenceMutation.isPending}
      />

      <RequestTargetRevisionModal
        open={isRequestRevisionOpen}
        action={action}
        onClose={() => setIsRequestRevisionOpen(false)}
        onSubmit={async (actId: number, requestedDate: string, reason: string) => {
          const res = await submitRevisionRequestMutation.mutateAsync({
            actionId: actId,
            payload: { requested_target_date: requestedDate, reason },
          });
          setNotification({ message: res.message, severity: "success" });
          refetch();
        }}
      />

      <ReviewRevisionRequestDialog
        open={isReviewRevisionDialogOpen}
        request={selectedRevisionRequestForReview}
        currentUserId={currentUser?.id}
        onClose={() => {
          setIsReviewRevisionDialogOpen(false);
          setSelectedRevisionRequestForReview(null);
        }}
        onSubmit={async (requestId: number, decision: "Approved" | "Rejected", comment: string) => {
          const res = await reviewRevisionRequestMutation.mutateAsync({
            requestId,
            actionId: taskId || undefined,
            payload: { decision, reviewer_comment: comment },
          });
          setNotification({ message: res.message, severity: "success" });
          refetch();
        }}
      />

      <SendTaskEmailModal
        open={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        task={action}
        onSuccess={(msg) => setNotification({ message: msg, severity: "success" })}
        onError={(msg) => setNotification({ message: msg, severity: "error" })}
      />

      <AssignTaskReviewModal
        open={isAssignReviewOpen}
        onClose={() => setIsAssignReviewOpen(false)}
        actionId={action.id}
        actionIdDisplay={action.action_id}
        actionPointTitle={action.action_point}
        onSuccess={(msg) => {
          setNotification({ message: msg, severity: "success" });
          refetch();
        }}
        onError={(msg) => setNotification({ message: msg, severity: "error" })}
      />

      <SubmitTaskReviewModal
        open={isSubmitReviewOpen}
        onClose={() => {
          setIsSubmitReviewOpen(false);
          setSelectedReviewForSubmit(null);
        }}
        actionId={action.id}
        review={selectedReviewForSubmit}
        onSuccess={(msg) => {
          setNotification({ message: msg, severity: "success" });
          refetch();
        }}
        onError={(msg) => setNotification({ message: msg, severity: "error" })}
      />

      <SubmitForVerificationModal
        open={isSubmitForVerificationOpen}
        onClose={() => setIsSubmitForVerificationOpen(false)}
        actionId={action.id}
        actionIdDisplay={action.action_id}
        actionPointTitle={action.action_point}
        evidenceRequired={action.evidence_required}
        evidenceStatus={action.evidence_status}
        assignedReviewerName={action.assigned_reviewer?.full_name || action.assigned_reviewer?.username}
        onSuccess={(msg) => {
          setNotification({ message: msg, severity: "success" });
          refetch();
        }}
        onError={(msg) => setNotification({ message: msg, severity: "error" })}
      />

      <VerifyReviewModal
        open={isVerifyReviewOpen}
        onClose={() => setIsVerifyReviewOpen(false)}
        actionId={action.id}
        actionIdDisplay={action.action_id}
        actionPointTitle={action.action_point}
        ownerSubmissionNotes={active_review?.submission_notes}
        onSuccess={(msg) => {
          setNotification({ message: msg, severity: "success" });
          refetch();
        }}
        onError={(msg) => setNotification({ message: msg, severity: "error" })}
      />

      <ApproveReviewModal
        open={isApproveReviewOpen}
        onClose={() => setIsApproveReviewOpen(false)}
        actionId={action.id}
        actionIdDisplay={action.action_id}
        actionPointTitle={action.action_point}
        ownerName={action.owner?.full_name || action.owner?.username}
        reviewerName={active_review?.assigned_reviewer?.full_name || active_review?.assigned_reviewer?.username}
        reviewerNotes={active_review?.review_notes}
        onSuccess={(msg) => {
          setNotification({ message: msg, severity: "success" });
          refetch();
        }}
        onError={(msg) => setNotification({ message: msg, severity: "error" })}
      />
    </Box>
  );
};

