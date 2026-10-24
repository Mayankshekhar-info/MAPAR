import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { ContextObservation, ContextAction } from "../types/cockpit.types";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

interface ObservationActionPanelProps {
  observations: ContextObservation[];
  actions: ContextAction[];
}

export const ObservationActionPanel: React.FC<ObservationActionPanelProps> = ({
  observations,
  actions,
}) => {
  return (
    <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Key Observations Section */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: "#FFFFFF",
          borderRadius: radiusTokens.md,
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <WarningAmberIcon fontSize="small" sx={{ color: colorTokens.status.warning.main }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.82rem" }}>
            KEY OBSERVATION & ROOT CAUSE
          </Typography>
          <Chip
            label={`${observations.length}`}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.62rem",
              fontWeight: 700,
              bgcolor: "rgba(245, 158, 11, 0.12)",
              color: colorTokens.status.warning.main,
            }}
          />
        </Box>

        {observations.length === 0 ? (
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontStyle: "italic" }}>
            No significant operational observations reported for this context.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {observations.map((obs) => (
              <Box
                key={obs.id}
                sx={{
                  p: 1.2,
                  bgcolor: "#FEF3C7",
                  borderLeft: `3px solid ${colorTokens.status.warning.main}`,
                  borderRadius: radiusTokens.sm,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#92400E", fontSize: "0.78rem" }}>
                    {obs.code}: {obs.title}
                  </Typography>
                  <Chip
                    label={obs.severity}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      bgcolor: obs.severity === "CRITICAL" ? "#FEE2E2" : "#FEF3C7",
                      color: obs.severity === "CRITICAL" ? "#991B1B" : "#B45309",
                    }}
                  />
                </Box>
                {obs.root_cause && (
                  <Typography variant="caption" sx={{ display: "block", color: "#78350F", fontSize: "0.72rem" }}>
                    <strong>Root Cause:</strong> {obs.root_cause}
                  </Typography>
                )}
                {obs.owner && (
                  <Typography variant="caption" sx={{ display: "block", color: "#78350F", fontSize: "0.7rem", mt: 0.4 }}>
                    Owner: {obs.owner} {obs.target_date ? `• Target: ${obs.target_date}` : ""}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Action Taken Section */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: "#FFFFFF",
          borderRadius: radiusTokens.md,
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <AssignmentTurnedInIcon fontSize="small" sx={{ color: colorTokens.status.success.main }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.82rem" }}>
            ACTION TAKEN & REMEDIATION
          </Typography>
          <Chip
            label={`${actions.length}`}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.62rem",
              fontWeight: 700,
              bgcolor: "rgba(16, 185, 129, 0.12)",
              color: colorTokens.status.success.main,
            }}
          />
        </Box>

        {actions.length === 0 ? (
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontStyle: "italic" }}>
            No open corrective actions assigned for this context.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {actions.map((act) => (
              <Box
                key={act.id}
                sx={{
                  p: 1.2,
                  bgcolor: "#F0FDF4",
                  borderLeft: `3px solid ${colorTokens.status.success.main}`,
                  borderRadius: radiusTokens.sm,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#166534", fontSize: "0.78rem" }}>
                    {act.code} — {act.owner}
                  </Typography>
                  <Chip
                    label={act.status}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      bgcolor: act.status === "OVERDUE" ? "#FEE2E2" : "#DCFCE7",
                      color: act.status === "OVERDUE" ? "#991B1B" : "#166534",
                    }}
                  />
                </Box>
                {act.latest_update && (
                  <Typography variant="caption" sx={{ display: "block", color: "#14532D", fontSize: "0.72rem" }}>
                    {act.latest_update}
                  </Typography>
                )}
                {/* Progress bar */}
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={act.progress_pct || 0}
                    sx={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      bgcolor: "#DCFCE7",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: colorTokens.status.success.main,
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#166534" }}>
                    {act.progress_pct || 0}%
                  </Typography>
                </Box>
                {act.target_date && (
                  <Typography variant="caption" sx={{ display: "block", color: "#4B5563", fontSize: "0.68rem", mt: 0.5 }}>
                    Target Completion: {act.target_date}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
