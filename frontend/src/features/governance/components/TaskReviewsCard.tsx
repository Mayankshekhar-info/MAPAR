import React, { useState } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import RateReviewIcon from "@mui/icons-material/RateReview";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import HistoryIcon from "@mui/icons-material/History";
import VerifiedIcon from "@mui/icons-material/Verified";
import ReplayIcon from "@mui/icons-material/Replay";
import SendIcon from "@mui/icons-material/Send";
import dayjs from "dayjs";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceTaskReview } from "../types/governance.types";

interface TaskReviewsCardProps {
  taskReviews: GovernanceTaskReview[];
  activeReview?: GovernanceTaskReview | null;
  workflowStatus?: string;
  isAuditMode?: boolean;
  canAssignReview?: boolean;
  canSubmitForVerification?: boolean;
  canVerifyReview?: boolean;
  canApproveReview?: boolean;
  canSubmitReview?: boolean;
  onOpenAssignModal: () => void;
  onOpenSubmitModal?: (review: GovernanceTaskReview) => void;
  onOpenSubmitVerificationModal?: () => void;
  onOpenVerifyModal?: () => void;
  onOpenApproveModal?: () => void;
}

export const TaskReviewsCard: React.FC<TaskReviewsCardProps> = ({
  taskReviews = [],
  activeReview,
  workflowStatus,
  isAuditMode = false,
  canAssignReview = true,
  canSubmitForVerification = false,
  canVerifyReview = false,
  canApproveReview = false,
  canSubmitReview = false,
  onOpenAssignModal,
  onOpenSubmitModal,
  onOpenSubmitVerificationModal,
  onOpenVerifyModal,
  onOpenApproveModal,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  const pastReviews = taskReviews.length > 1 ? taskReviews.slice(1) : [];

  const getStatusChip = (status: string, decision?: string) => {
    switch (status) {
      case "Approved":
        return (
          <Chip
            icon={<VerifiedIcon sx={{ fontSize: "14px !important", color: "#16A34A !important" }} />}
            label="Approved"
            size="small"
            sx={{
              bgcolor: "#F0FDF4",
              color: "#166534",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #BBF7D0",
              height: 24,
            }}
          />
        );
      case "Verified":
        return (
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: "14px !important", color: "#0284C7 !important" }} />}
            label="Verified (Awaiting Approval)"
            size="small"
            sx={{
              bgcolor: "#F0F9FF",
              color: "#0369A1",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #BAE6FD",
              height: 24,
            }}
          />
        );
      case "Review Submitted":
        return (
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: "14px !important", color: "#2563EB !important" }} />}
            label="Review Submitted"
            size="small"
            sx={{
              bgcolor: "#EFF6FF",
              color: "#1E40AF",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #BFDBFE",
              height: 24,
            }}
          />
        );
      case "Rework Required":
        return (
          <Chip
            icon={<ReplayIcon sx={{ fontSize: "14px !important", color: "#DC2626 !important" }} />}
            label="Rework Required"
            size="small"
            sx={{
              bgcolor: "#FEF2F2",
              color: "#991B1B",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #FECACA",
              height: 24,
            }}
          />
        );
      case "Submitted for Review":
        return (
          <Chip
            icon={<HourglassEmptyIcon sx={{ fontSize: "14px !important", color: "#2563EB !important" }} />}
            label="Submitted for Verification"
            size="small"
            sx={{
              bgcolor: "#EFF6FF",
              color: "#1E40AF",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #DBEAFE",
              height: 24,
            }}
          />
        );
      case "Reviewed":
        return (
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: "14px !important", color: "#16A34A !important" }} />}
            label="Reviewed"
            size="small"
            sx={{
              bgcolor: "#F0FDF4",
              color: "#166534",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #BBF7D0",
              height: 24,
            }}
          />
        );
      default:
        return (
          <Chip
            icon={<HourglassEmptyIcon sx={{ fontSize: "14px !important", color: "#D97706 !important" }} />}
            label={status || "Pending Review"}
            size="small"
            sx={{
              bgcolor: "#FFFBEB",
              color: "#92400E",
              fontWeight: 700,
              fontSize: "0.74rem",
              border: "1px solid #FDE68A",
              height: 24,
            }}
          />
        );
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: radiusTokens.sm,
              bgcolor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colorTokens.primary.main,
            }}
          >
            <FactCheckIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "1rem" }}>
                Review, Verification & Approval Workflow
              </Typography>
              <Chip
                label={taskReviews.length}
                size="small"
                sx={{
                  height: 20,
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  backgroundColor: colorTokens.workspace.borderSubtle,
                  color: colorTokens.text.secondary,
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Multi-party verification, review decisions, approver directives, and audit history
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons in header */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          {/* Reviewer submission button in Audit Mode or for assigned reviewer */}
          {canSubmitReview && onOpenSubmitModal && activeReview && (
            <Button
              variant="contained"
              size="small"
              startIcon={<RateReviewIcon sx={{ fontSize: 16 }} />}
              onClick={() => onOpenSubmitModal(activeReview)}
              sx={{
                bgcolor: colorTokens.primary.main,
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "0.8rem",
                textTransform: "none",
                borderRadius: radiusTokens.sm,
                "&:hover": { bgcolor: colorTokens.primary.dark },
              }}
            >
              {activeReview.status === "Review Submitted" ? "Update Review Findings" : "Submit Review"}
            </Button>
          )}

          {/* Governance Only Actions: Never render in Audit Mode */}
          {!isAuditMode && (
            <>
              {canSubmitForVerification && onOpenSubmitVerificationModal && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon sx={{ fontSize: 16 }} />}
                  onClick={onOpenSubmitVerificationModal}
                  sx={{
                    bgcolor: "#2563EB",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "none",
                    borderRadius: radiusTokens.sm,
                    "&:hover": { bgcolor: "#1D4ED8" },
                  }}
                >
                  Submit for Review
                </Button>
              )}

              {canVerifyReview && onOpenVerifyModal && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FactCheckIcon sx={{ fontSize: 16 }} />}
                  onClick={onOpenVerifyModal}
                  sx={{
                    bgcolor: "#0284C7",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "none",
                    borderRadius: radiusTokens.sm,
                    "&:hover": { bgcolor: "#0369A1" },
                  }}
                >
                  Verify Task
                </Button>
              )}

              {canApproveReview && onOpenApproveModal && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<VerifiedIcon sx={{ fontSize: 16 }} />}
                  onClick={onOpenApproveModal}
                  sx={{
                    bgcolor: colorTokens.status.success.main,
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "none",
                    borderRadius: radiusTokens.sm,
                    "&:hover": { bgcolor: colorTokens.status.success.text },
                  }}
                >
                  Decision / Return for Rework
                </Button>
              )}

              {canAssignReview && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FactCheckIcon />}
                  onClick={onOpenAssignModal}
                  sx={{
                    borderColor: colorTokens.primary.main,
                    color: colorTokens.primary.main,
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    textTransform: "none",
                    borderRadius: radiusTokens.sm,
                    "&:hover": {
                      bgcolor: colorTokens.primary.lighter,
                      borderColor: colorTokens.primary.dark,
                    },
                  }}
                >
                  {taskReviews.length > 0 ? "Reassign Reviewer" : "Assign for Review"}
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Content */}
      {taskReviews.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center", backgroundColor: "#F8FAFC", borderRadius: radiusTokens.sm }}>
          <RateReviewIcon sx={{ fontSize: 32, color: colorTokens.text.muted, mb: 1 }} />
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 500, mb: 0.5 }}>
            No formal review assignment requested yet for this task.
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
            Click &ldquo;Assign for Review&rdquo; to select a reviewer. The reviewer will verify deliverables before management approval.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Active / Latest Review */}
          {activeReview && (
            <Box
              sx={{
                p: 2,
                borderRadius: radiusTokens.md,
                border: "1px solid #E2E8F0",
                bgcolor:
                  activeReview.status === "Approved"
                    ? "#F0FDF4"
                    : activeReview.status === "Rework Required"
                    ? "#FEF2F2"
                    : "#FFFFFF",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.92rem" }}>
                      Current Review Cycle
                    </Typography>
                    {getStatusChip(activeReview.status, activeReview.reviewer_decision)}
                  </Box>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <PersonOutlineIcon sx={{ fontSize: 14, color: colorTokens.text.muted }} />
                    Assigned Reviewer: <strong>{activeReview.assigned_reviewer?.full_name || activeReview.assigned_reviewer?.username || "Unassigned"}</strong>
                    {activeReview.assigned_reviewer?.email ? ` (${activeReview.assigned_reviewer.email})` : ""}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 0.25 }}>
                    Assigned by {activeReview.requested_by?.full_name || "Team Lead"} • {dayjs(activeReview.assigned_at).format("DD MMM YYYY, HH:mm")}
                  </Typography>
                </Box>
              </Box>

              {/* Instructions Banner */}
              {activeReview.instructions && (
                <Box
                  sx={{
                    p: 1.5,
                    mb: 1.5,
                    borderRadius: radiusTokens.sm,
                    bgcolor: "#F0F9FF",
                    border: "1px solid #BAE6FD",
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#0369A1", display: "block", mb: 0.25 }}>
                    ASSIGNMENT INSTRUCTIONS:
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#0C4A6E", fontSize: "0.82rem" }}>
                    {activeReview.instructions}
                  </Typography>
                </Box>
              )}

              {/* Owner Submission Notes */}
              {activeReview.submission_notes && (
                <Box
                  sx={{
                    p: 1.5,
                    mb: 1.5,
                    borderRadius: radiusTokens.sm,
                    bgcolor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#1E40AF" }}>
                      OWNER SUBMISSION FOR VERIFICATION:
                    </Typography>
                    {activeReview.submitted_for_verification_at && (
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        {dayjs(activeReview.submitted_for_verification_at).format("DD MMM YYYY, HH:mm")}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ color: "#1E3A8A", fontSize: "0.84rem", whiteSpace: "pre-wrap" }}>
                    {activeReview.submission_notes}
                  </Typography>
                </Box>
              )}

              {/* Reviewer Feedback Notes / Findings */}
              {activeReview.review_notes && (
                <Box
                  sx={{
                    p: 1.5,
                    mb: activeReview.recommendations || activeReview.approver_comments ? 1.5 : 0,
                    borderRadius: radiusTokens.sm,
                    bgcolor: activeReview.reviewer_decision === "Verified" ? "#F0FDF4" : "#F8FAFC",
                    border: `1px solid ${activeReview.reviewer_decision === "Verified" ? "#BBF7D0" : "#E2E8F0"}`,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: activeReview.reviewer_decision === "Verified" ? "#166534" : colorTokens.text.primary,
                      }}
                    >
                      REVIEWER FINDINGS & OBSERVATIONS:
                    </Typography>
                    {activeReview.submitted_at && (
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        Submitted {dayjs(activeReview.submitted_at).format("DD MMM YYYY, HH:mm")}
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: activeReview.reviewer_decision === "Verified" ? "#14532D" : colorTokens.text.secondary,
                      fontSize: "0.85rem",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {activeReview.review_notes}
                  </Typography>
                </Box>
              )}

              {/* Reviewer Recommendations & Corrective Actions */}
              {activeReview.recommendations && (
                <Box
                  sx={{
                    p: 1.5,
                    mb: activeReview.approver_comments ? 1.5 : 0,
                    borderRadius: radiusTokens.sm,
                    bgcolor: "#F0F9FF",
                    border: "1px solid #BAE6FD",
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#0369A1", display: "block", mb: 0.5 }}>
                    REVIEWER RECOMMENDATIONS & CORRECTIVE ACTIONS:
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#0C4A6E", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                    {activeReview.recommendations}
                  </Typography>
                </Box>
              )}

              {/* Approver Directives */}
              {activeReview.approver_comments && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: radiusTokens.sm,
                    bgcolor: activeReview.approver_decision === "Approved" ? "#F0FDF4" : "#FEF2F2",
                    border: `1px solid ${activeReview.approver_decision === "Approved" ? "#86EFAC" : "#FECACA"}`,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: activeReview.approver_decision === "Approved" ? "#15803D" : "#B91C1C",
                      }}
                    >
                      FINAL GOVERNANCE DECISION ({activeReview.approver_decision}):
                    </Typography>
                    {activeReview.approved_at && (
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        {dayjs(activeReview.approved_at).format("DD MMM YYYY, HH:mm")}
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: activeReview.approver_decision === "Approved" ? "#14532D" : "#7F1D1D",
                      fontSize: "0.85rem",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {activeReview.approver_comments}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Previous Review History Accordion */}
          {pastReviews.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                onClick={() => setShowHistory(!showHistory)}
                startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
                endIcon={showHistory ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                sx={{
                  color: colorTokens.text.secondary,
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  textTransform: "none",
                  p: 0,
                  mb: 1,
                  "&:hover": { color: colorTokens.primary.main, bgcolor: "transparent" },
                }}
              >
                {showHistory ? "Hide Previous Review History" : `Show Previous Review History (${pastReviews.length})`}
              </Button>

              <Collapse in={showHistory}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pl: 1, borderLeft: "2px solid #E2E8F0" }}>
                  {pastReviews.map((rev) => (
                    <Box
                      key={rev.id}
                      sx={{
                        p: 1.5,
                        borderRadius: radiusTokens.sm,
                        border: "1px solid #E2E8F0",
                        bgcolor: "#F8FAFC",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                          Review by {rev.assigned_reviewer?.full_name || rev.assigned_reviewer?.username || "Reviewer"}
                        </Typography>
                        {getStatusChip(rev.status, rev.reviewer_decision)}
                      </Box>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 0.75 }}>
                        Assigned {dayjs(rev.assigned_at).format("DD MMM YYYY")} by {rev.requested_by?.full_name || "Team Lead"}
                        {rev.submitted_at ? ` • Submitted ${dayjs(rev.submitted_at).format("DD MMM YYYY")}` : ""}
                      </Typography>
                      {rev.instructions && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mb: 0.5 }}>
                          <strong>Instructions:</strong> {rev.instructions}
                        </Typography>
                      )}
                      {rev.submission_notes && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 0.5 }}>
                          <strong>Submission Note:</strong> {rev.submission_notes}
                        </Typography>
                      )}
                      {rev.review_notes && (
                        <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontSize: "0.82rem", bgcolor: "#FFFFFF", p: 1, borderRadius: "4px", border: "1px solid #E2E8F0", mb: 0.5 }}>
                          <strong>Reviewer Findings:</strong> {rev.review_notes}
                        </Typography>
                      )}
                      {rev.recommendations && (
                        <Typography variant="body2" sx={{ color: "#0C4A6E", fontSize: "0.82rem", bgcolor: "#F0F9FF", p: 1, borderRadius: "4px", border: "1px solid #BAE6FD", mb: 0.5 }}>
                          <strong>Recommendations:</strong> {rev.recommendations}
                        </Typography>
                      )}
                      {rev.approver_comments && (
                        <Typography variant="body2" sx={{ color: "#15803D", fontSize: "0.82rem", bgcolor: "#F0FDF4", p: 1, borderRadius: "4px", border: "1px solid #BBF7D0" }}>
                          <strong>Approver Directives:</strong> {rev.approver_comments}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};
