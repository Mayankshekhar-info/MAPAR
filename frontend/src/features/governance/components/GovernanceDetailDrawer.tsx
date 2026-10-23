import React from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CloseIcon from "@mui/icons-material/Close";
import UpdateOutlinedIcon from "@mui/icons-material/UpdateOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceActionPoint, GovernanceEvidenceItem } from "../types/governance.types";
import { governanceService } from "../api/governanceService";

interface GovernanceDetailDrawerProps {
  open: boolean;
  action: GovernanceActionPoint | null;
  onClose: () => void;
  onEdit?: (action: GovernanceActionPoint) => void;
  onReviseTarget: (action: GovernanceActionPoint) => void;
  onUploadEvidence: (action: GovernanceActionPoint) => void;
  onReviewEvidence: (evidence: GovernanceEvidenceItem) => void;
}

export const GovernanceDetailDrawer: React.FC<GovernanceDetailDrawerProps> = ({
  open,
  action,
  onClose,
  onEdit,
  onReviseTarget,
  onUploadEvidence,
  onReviewEvidence,
}) => {
  if (!action) return null;

  const handleDownloadFile = async (item: GovernanceEvidenceItem) => {
    try {
      await governanceService.downloadEvidence(item.id, item.file_name);
    } catch {
      alert("Failed to download evidence file.");
    }
  };

  const getEvidenceChip = (status: string) => {
    switch (status) {
      case "Accepted":
        return (
          <Chip
            label="Accepted"
            size="small"
            sx={{
              backgroundColor: "#ECFDF5",
              color: "#047857",
              fontWeight: 700,
              fontSize: "0.72rem",
            }}
          />
        );
      case "Rework Required":
        return (
          <Chip
            label="Rework Required"
            size="small"
            sx={{
              backgroundColor: "#FEE2E2",
              color: "#B91C1C",
              fontWeight: 700,
              fontSize: "0.72rem",
            }}
          />
        );
      case "Pending Review":
        return (
          <Chip
            label="Pending Review"
            size="small"
            sx={{
              backgroundColor: "#FEF3C7",
              color: "#B45309",
              fontWeight: 700,
              fontSize: "0.72rem",
            }}
          />
        );
      default:
        return (
          <Chip
            label="Not Submitted"
            size="small"
            sx={{
              backgroundColor: "#F1F5F9",
              color: "#64748B",
              fontSize: "0.72rem",
            }}
          />
        );
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 580 },
          p: 0,
          backgroundColor: colorTokens.workspace.background,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          backgroundColor: colorTokens.workspace.surface,
          borderBottom: "1px solid",
          borderColor: colorTokens.workspace.border,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.primary.main }}>
              {action.action_id}
            </Typography>
            <Chip
              label={action.status}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: "0.72rem",
                backgroundColor:
                  action.status === "Closed"
                    ? "#ECFDF5"
                    : action.status === "WIP"
                    ? "#FEF3C7"
                    : "#EFF6FF",
                color:
                  action.status === "Closed"
                    ? "#047857"
                    : action.status === "WIP"
                    ? "#B45309"
                    : "#1D4ED8",
              }}
            />
            {getEvidenceChip(action.evidence_status)}
            <Chip
              label={`${action.priority} Priority`}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: "0.72rem",
                backgroundColor: action.priority === "High" ? "#FEE2E2" : "#F1F5F9",
                color: action.priority === "High" ? "#B91C1C" : "#475569",
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            {action.circle?.name} ({action.circle?.code}) • {action.function_area}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Body Content */}
      <Box sx={{ p: 2.5, overflowY: "auto", flex: 1 }}>
        {action.is_escalated && (
          <Alert
            severity="error"
            icon={<WarningAmberOutlinedIcon />}
            sx={{ mb: 2.5, borderRadius: radiusTokens.md }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Escalated to Business Head
            </Typography>
            <Typography variant="caption">
              This action point has been active for {action.ageing_days} days (&gt;30 days) without closure.
            </Typography>
          </Alert>
        )}

        {action.evidence_status === "Rework Required" && (
          <Alert severity="warning" sx={{ mb: 2.5, borderRadius: radiusTokens.md }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Evidence Rework Required
            </Typography>
            <Typography variant="caption">
              The reviewer requested corrections. Inspect the review notes below and upload a revised version.
            </Typography>
          </Alert>
        )}

        {/* Action Details Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: radiusTokens.md,
            border: "1px solid",
            borderColor: colorTokens.workspace.border,
            backgroundColor: colorTokens.workspace.surface,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
            Action Description
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, mb: 2, lineHeight: 1.5 }}>
            {action.action_point}
          </Typography>

          {action.key_deliverable && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
                Key Requirement / Deliverable
              </Typography>
              <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 2, lineHeight: 1.4 }}>
                {action.key_deliverable}
              </Typography>
            </>
          )}

          {action.last_update && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
                Latest Update / Progress Notes
              </Typography>
              <Typography variant="body2" sx={{ color: colorTokens.text.secondary, lineHeight: 1.4, fontStyle: "italic" }}>
                "{action.last_update}"
              </Typography>
            </>
          )}
        </Paper>

        {/* Assignment & Responsibility */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: radiusTokens.md,
            border: "1px solid",
            borderColor: colorTokens.workspace.border,
            backgroundColor: colorTokens.workspace.surface,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1.5 }}>
            Assignment & Responsibility
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Assigned Owner:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {action.owner?.full_name || action.owner_name_override || "Unassigned"}
              </Typography>
              {action.owner?.email && (
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  {action.owner.email}
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Delegated / Assigned By:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {action.assigned_by?.full_name || "System"}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Dynamic Tracking Metrics Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: radiusTokens.md,
            border: "1px solid",
            borderColor: colorTokens.workspace.border,
            backgroundColor: colorTokens.workspace.surface,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1.5 }}>
            Workbook Metrics & Tracking
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Raised Date:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {action.raised_date}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Current Target:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  color: action.is_overdue ? colorTokens.status.error.main : colorTokens.text.primary,
                }}
              >
                {action.current_target_date}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Ageing (Days):
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: action.ageing_days > 30 ? "#DC2626" : "inherit" }}>
                {action.ageing_days} days
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Ageing Bucket:
              </Typography>
              <Chip label={action.ageing_bucket} size="small" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600 }} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Weeks in Review:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Week {action.weeks_in_review}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Revision Count:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {action.revision_count}
              </Typography>
            </Box>
            <Box sx={{ gridColumn: { xs: "span 2", sm: "span 2" } }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Evidence Status:
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                {getEvidenceChip(action.evidence_status)}
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  {action.evidence_required ? "(Required for closure)" : "(Optional)"}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Evidence Submission & Review History Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: radiusTokens.md,
            border: "1px solid",
            borderColor: colorTokens.workspace.border,
            backgroundColor: colorTokens.workspace.surface,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FactCheckOutlinedIcon sx={{ color: colorTokens.primary.main, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                Evidence Submissions & Proof ({action.evidence_items?.length || 0})
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={() => onUploadEvidence(action)}
              sx={{
                fontSize: "0.75rem",
                backgroundColor: colorTokens.primary.main,
                "&:hover": { backgroundColor: colorTokens.primary.dark },
              }}
            >
              Upload Proof
            </Button>
          </Box>

          {!action.evidence_items || action.evidence_items.length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center", backgroundColor: "#F8FAFC", borderRadius: radiusTokens.sm, border: "1px dashed #CBD5E1" }}>
              <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 500, mb: 0.5 }}>
                No evidence has been submitted yet.
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                The assigned owner can upload supporting proof files (PDF, Excel, Word, Image) to initiate review.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {action.evidence_items.map((ev) => (
                <Box
                  key={ev.id}
                  sx={{
                    p: 1.75,
                    backgroundColor: "#F8FAFC",
                    borderRadius: radiusTokens.sm,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip label={`v${ev.version}`} size="small" sx={{ fontWeight: 700, height: 20, fontSize: "0.7rem", backgroundColor: "#EFF6FF", color: "#1D4ED8" }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        {ev.title}
                      </Typography>
                    </Box>
                    {getEvidenceChip(ev.status)}
                  </Box>

                  {ev.description && (
                    <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.82rem", mb: 1 }}>
                      "{ev.description}"
                    </Typography>
                  )}

                  <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 1, pt: 0.5, borderTop: "1px solid #EEF2F6" }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                        Submitted: {new Date(ev.submitted_at).toLocaleString()} by {ev.submitted_by?.full_name || "User"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        File: {ev.file_name} ({(ev.file_size / 1024).toFixed(1)} KB)
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadOutlinedIcon />}
                        onClick={() => handleDownloadFile(ev)}
                        sx={{ fontSize: "0.72rem" }}
                      >
                        Download
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<RateReviewOutlinedIcon />}
                        onClick={() => onReviewEvidence(ev)}
                        sx={{ fontSize: "0.72rem" }}
                      >
                        Review
                      </Button>
                    </Box>
                  </Box>

                  {/* Review feedback section if reviewed */}
                  {ev.reviewed_by && (
                    <Box sx={{ mt: 1.25, p: 1.25, backgroundColor: ev.status === "Accepted" ? "#ECFDF5" : "#FEF2F2", borderRadius: radiusTokens.xs }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: ev.status === "Accepted" ? "#065F46" : "#991B1B", display: "block" }}>
                        Reviewer Feedback ({ev.reviewed_by.full_name} • {ev.reviewed_at ? new Date(ev.reviewed_at).toLocaleDateString() : ""}):
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.78rem", color: ev.status === "Accepted" ? "#047857" : "#B91C1C", fontStyle: "italic" }}>
                        "{ev.review_comment || "No written notes."}"
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {/* Target Revision History Section */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: radiusTokens.md,
            border: "1px solid",
            borderColor: colorTokens.workspace.border,
            backgroundColor: colorTokens.workspace.surface,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <HistoryOutlinedIcon sx={{ color: colorTokens.primary.main, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                Target Revision History ({action.revisions?.length || 0})
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UpdateOutlinedIcon />}
              onClick={() => onReviseTarget(action)}
              sx={{ fontSize: "0.75rem" }}
            >
              Revise Target
            </Button>
          </Box>

          {!action.revisions || action.revisions.length === 0 ? (
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", py: 1 }}>
              No revisions recorded. Initial target date: {action.target_closure_date}.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {action.revisions.map((rev) => (
                <Box
                  key={rev.id}
                  sx={{
                    p: 1.5,
                    backgroundColor: "#F8FAFC",
                    borderRadius: radiusTokens.sm,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.primary.dark }}>
                      Revision #{rev.revision_number} • {rev.revision_date}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, textDecoration: "line-through" }}>
                        {rev.previous_target}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.primary.main }}>
                        → {rev.revised_target}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: "0.8rem", color: colorTokens.text.secondary, mb: 0.5 }}>
                    <strong>Reason:</strong> {rev.reason}
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                      Revised by: {rev.revised_by?.full_name || rev.revised_by?.username || "Authorized User"}
                    </Typography>
                    {rev.approved_by && (
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        Approved by: {rev.approved_by}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>

      {/* Footer Controls */}
      <Box
        sx={{
          p: 2,
          backgroundColor: colorTokens.workspace.surface,
          borderTop: "1px solid",
          borderColor: colorTokens.workspace.border,
          display: "flex",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Button
          variant="outlined"
          startIcon={<CloudUploadOutlinedIcon />}
          onClick={() => onUploadEvidence(action)}
          sx={{ flex: 1 }}
        >
          Upload Proof
        </Button>
        <Button
          variant="contained"
          startIcon={<UpdateOutlinedIcon />}
          onClick={() => onReviseTarget(action)}
          sx={{
            flex: 1,
            backgroundColor: colorTokens.primary.main,
            "&:hover": { backgroundColor: colorTokens.primary.dark },
          }}
        >
          {window.location.pathname.startsWith("/audit") ? "Request Revision" : "Revise Target"}
        </Button>
      </Box>
    </Drawer>
  );
};
