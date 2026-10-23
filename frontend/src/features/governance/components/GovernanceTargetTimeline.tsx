import React, { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

import Skeleton from "@mui/material/Skeleton";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { TimelinePoint, TimelinePointAction } from "../types/governance.types";

interface GovernanceTargetTimelineProps {
  timeline?: TimelinePoint[];
  isLoading?: boolean;
  onSelectAction: (actionId: number) => void;
  sx?: any;
}

export const GovernanceTargetTimeline: React.FC<GovernanceTargetTimelineProps> = ({
  timeline = [],
  isLoading = false,
  onSelectAction,
  sx,
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const todayPoint = timeline.find((p) => p.is_today);
    if (todayPoint && todayPoint.count > 0) return todayPoint.date;
    const firstWithActions = timeline.find((p) => p.count > 0);
    return firstWithActions ? firstWithActions.date : null;
  });

  if (isLoading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: colorTokens.workspace.surface,
          ...sx,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Skeleton variant="text" width={180} height={32} />
          <Skeleton variant="rounded" width={100} height={24} />
        </Box>
        <Skeleton variant="rounded" height={240} />
      </Paper>
    );
  }

  if (timeline.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: colorTokens.workspace.surface,
          overflow: "hidden",
          ...sx,
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${colorTokens.workspace.border}`,
            backgroundColor: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CalendarTodayOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
            Target Deadline Timeline
          </Typography>
        </Box>
        <Box sx={{ p: 4, textAlign: "center" }}>
          <CalendarTodayOutlinedIcon sx={{ fontSize: 40, color: "#94A3B8", mb: 1 }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            No Upcoming Deadlines
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 0.5 }}>
            No open tasks with target dates found in the selected reporting period.
          </Typography>
        </Box>
      </Paper>
    );
  }

  const totalDeadlines = timeline.reduce((acc, curr) => acc + curr.count, 0);
  const overdueDeadlines = timeline
    .filter((p) => p.is_overdue)
    .reduce((acc, curr) => acc + curr.count, 0);
  const todayPoint = timeline.find((p) => p.is_today);
  const todayCount = todayPoint ? todayPoint.count : 0;

  const activePoint = timeline.find((p) => p.date === selectedDate);
  const displayedActions: TimelinePointAction[] = activePoint ? activePoint.actions : [];

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: radiusTokens.lg,
        border: `1px solid ${colorTokens.workspace.border}`,
        backgroundColor: colorTokens.workspace.surface,
        overflow: "hidden",
        ...sx,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: "#F8FAFC",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CalendarTodayOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
            Target Deadline Timeline
          </Typography>
          <Chip
            label={`${totalDeadlines} active deadlines in window`}
            size="small"
            sx={{
              backgroundColor: "#F1F5F9",
              color: colorTokens.text.secondary,
              fontWeight: 600,
              fontSize: "0.72rem",
              height: 22,
            }}
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {todayCount > 0 && (
            <Chip
              icon={<EventAvailableIcon sx={{ fontSize: "14px !important" }} />}
              label={`${todayCount} due today`}
              size="small"
              sx={{ backgroundColor: "#E0F2FE", color: "#0369A1", fontWeight: 700, fontSize: "0.72rem" }}
            />
          )}
          {overdueDeadlines > 0 && (
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
              label={`${overdueDeadlines} past target`}
              size="small"
              sx={{ backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: "0.72rem" }}
            />
          )}
        </Box>
      </Box>

      {/* Horizontal Calendar Strip */}
      <Box
        sx={{
          p: 1.5,
          display: "flex",
          gap: 1,
          overflowX: "auto",
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: "#FFFFFF",
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#CBD5E1", borderRadius: 3 },
        }}
      >
        {timeline.map((point) => {
          const isSelected = selectedDate === point.date;
          const hasActions = point.count > 0;

          let badgeBg = "#F1F5F9";
          let badgeColor = "#64748B";
          let cardBorder: string = colorTokens.workspace.border;

          if (point.is_today) {
            badgeBg = "#0284C7";
            badgeColor = "#FFFFFF";
            cardBorder = "#0284C7";
          } else if (point.is_overdue && hasActions) {
            badgeBg = "#FEE2E2";
            badgeColor = "#DC2626";
            cardBorder = "#FCA5A5";
          } else if (hasActions) {
            badgeBg = "#E0F2FE";
            badgeColor = "#0284C7";
          }

          return (
            <Box
              key={point.date}
              onClick={() => setSelectedDate(point.date)}
              sx={{
                flexShrink: 0,
                width: 76,
                py: 1,
                px: 0.5,
                textAlign: "center",
                borderRadius: radiusTokens.md,
                border: "1px solid",
                borderColor: isSelected ? colorTokens.primary.main : cardBorder,
                backgroundColor: isSelected ? "#F0F9FF" : point.is_today ? "#F8FAFC" : "#FFFFFF",
                boxShadow: isSelected ? "0 0 0 2px rgba(2, 132, 199, 0.25)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: colorTokens.primary.main,
                  transform: "translateY(-1px)",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontSize: "0.68rem",
                  fontWeight: point.is_today ? 800 : 600,
                  color: point.is_today ? colorTokens.primary.main : colorTokens.text.secondary,
                }}
              >
                {point.is_today ? "TODAY" : point.label.split(" ")[1]}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  color: colorTokens.text.primary,
                  my: 0.2,
                }}
              >
                {point.label.split(" ")[0]}
              </Typography>
              <Chip
                label={point.count}
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  backgroundColor: badgeBg,
                  color: badgeColor,
                }}
              />
            </Box>
          );
        })}
      </Box>

      {/* Selected Day Action List */}
      <Box sx={{ p: 2, backgroundColor: "#F8FAFC" }}>
        {activePoint ? (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.82rem" }}>
                Target Deadlines for {activePoint.label} {activePoint.is_today && "(Today)"} {activePoint.is_overdue && "(Past Target Date)"}
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.75rem" }}>
                {displayedActions.length} actions scheduled
              </Typography>
            </Box>

            {displayedActions.length === 0 ? (
              <Typography variant="body2" sx={{ color: colorTokens.text.muted, fontSize: "0.8rem", py: 1 }}>
                No active governance deadlines scheduled on this date.
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
                {displayedActions.map((act) => (
                  <Box
                    key={act.id}
                    onClick={() => onSelectAction(act.id)}
                    sx={{
                      p: 1.5,
                      borderRadius: radiusTokens.md,
                      border: `1px solid ${colorTokens.workspace.border}`,
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                      "&:hover": {
                        borderColor: colorTokens.primary.main,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.primary.main, fontSize: "0.72rem" }}>
                          {act.action_id}
                        </Typography>
                        <Chip
                          label={act.priority}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            backgroundColor:
                              act.priority === "High" ? "#FEE2E2" : act.priority === "Medium" ? "#FEF3C7" : "#F1F5F9",
                            color:
                              act.priority === "High" ? "#DC2626" : act.priority === "Medium" ? "#D97706" : "#475569",
                          }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: colorTokens.text.primary,
                          fontSize: "0.8rem",
                          lineHeight: 1.3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          mb: 1,
                        }}
                      >
                        {act.title}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1, borderTop: "1px dashed #E2E8F0" }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.7rem", fontWeight: 600 }}>
                          {act.owner}
                        </Typography>
                        {act.circle && (
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.68rem", display: "block" }}>
                            {act.circle}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIosIcon sx={{ fontSize: "10px !important" }} />}
                        sx={{ textTransform: "none", fontSize: "0.7rem", p: 0, minWidth: "auto", color: colorTokens.primary.main }}
                      >
                        View
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </>
        ) : (
          <Typography variant="body2" sx={{ color: colorTokens.text.muted, fontSize: "0.8rem" }}>
            Select any day on the timeline above to view matching actions.
          </Typography>
        )}
      </Box>
    </Paper>
  );
};
