import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import ButtonBase from "@mui/material/ButtonBase";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FactCheckIcon from "@mui/icons-material/FactCheck";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { MyProgressMetrics } from "../types/governance.types";

interface GovernanceOwnerDashboardCardProps {
  myProgress?: MyProgressMetrics;
  isLoading?: boolean;
  onQuickFilter: (filter: {
    status?: string;
    is_overdue?: boolean;
    is_due_soon?: boolean;
    view_mode?: string;
  }) => void;
}

export const GovernanceOwnerDashboardCard: React.FC<GovernanceOwnerDashboardCardProps> = ({
  myProgress,
  isLoading = false,
  onQuickFilter,
}) => {
  if (isLoading || !myProgress) {
    return null;
  }

  const {
    total = 0,
    open = 0,
    wip = 0,
    closed = 0,
    overdue = 0,
    upcoming = 0,
    missing_weekly = 0,
    completion_rate = 0,
    evidence_pending = 0,
    evidence_accepted = 0,
    evidence_rework = 0,
    evidence_not_submitted = 0,
  } = myProgress;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: radiusTokens.lg,
        border: `1px solid ${colorTokens.workspace.border}`,
        background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              backgroundColor: "rgba(2, 132, 199, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colorTokens.primary.main,
            }}
          >
            <AssignmentIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, lineHeight: 1.2 }}>
              My Assigned Workload & Progress
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Real-time summary of your assigned governance tasks, deliverables, and closure targets
            </Typography>
          </Box>
        </Box>

        {/* Completion Rate Pill */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", fontSize: "0.72rem" }}>
              COMPLETION RATE
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.status.success.main, lineHeight: 1 }}>
              {completion_rate}%
            </Typography>
          </Box>
          <Box sx={{ width: 100 }}>
            <LinearProgress
              variant="determinate"
              value={completion_rate}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: "#E2E8F0",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 4,
                  backgroundColor: colorTokens.status.success.main,
                },
              }}
            />
            <Typography variant="caption" sx={{ fontSize: "0.68rem", color: colorTokens.text.muted, textAlign: "center", display: "block", mt: 0.25 }}>
              {closed} of {total} closed
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Metrics Cards Grid */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {/* Total Assigned */}
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <ButtonBase
            onClick={() => onQuickFilter({ view_mode: "my_tasks" })}
            sx={{
              width: "100%",
              p: 1.5,
              borderRadius: radiusTokens.md,
              border: `1px solid ${colorTokens.workspace.border}`,
              backgroundColor: "#FFF",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
            }}
          >
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, fontSize: "0.7rem" }}>
              TOTAL ASSIGNED
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, my: 0.25 }}>
              {total}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.68rem" }}>
              All assigned items
            </Typography>
          </ButtonBase>
        </Grid>

        {/* WIP (In Progress) */}
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <ButtonBase
            onClick={() => onQuickFilter({ status: "WIP", view_mode: "my_tasks" })}
            sx={{
              width: "100%",
              p: 1.5,
              borderRadius: radiusTokens.md,
              border: "1px solid #BAE6FD",
              backgroundColor: "#F0F9FF",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#E0F2FE" },
            }}
          >
            <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 700, fontSize: "0.7rem" }}>
              IN PROGRESS (WIP)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0284C7", my: 0.25 }}>
              {wip}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.68rem" }}>
              Actively executing
            </Typography>
          </ButtonBase>
        </Grid>

        {/* Closed / Completed */}
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <ButtonBase
            onClick={() => onQuickFilter({ status: "Closed", view_mode: "my_tasks" })}
            sx={{
              width: "100%",
              p: 1.5,
              borderRadius: radiusTokens.md,
              border: "1px solid #BBF7D0",
              backgroundColor: "#F0FDF4",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: "#16A34A", backgroundColor: "#DCFCE7" },
            }}
          >
            <Typography variant="caption" sx={{ color: "#15803D", fontWeight: 700, fontSize: "0.7rem" }}>
              COMPLETED
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#16A34A", my: 0.25 }}>
              {closed}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.68rem" }}>
              Verified & closed
            </Typography>
          </ButtonBase>
        </Grid>

        {/* Overdue */}
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <ButtonBase
            onClick={() => onQuickFilter({ is_overdue: true, view_mode: "my_tasks" })}
            sx={{
              width: "100%",
              p: 1.5,
              borderRadius: radiusTokens.md,
              border: overdue > 0 ? "1px solid #FECACA" : `1px solid ${colorTokens.workspace.border}`,
              backgroundColor: overdue > 0 ? "#FEF2F2" : "#FFF",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: colorTokens.status.error.main, backgroundColor: "#FEE2E2" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: overdue > 0 ? "#DC2626" : colorTokens.text.muted, fontWeight: 700, fontSize: "0.7rem" }}>
                OVERDUE
              </Typography>
              {overdue > 0 && <WarningAmberIcon sx={{ fontSize: 13, color: "#DC2626" }} />}
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: overdue > 0 ? "#DC2626" : colorTokens.text.primary, my: 0.25 }}>
              {overdue}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.68rem" }}>
              Past closure date
            </Typography>
          </ButtonBase>
        </Grid>

        {/* Approaching Deadline (Next 7 Days) */}
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <ButtonBase
            onClick={() => onQuickFilter({ is_due_soon: true, view_mode: "my_tasks" })}
            sx={{
              width: "100%",
              p: 1.5,
              borderRadius: radiusTokens.md,
              border: "1px solid #FED7AA",
              backgroundColor: "#FFF7ED",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: "#EA580C", backgroundColor: "#FFEDD5" },
            }}
          >
            <Typography variant="caption" sx={{ color: "#C2410C", fontWeight: 700, fontSize: "0.7rem" }}>
              DUE IN 7 DAYS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#EA580C", my: 0.25 }}>
              {upcoming}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.68rem" }}>
              Approaching target
            </Typography>
          </ButtonBase>
        </Grid>

        {/* Missing Weekly Updates */}
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <ButtonBase
            onClick={() => onQuickFilter({ view_mode: "missing_weekly" })}
            sx={{
              width: "100%",
              p: 1.5,
              borderRadius: radiusTokens.md,
              border: missing_weekly > 0 ? "1px solid #FED7AA" : `1px solid ${colorTokens.workspace.border}`,
              backgroundColor: missing_weekly > 0 ? "#FFFBEB" : "#FFF",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: "#D97706", backgroundColor: "#FEF3C7" },
            }}
          >
            <Typography variant="caption" sx={{ color: missing_weekly > 0 ? "#B45309" : colorTokens.text.muted, fontWeight: 700, fontSize: "0.7rem" }}>
              NEEDS WEEKLY UPDATE
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: missing_weekly > 0 ? "#D97706" : colorTokens.text.primary, my: 0.25 }}>
              {missing_weekly}
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.68rem" }}>
              Pending reports
            </Typography>
          </ButtonBase>
        </Grid>
      </Grid>

      {/* Evidence Verification Strip */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          p: 1.5,
          borderRadius: radiusTokens.md,
          backgroundColor: "#FFF",
          border: `1px solid ${colorTokens.workspace.border}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FactCheckIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.8rem" }}>
            Evidence & Audit Proof Status:
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip
            size="small"
            label={`Accepted: ${evidence_accepted}`}
            sx={{ backgroundColor: "#DCFCE7", color: "#15803D", fontWeight: 700, fontSize: "0.72rem" }}
          />
          <Chip
            size="small"
            label={`Pending Review: ${evidence_pending}`}
            sx={{ backgroundColor: "#E0F2FE", color: "#0369A1", fontWeight: 700, fontSize: "0.72rem" }}
          />
          {evidence_rework > 0 && (
            <Chip
              size="small"
              label={`Rework Needed: ${evidence_rework}`}
              sx={{ backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: "0.72rem" }}
            />
          )}
          <Chip
            size="small"
            label={`Not Submitted: ${evidence_not_submitted}`}
            sx={{ backgroundColor: "#F1F5F9", color: "#64748B", fontWeight: 600, fontSize: "0.72rem" }}
          />
        </Box>
      </Box>
    </Paper>
  );
};
