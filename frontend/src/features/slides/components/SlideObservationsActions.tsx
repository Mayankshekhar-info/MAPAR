import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { SlideGovernanceIssue, SlideGovernanceAction } from "../types/slide.types";

interface SlideObservationsActionsProps {
  issues: SlideGovernanceIssue[];
  actions: SlideGovernanceAction[];
}

export const SlideObservationsActions: React.FC<SlideObservationsActionsProps> = ({ issues, actions }) => {
  if (issues.length === 0 && actions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Grid container spacing={2.5}>
        {/* Left: Operational Issues & Root Causes */}
        {issues.length > 0 && (
          <Grid size={{ xs: 12, md: actions.length > 0 ? 6 : 12 }}>
            <Card
              sx={{
                p: 2.5,
                borderRadius: radiusTokens.lg,
                border: `1px solid ${colorTokens.workspace.border}`,
                boxShadow: shadowTokens.subtle,
                bgcolor: "#FFFFFF",
                height: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, pb: 1, borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
                <WarningAmberIcon sx={{ color: colorTokens.status.warning.main, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  Operational Observations & Root Causes ({issues.length})
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {issues.map((issue) => (
                  <Box
                    key={issue.id}
                    sx={{
                      p: 1.75,
                      borderRadius: radiusTokens.md,
                      bgcolor: colorTokens.workspace.background,
                      border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        {issue.issue_code} — {issue.title}
                      </Typography>
                      <Chip
                        label={issue.rag_status}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          borderRadius: radiusTokens.xs,
                          bgcolor: issue.rag_status === "RED" ? colorTokens.status.error.light : colorTokens.status.warning.light,
                          color: issue.rag_status === "RED" ? colorTokens.status.error.text : colorTokens.status.warning.text,
                        }}
                      />
                    </Box>

                    {issue.root_cause && (
                      <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem", mb: 0.75 }}>
                        <span style={{ fontWeight: 600 }}>RCA:</span> {issue.root_cause}
                      </Typography>
                    )}

                    {issue.corrective_action && (
                      <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem", mb: 1 }}>
                        <span style={{ fontWeight: 600 }}>Corrective:</span> {issue.corrective_action}
                      </Typography>
                    )}

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: colorTokens.text.muted }}>
                        <PersonOutlineIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
                          Owner: {issue.owner_name || "Unassigned"}
                        </Typography>
                      </Box>
                      {issue.target_date && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: colorTokens.text.muted }}>
                          <EventOutlinedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
                            Target: {issue.target_date}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Card>
          </Grid>
        )}

        {/* Right: Corrective Action Items */}
        {actions.length > 0 && (
          <Grid size={{ xs: 12, md: issues.length > 0 ? 6 : 12 }}>
            <Card
              sx={{
                p: 2.5,
                borderRadius: radiusTokens.lg,
                border: `1px solid ${colorTokens.workspace.border}`,
                boxShadow: shadowTokens.subtle,
                bgcolor: "#FFFFFF",
                height: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, pb: 1, borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
                <AssignmentTurnedInIcon sx={{ color: colorTokens.primary.main, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  Governance Action Items ({actions.length})
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {actions.map((action) => (
                  <Box
                    key={action.id}
                    sx={{
                      p: 1.75,
                      borderRadius: radiusTokens.md,
                      bgcolor: colorTokens.workspace.background,
                      border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        {action.action_code}
                      </Typography>
                      <Chip
                        label={action.status}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          borderRadius: radiusTokens.xs,
                          bgcolor: colorTokens.primary.lighter,
                          color: colorTokens.primary.darker,
                        }}
                      />
                    </Box>

                    {action.management_direction && (
                      <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem", mb: 0.75 }}>
                        <span style={{ fontWeight: 600 }}>Direction:</span> {action.management_direction}
                      </Typography>
                    )}

                    {action.expected_outcome && (
                      <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem", mb: 1 }}>
                        <span style={{ fontWeight: 600 }}>Expected Outcome:</span> {action.expected_outcome}
                      </Typography>
                    )}

                    {/* Progress Bar */}
                    <Box sx={{ mb: 1 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                        <Typography variant="caption" sx={{ fontSize: "0.7rem", color: colorTokens.text.muted }}>
                          Progress
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700, color: colorTokens.text.primary }}>
                          {action.progress_percentage}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={action.progress_percentage}
                        sx={{ height: 4, borderRadius: 2, bgcolor: colorTokens.workspace.borderSubtle }}
                      />
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: colorTokens.text.muted }}>
                        <PersonOutlineIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
                          Accountable: {action.accountable_owner}
                        </Typography>
                      </Box>
                      {action.target_date && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: colorTokens.text.muted }}>
                          <EventOutlinedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
                            Target: {action.target_date}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
