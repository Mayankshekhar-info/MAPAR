import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import UnpublishedOutlinedIcon from "@mui/icons-material/UnpublishedOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceMetrics } from "../types/governance.types";

interface GovernanceMetricsBarProps {
  metrics?: GovernanceMetrics;
  isLoading?: boolean;
  activeFilter?: {
    status?: string;
    evidence_status?: string;
    is_escalated?: boolean;
    is_overdue?: boolean;
    is_due_soon?: boolean;
    priority?: string;
  };
  onFilterChange: (filter: {
    status?: string;
    evidence_status?: string;
    is_escalated?: boolean;
    is_overdue?: boolean;
    is_due_soon?: boolean;
    priority?: string;
  }) => void;
}

export const GovernanceMetricsBar: React.FC<GovernanceMetricsBarProps> = ({
  metrics,
  isLoading,
  activeFilter,
  onFilterChange,
}) => {
  if (isLoading) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1.5, mb: 3 }}>
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: radiusTokens.md }} />
        ))}
      </Box>
    );
  }

  const totalActions = metrics?.total_actions ?? 0;
  const closedCount = metrics?.closed_count ?? 0;
  const overdueCount = metrics?.overdue_count ?? 0;
  const avgLate = metrics?.avg_days_late ?? 0;
  const wipCount = metrics?.wip_count ?? 0;
  const dueSoonCount = metrics?.upcoming_count ?? 0;
  const dueIn3d = metrics?.due_in_3_days_count ?? 0;
  const reworkCount = metrics?.rework_evidence_count ?? 0;

  const items = [
    {
      id: "total",
      label: "Total Actions",
      value: totalActions,
      subtitle: "in scope",
      icon: <AssignmentOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />,
      bgColor: colorTokens.primary.lighter,
      borderColor: colorTokens.primary.light,
      isActive:
        !activeFilter?.status &&
        !activeFilter?.evidence_status &&
        activeFilter?.is_escalated === undefined &&
        activeFilter?.is_overdue === undefined &&
        activeFilter?.is_due_soon === undefined &&
        !activeFilter?.priority,
      onClick: () =>
        onFilterChange({
          status: undefined,
          evidence_status: undefined,
          is_escalated: undefined,
          is_overdue: undefined,
          is_due_soon: undefined,
          priority: undefined,
        }),
    },
    {
      id: "open",
      label: "Open",
      value: metrics?.open_count ?? 0,
      subtitle: `${wipCount} in progress`,
      icon: <FolderOpenOutlinedIcon sx={{ fontSize: 20, color: "#0284C7" }} />,
      bgColor: "#F0F9FF",
      borderColor: "#BAE6FD",
      isActive: activeFilter?.status === "Open",
      onClick: () => onFilterChange({ status: activeFilter?.status === "Open" ? undefined : "Open" }),
    },
    {
      id: "wip",
      label: "In Progress",
      value: wipCount,
      subtitle: "active work",
      icon: <PlayCircleOutlineOutlinedIcon sx={{ fontSize: 20, color: "#D97706" }} />,
      bgColor: "#FEF3C7",
      borderColor: "#FDE68A",
      isActive: activeFilter?.status === "WIP",
      onClick: () => onFilterChange({ status: activeFilter?.status === "WIP" ? undefined : "WIP" }),
    },
    {
      id: "overdue",
      label: "Overdue",
      value: overdueCount,
      subtitle: avgLate > 0 ? `avg ${avgLate}d late` : undefined,
      icon: <WarningAmberOutlinedIcon sx={{ fontSize: 20, color: colorTokens.status.error.main }} />,
      bgColor: colorTokens.status.error.light,
      borderColor: colorTokens.status.error.border,
      isActive: activeFilter?.is_overdue === true,
      onClick: () => onFilterChange({ is_overdue: activeFilter?.is_overdue ? undefined : true }),
    },
    {
      id: "due_soon",
      label: "Due Soon",
      value: dueSoonCount,
      subtitle: dueIn3d > 0 ? `${dueIn3d} in 3 days` : "next 7 days",
      icon: <HourglassTopOutlinedIcon sx={{ fontSize: 20, color: "#0284C7" }} />,
      bgColor: "#F0F9FF",
      borderColor: "#BAE6FD",
      isActive: activeFilter?.is_due_soon === true,
      tooltip: "Active tasks with target closure date in the next 7 days",
      onClick: () => onFilterChange({ is_due_soon: activeFilter?.is_due_soon ? undefined : true }),
    },
    {
      id: "closed",
      label: "Closed",
      value: closedCount,
      subtitle: totalActions > 0 ? `${Math.round((closedCount / totalActions) * 100)}% closed` : undefined,
      icon: <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 20, color: colorTokens.status.success.main }} />,
      bgColor: colorTokens.status.success.light,
      borderColor: colorTokens.status.success.border,
      isActive: activeFilter?.status === "Closed",
      onClick: () => onFilterChange({ status: activeFilter?.status === "Closed" ? undefined : "Closed" }),
    },
    {
      id: "awaiting_review",
      label: "Pending Review",
      value: metrics?.pending_evidence_count ?? 0,
      subtitle: "pending check",
      icon: <HourglassTopOutlinedIcon sx={{ fontSize: 20, color: "#7C3AED" }} />,
      bgColor: "#F5F3FF",
      borderColor: "#DDD6FE",
      isActive: activeFilter?.evidence_status === "Pending Review",
      tooltip: "Evidence submitted by task owners pending manager verification",
      onClick: () =>
        onFilterChange({
          evidence_status: activeFilter?.evidence_status === "Pending Review" ? undefined : "Pending Review",
        }),
    },
    {
      id: "rework_required",
      label: "Rework Needed",
      value: reworkCount,
      subtitle: reworkCount > 0 ? "action needed" : undefined,
      icon: <UnpublishedOutlinedIcon sx={{ fontSize: 20, color: "#DC2626" }} />,
      bgColor: "#FEF2F2",
      borderColor: "#FCA5A5",
      isActive: activeFilter?.evidence_status === "Rework Required",
      tooltip: "Evidence rejected or requiring corrections from task owner",
      onClick: () =>
        onFilterChange({
          evidence_status: activeFilter?.evidence_status === "Rework Required" ? undefined : "Rework Required",
        }),
    },
  ];


  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(4, 1fr)",
          md: "repeat(4, 1fr)",
          lg: "repeat(8, 1fr)",
        },
        gap: 1.5,
        mb: 3,
      }}
    >
      {items.map((item) => {
        const content = (
          <Card
            key={item.id}
            onClick={item.onClick}
            sx={{
              borderRadius: "12px",
              border: "1.5px solid",
              borderColor: item.isActive ? colorTokens.primary.main : "#E2E8F0",
              boxShadow: item.isActive
                ? "0 0 0 3px rgba(2, 132, 199, 0.2), 0 4px 12px rgba(2, 132, 199, 0.08)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
              backgroundColor: item.isActive ? "#F0F9FF" : "#FFFFFF",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              minHeight: 100,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              "&:hover": {
                transform: "translateY(-3px)",
                borderColor: colorTokens.primary.light,
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)",
              },
            }}
          >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0.75, mb: 1.25, minHeight: 34 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: item.isActive ? colorTokens.primary.dark : "#334155",
                    lineHeight: 1.2,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.label}
                </Typography>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: item.bgColor,
                    border: `1px solid ${item.borderColor}`,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mt: 0.5 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    color:
                      item.id === "rework_required" && item.value > 0
                        ? "#DC2626"
                        : item.id === "overdue" && item.value > 0
                        ? colorTokens.status.error.main
                        : "#0F172A",
                    fontSize: "1.75rem",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {item.value}
                </Typography>
                {item.subtitle && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: item.id === "overdue" && overdueCount > 0 ? "#DC2626" : "#64748B",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.subtitle}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

        );

        return item.tooltip ? (
          <Tooltip key={item.id} title={item.tooltip} arrow>
            {content}
          </Tooltip>
        ) : (
          content
        );
      })}
    </Box>
  );
};
