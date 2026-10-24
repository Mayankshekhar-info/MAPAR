import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import LinearProgress from "@mui/material/LinearProgress";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PieChartIcon from "@mui/icons-material/PieChart";
import BarChartIcon from "@mui/icons-material/BarChart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventNoteIcon from "@mui/icons-material/EventNote";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { TaskProgressPoint } from "../types/governance.types";

export interface ProgressTrendChartProps {
  progressTrend: TaskProgressPoint[];
  currentProgress?: number;
  status?: string;
  isOverdue?: boolean;
}

export const ProgressTrendChart: React.FC<ProgressTrendChartProps> = ({
  progressTrend,
  currentProgress,
  status,
  isOverdue,
}) => {
  const [viewMode, setViewMode] = useState<"pie" | "bar">("pie");

  if (!progressTrend || progressTrend.length === 0) {
    return (
      <Box
        sx={{
          p: 3.5,
          textAlign: "center",
          borderRadius: radiusTokens.md,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${colorTokens.workspace.border}`,
        }}
      >
        <PieChartIcon sx={{ fontSize: 40, color: colorTokens.text.muted, mb: 1.5 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
          No Weekly Progress Data Logged
        </Typography>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted, maxWidth: 380, display: "block", mx: "auto", mt: 0.5 }}>
          Progress percentages and lifecycle orientation will chart dynamically once the assigned owner submits weekly progress updates.
        </Typography>
      </Box>
    );
  }

  // Calculate metrics
  const latestLoggedPercent = progressTrend[progressTrend.length - 1].progress_percent;
  const effectiveProgress = typeof currentProgress === "number" ? currentProgress : latestLoggedPercent;
  const clampedProgress = Math.max(0, Math.min(100, effectiveProgress));
  const remainingProgress = 100 - clampedProgress;

  // Velocity / Delta
  const prevLoggedPercent = progressTrend.length > 1 ? progressTrend[progressTrend.length - 2].progress_percent : 0;
  const weeklyDelta = latestLoggedPercent - prevLoggedPercent;

  // Donut geometry
  const size = 180;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressStrokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  // Dynamic Status Color
  const primaryStatusColor =
    clampedProgress >= 100
      ? colorTokens.status.success.main
      : isOverdue
      ? colorTokens.status.error.main
      : clampedProgress > 0
      ? colorTokens.primary.main
      : colorTokens.status.warning.main;

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: radiusTokens.md,
        backgroundColor: colorTokens.workspace.surface,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Header with Title and View Switcher */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2.5,
          pb: 1.5,
          borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "6px",
              backgroundColor: colorTokens.primary.lighter,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colorTokens.primary.main,
            }}
          >
            {viewMode === "pie" ? <PieChartIcon fontSize="small" /> : <ShowChartIcon fontSize="small" />}
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
              Progress Trend & Completion Status
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
              {progressTrend.length} Reporting Week{progressTrend.length !== 1 ? "s" : ""} Logged • Real-time Task Velocity
            </Typography>
          </Box>
        </Box>

        {/* View Toggle */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, next) => next && setViewMode(next)}
            size="small"
            sx={{
              height: 30,
              backgroundColor: "#F8FAFC",
              borderRadius: radiusTokens.sm,
              border: `1px solid ${colorTokens.workspace.border}`,
              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.75rem",
                px: 1.25,
                border: "none",
                color: colorTokens.text.secondary,
                "&.Mui-selected": {
                  backgroundColor: "#FFFFFF",
                  color: colorTokens.primary.main,
                  fontWeight: 700,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                },
              },
            }}
          >
            <ToggleButton value="pie">
              <PieChartIcon sx={{ fontSize: 15, mr: 0.5 }} />
              Pie Orientation
            </ToggleButton>
            <ToggleButton value="bar">
              <BarChartIcon sx={{ fontSize: 15, mr: 0.5 }} />
              Bar Trend
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* VIEW 1: PIE / DONUT ORIENTATION (Executive View) */}
      {viewMode === "pie" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "210px 1fr" },
            gap: 3,
            alignItems: "center",
          }}
        >
          {/* Left Column: Radial Pie / Donut Chart */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Box sx={{ position: "relative", width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background Ring */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth={strokeWidth}
                />

                {/* Remaining / Deficit Track */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={isOverdue ? "#FEE2E2" : "#E2E8F0"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={0}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />

                {/* Completed Active Arc */}
                {clampedProgress > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={primaryStatusColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={progressStrokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                )}

                {/* Zero-Progress Accent Pulse when 0% */}
                {clampedProgress === 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#F59E0B"
                    strokeWidth={4}
                    strokeDasharray="4 6"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  />
                )}
              </svg>

              {/* Central Information Hub */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 800,
                    color: colorTokens.text.primary,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {clampedProgress}%
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: colorTokens.text.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    mt: 0.5,
                  }}
                >
                  Completed
                </Typography>
                <Chip
                  label={
                    clampedProgress >= 100
                      ? "Finished"
                      : clampedProgress === 0
                      ? "Awaiting Start"
                      : isOverdue
                      ? "Overdue"
                      : "In Progress"
                  }
                  size="small"
                  sx={{
                    mt: 0.75,
                    height: 18,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    backgroundColor:
                      clampedProgress >= 100
                        ? colorTokens.status.success.light
                        : clampedProgress === 0
                        ? colorTokens.status.warning.light
                        : isOverdue
                        ? colorTokens.status.error.light
                        : colorTokens.status.info.light,
                    color:
                      clampedProgress >= 100
                        ? colorTokens.status.success.text
                        : clampedProgress === 0
                        ? colorTokens.status.warning.text
                        : isOverdue
                        ? colorTokens.status.error.text
                        : colorTokens.status.info.text,
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Right Column: Detailed Orientation & Progress Allocation Breakdown */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            {/* Allocation Metrics Grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {/* Metric 1: Completed Work */}
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: radiusTokens.sm,
                  backgroundColor: "#F8FAFC",
                  border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: primaryStatusColor }} />
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                    Completed Effort
                  </Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, lineHeight: 1.2 }}>
                  {clampedProgress}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={clampedProgress}
                  sx={{
                    mt: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#E2E8F0",
                    "& .MuiLinearProgress-bar": { backgroundColor: primaryStatusColor },
                  }}
                />
              </Box>

              {/* Metric 2: Remaining Deficit */}
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: radiusTokens.sm,
                  backgroundColor: "#F8FAFC",
                  border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: isOverdue ? colorTokens.status.error.main : "#94A3B8" }} />
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                    Remaining Work
                  </Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, lineHeight: 1.2 }}>
                  {remainingProgress}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={remainingProgress}
                  sx={{
                    mt: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#E2E8F0",
                    "& .MuiLinearProgress-bar": { backgroundColor: isOverdue ? colorTokens.status.error.main : "#94A3B8" },
                  }}
                />
              </Box>

              {/* Metric 3: Velocity & Trend Delta */}
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: radiusTokens.sm,
                  backgroundColor: "#F8FAFC",
                  border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                  {weeklyDelta > 0 ? (
                    <TrendingUpIcon sx={{ fontSize: 14, color: colorTokens.status.success.main }} />
                  ) : weeklyDelta < 0 ? (
                    <TrendingDownIcon sx={{ fontSize: 14, color: colorTokens.status.error.main }} />
                  ) : (
                    <TrendingFlatIcon sx={{ fontSize: 14, color: colorTokens.text.muted }} />
                  )}
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                    Weekly Velocity
                  </Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, lineHeight: 1.2 }}>
                  {weeklyDelta > 0 ? `+${weeklyDelta}%` : `${weeklyDelta}%`}
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.68rem" }}>
                  vs. previous update
                </Typography>
              </Box>
            </Box>

            {/* Diagnostic Orientation Callout */}
            <Box
              sx={{
                p: 1.25,
                px: 1.5,
                borderRadius: radiusTokens.sm,
                backgroundColor:
                  clampedProgress >= 100
                    ? colorTokens.status.success.light
                    : clampedProgress === 0
                    ? colorTokens.status.warning.light
                    : isOverdue
                    ? colorTokens.status.error.light
                    : "#F0F9FF",
                border: `1px solid ${
                  clampedProgress >= 100
                    ? colorTokens.status.success.border
                    : clampedProgress === 0
                    ? colorTokens.status.warning.border
                    : isOverdue
                    ? colorTokens.status.error.border
                    : "#BAE6FD"
                }`,
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
              }}
            >
              {clampedProgress >= 100 ? (
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: colorTokens.status.success.main, mt: 0.25 }} />
              ) : clampedProgress === 0 ? (
                <WarningAmberIcon sx={{ fontSize: 18, color: colorTokens.status.warning.main, mt: 0.25 }} />
              ) : (
                <AccessTimeIcon sx={{ fontSize: 18, color: colorTokens.primary.main, mt: 0.25 }} />
              )}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    display: "block",
                    color:
                      clampedProgress >= 100
                        ? colorTokens.status.success.text
                        : clampedProgress === 0
                        ? colorTokens.status.warning.text
                        : isOverdue
                        ? colorTokens.status.error.text
                        : colorTokens.status.info.text,
                  }}
                >
                  {clampedProgress >= 100
                    ? "Target Milestone Achieved"
                    : clampedProgress === 0
                    ? `Stagnant Progress: 0% recorded across ${progressTrend.length} cycles`
                    : isOverdue
                    ? "Overdue Warning: Schedule Acceleration Required"
                    : "Active Implementation On Track"}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: colorTokens.text.secondary,
                    fontSize: "0.74rem",
                    display: "block",
                    lineHeight: 1.4,
                  }}
                >
                  {clampedProgress >= 100
                    ? "All deliverables completed. Action owner should submit final supporting evidence proof to initiate governance closure review."
                    : clampedProgress === 0
                    ? `Reporting weeks (${progressTrend.map((p) => p.reporting_week).join(", ")}) indicate zero recorded execution progress. Immediate action owner intervention recommended.`
                    : isOverdue
                    ? `Current progress is at ${clampedProgress}% with ${remainingProgress}% pending beyond target closure date. Submit a revised target date request or accelerate tasks.`
                    : `Steady execution cadence logged across ${progressTrend.length} reporting updates. Continuing towards targeted deliverables.`}
                </Typography>
              </Box>
            </Box>

            {/* Reporting Weeks History Badges */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pt: 0.5 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, fontSize: "0.72rem" }}>
                Logged Weeks:
              </Typography>
              {progressTrend.map((pt, idx) => {
                const isLatest = idx === progressTrend.length - 1;
                return (
                  <Chip
                    key={idx}
                    icon={<EventNoteIcon sx={{ fontSize: "13px !important" }} />}
                    label={`${pt.reporting_week}: ${pt.progress_percent}%`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: "0.68rem",
                      fontWeight: isLatest ? 700 : 500,
                      backgroundColor: isLatest ? "#FFFFFF" : "#F1F5F9",
                      border: `1px solid ${isLatest ? colorTokens.primary.main : "#E2E8F0"}`,
                      color: isLatest ? colorTokens.primary.main : colorTokens.text.secondary,
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>
      ) : (
        /* VIEW 2: BAR TREND (Refined modern bars without ugly stubs) */
        <Box sx={{ pt: 1 }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 130, pb: 1, px: 2 }}>
            {progressTrend.map((pt, index) => {
              const isLatest = index === progressTrend.length - 1;
              const hasProgress = pt.progress_percent > 0;
              const heightPercent = hasProgress ? Math.max(12, (pt.progress_percent / 100) * 100) : 6;
              const barColor =
                pt.progress_percent >= 100
                  ? colorTokens.status.success.main
                  : pt.progress_percent >= 50
                  ? colorTokens.primary.main
                  : pt.progress_percent > 0
                  ? colorTokens.status.warning.main
                  : "#CBD5E1";

              return (
                <Tooltip
                  key={index}
                  title={`${pt.reporting_week}: ${pt.progress_percent}% completed${pt.status ? ` (${pt.status})` : ""}`}
                  arrow
                >
                  <Box
                    sx={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "100%",
                      justifyContent: "flex-end",
                      cursor: "pointer",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: hasProgress ? (isLatest ? colorTokens.primary.main : colorTokens.text.primary) : colorTokens.text.muted,
                        mb: 0.5,
                      }}
                    >
                      {pt.progress_percent}%
                    </Typography>
                    <Box
                      sx={{
                        width: "100%",
                        maxWidth: 48,
                        height: `${heightPercent}%`,
                        backgroundColor: barColor,
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.4s ease, filter 0.2s ease",
                        boxShadow: isLatest && hasProgress ? `0 2px 8px ${barColor}55` : "none",
                        "&:hover": {
                          filter: "brightness(1.1)",
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.7rem",
                        fontWeight: isLatest ? 700 : 500,
                        color: isLatest ? colorTokens.text.primary : colorTokens.text.muted,
                        mt: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 80,
                        textAlign: "center",
                      }}
                    >
                      {pt.reporting_week}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};
