import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceWeeklyUpdate } from "../types/governance.types";

interface WeeklyProgressTimelineProps {
  updates: GovernanceWeeklyUpdate[];
}

export const WeeklyProgressTimeline: React.FC<WeeklyProgressTimelineProps> = ({ updates }) => {
  if (!updates || updates.length === 0) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: "center",
          borderRadius: radiusTokens.md,
          backgroundColor: "#F8FAFC",
          border: `1px dashed ${colorTokens.workspace.border}`,
        }}
      >
        <EventRepeatIcon sx={{ fontSize: 40, color: colorTokens.text.muted, mb: 1 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
          No Weekly Updates Logged Yet
        </Typography>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
          Assigned task owners can submit week-by-week progress reports to record milestones, progress %, and blockers.
        </Typography>
      </Box>
    );
  }

  // Display newest first
  const sortedUpdates = [...updates].reverse();

  return (
    <Box sx={{ position: "relative", pl: 3 }}>
      {/* Vertical line indicator */}
      <Box
        sx={{
          position: "absolute",
          top: 12,
          bottom: 12,
          left: 11,
          width: 2,
          backgroundColor: colorTokens.workspace.border,
        }}
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {sortedUpdates.map((u, idx) => {
          const isLatest = idx === 0;

          return (
            <Box key={u.id} sx={{ position: "relative" }}>
              {/* Timeline marker */}
              <Box
                sx={{
                  position: "absolute",
                  left: -24,
                  top: 14,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: isLatest ? colorTokens.primary.main : "#FFFFFF",
                  border: `3px solid ${isLatest ? colorTokens.primary.main : colorTokens.text.muted}`,
                  boxShadow: isLatest ? `0 0 0 3px ${colorTokens.primary.main}22` : "none",
                }}
              />

              {/* Card Container */}
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: radiusTokens.md,
                  backgroundColor: isLatest ? "#FFFFFF" : "#F8FAFC",
                  border: `1px solid ${isLatest ? colorTokens.primary.main : colorTokens.workspace.border}`,
                  boxShadow: isLatest ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                }}
              >
                {/* Header row */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                      {u.reporting_week}
                    </Typography>
                    {isLatest && (
                      <Chip
                        label="LATEST UPDATE"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          backgroundColor: `${colorTokens.primary.main}20`,
                          color: colorTokens.primary.main,
                          border: `1px solid ${colorTokens.primary.main}40`,
                          letterSpacing: "0.5px",
                        }}
                      />
                    )}
                    {u.bucket && (
                      <Chip
                        label={`Bucket: ${u.bucket}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          backgroundColor: "#EFF6FF",
                          color: "#1D4ED8",
                          border: "1px solid #DBEAFE",
                        }}
                      />
                    )}
                    {u.revision_number > 1 && (
                      <Chip
                        label={`Week Entry #${u.revision_number}`}
                        size="small"
                        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, backgroundColor: "#EEF2F6" }}
                      />
                    )}
                    {u.previous_progress_percent !== undefined && u.previous_progress_percent !== null && u.previous_progress_percent !== u.progress_percent ? (
                      <Chip
                        label={`${u.previous_progress_percent}% → ${u.progress_percent}% Progress`}
                        size="small"
                        sx={{
                          height: 22,
                          fontWeight: 700,
                          fontSize: "0.7rem",
                          backgroundColor:
                            u.progress_percent >= 100
                              ? `${colorTokens.status.success.main}15`
                              : `${colorTokens.primary.main}15`,
                          color:
                            u.progress_percent >= 100 ? colorTokens.status.success.main : colorTokens.primary.main,
                        }}
                      />
                    ) : (
                      <Chip
                        label={`${u.progress_percent}% Progress`}
                        size="small"
                        sx={{
                          height: 22,
                          fontWeight: 700,
                          fontSize: "0.7rem",
                          backgroundColor:
                            u.progress_percent >= 100
                              ? `${colorTokens.status.success.main}15`
                              : `${colorTokens.primary.main}15`,
                          color:
                            u.progress_percent >= 100 ? colorTokens.status.success.main : colorTokens.primary.main,
                        }}
                      />
                    )}
                    {u.previous_status && u.previous_status !== u.status ? (
                      <Chip
                        label={`${u.previous_status} → ${u.status}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          backgroundColor:
                            u.status === "Closed"
                              ? `${colorTokens.status.success.main}15`
                              : u.status === "WIP"
                              ? `${colorTokens.primary.main}15`
                              : `${colorTokens.status.warning.main}15`,
                          color:
                            u.status === "Closed"
                              ? colorTokens.status.success.main
                              : u.status === "WIP"
                              ? colorTokens.primary.main
                              : colorTokens.status.warning.main,
                        }}
                      />
                    ) : (
                      <Chip
                        label={u.status}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          backgroundColor:
                            u.status === "Closed"
                              ? `${colorTokens.status.success.main}15`
                              : u.status === "WIP"
                              ? `${colorTokens.primary.main}15`
                              : `${colorTokens.status.warning.main}15`,
                          color:
                            u.status === "Closed"
                              ? colorTokens.status.success.main
                              : u.status === "WIP"
                              ? colorTokens.primary.main
                              : colorTokens.status.warning.main,
                        }}
                      />
                    )}
                  </Box>

                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    Reported by {u.submitted_by?.full_name || u.submitted_by?.username || "Owner"} on{" "}
                    {new Date(u.submitted_at).toLocaleDateString()} at{" "}
                    {new Date(u.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Typography>
                </Box>

                {/* Work completed description */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase" }}>
                    Work Completed
                  </Typography>
                  <Typography variant="body2" sx={{ color: colorTokens.text.primary, mt: 0.25, whiteSpace: "pre-wrap" }}>
                    {u.work_completed}
                  </Typography>
                </Box>

                {/* Achievements if present */}
                {u.achievements && (
                  <Box sx={{ mb: 1.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 18, color: colorTokens.status.success.main, mt: 0.2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.status.success.main }}>
                        Key Achievements
                      </Typography>
                      <Typography variant="body2" sx={{ color: colorTokens.text.primary }}>
                        {u.achievements}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Blockers callout if present */}
                {u.blockers && (
                  <Box
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: radiusTokens.sm,
                      backgroundColor: `${colorTokens.status.warning.main}10`,
                      border: `1px solid ${colorTokens.status.warning.main}35`,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                    }}
                  >
                    <WarningAmberIcon sx={{ fontSize: 18, color: colorTokens.status.warning.main, mt: 0.2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.status.warning.main }}>
                        Challenges / Blockers
                      </Typography>
                      <Typography variant="body2" sx={{ color: colorTokens.text.primary }}>
                        {u.blockers}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Next week plan if present */}
                {u.next_week_plan && (
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 1 }}>
                    <ArrowForwardIcon sx={{ fontSize: 16, color: colorTokens.primary.main, mt: 0.3 }} />
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.primary.main }}>
                        Next Week's Plan
                      </Typography>
                      <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
                        {u.next_week_plan}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Remarks if present */}
                {u.remarks && (
                  <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.muted, fontStyle: "italic", mt: 1 }}>
                    Remarks: {u.remarks}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
