import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";

import Skeleton from "@mui/material/Skeleton";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceMetrics } from "../types/governance.types";

interface GovernanceOverdueAnalysisProps {
  metrics?: GovernanceMetrics;
  isLoading?: boolean;
  activeBucket?: string;
  isOverdueActive?: boolean;
  onSelectBucket: (bucket?: string) => void;
  onSelectOverdue: (isOverdue?: boolean) => void;
  sx?: any;
}

export const GovernanceOverdueAnalysis: React.FC<GovernanceOverdueAnalysisProps> = ({
  metrics,
  isLoading = false,
  activeBucket,
  isOverdueActive,
  onSelectBucket,
  onSelectOverdue,
  sx,
}) => {
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
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={120} height={20} />
        </Box>
        <Skeleton variant="rounded" height={240} />
      </Paper>
    );
  }

  const overdueCount = metrics?.overdue_count || 0;
  const avgLate = metrics?.avg_days_late || 0;
  const maxLate = metrics?.max_days_late || 0;
  const closurePerf = metrics?.closure_performance || {
    on_time_closed: 0,
    delayed_closed: 0,
    on_time_rate: 0,
  };

  const overdueDistribution = metrics?.overdue_ageing_chart || {
    not_yet_due: 0,
    "1-3d": 0,
    "4-7d": 0,
    "8-15d": 0,
    "15+d": 0,
  };

  const bucketCounts = metrics?.bucket_counts || {
    "0-7 Days": 0,
    "8-15 Days": 0,
    "16-30 Days": 0,
    "30+ Days": 0,
  };

  const totalOpenWip = (metrics?.open_count || 0) + (metrics?.wip_count || 0);

  const delayCategories = [
    { key: "not_yet_due", label: "Not Yet Due (On Track)", count: overdueDistribution.not_yet_due, color: "#16A34A", bg: "#ECFDF5" },
    { key: "1-3d", label: "1–3 Days Overdue", count: overdueDistribution["1-3d"], color: "#F59E0B", bg: "#FEF3C7" },
    { key: "4-7d", label: "4–7 Days Overdue", count: overdueDistribution["4-7d"], color: "#EA580C", bg: "#FFEDD5" },
    { key: "8-15d", label: "8–15 Days Overdue", count: overdueDistribution["8-15d"], color: "#DC2626", bg: "#FEE2E2" },
    { key: "15+d", label: "> 15 Days Overdue (Critical)", count: overdueDistribution["15+d"], color: "#991B1B", bg: "#FEE2E2" },
  ];

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
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberOutlinedIcon sx={{ fontSize: 20, color: colorTokens.status.error.main }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
            Overdue Analysis & Ageing Performance
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem" }}>
          Live delay calculations based on target closure dates
        </Typography>
      </Box>

      {/* Summary KPI Cards */}
      <Box sx={{ p: 2 }}>
        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          {/* Card 1: Total Overdue */}
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              onClick={() => onSelectOverdue(!isOverdueActive)}
              sx={{
                p: 1.5,
                borderRadius: radiusTokens.md,
                border: "1px solid",
                borderColor: isOverdueActive ? colorTokens.status.error.main : colorTokens.workspace.border,
                backgroundColor: isOverdueActive ? "#FEF2F2" : "#F8FAFC",
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: colorTokens.status.error.main },
              }}
            >
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600, fontSize: "0.72rem", display: "block" }}>
                Total Overdue Actions
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: overdueCount > 0 ? colorTokens.status.error.main : colorTokens.text.primary }}>
                  {overdueCount}
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                  {totalOpenWip > 0 ? `${Math.round((overdueCount / totalOpenWip) * 100)}% of active` : "0%"}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Card 2: Average Days Late */}
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600, fontSize: "0.72rem", display: "block" }}>
                Average Delay
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                  {avgLate}
                </Typography>
                <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                  days
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Card 3: Maximum Days Late */}
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600, fontSize: "0.72rem", display: "block" }}>
                Oldest Unresolved Delay
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: maxLate > 15 ? "#991B1B" : colorTokens.text.primary }}>
                  {maxLate}
                </Typography>
                <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                  days late
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Card 4: On-Time Closure Rate */}
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600, fontSize: "0.72rem", display: "block" }}>
                On-Time Closure Rate
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#16A34A" }}>
                  {closurePerf.on_time_rate}%
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                  {closurePerf.on_time_closed} on-time
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Detailed Sections: Left Overdue Buckets, Right Active Ageing */}
        <Grid container spacing={3}>
          {/* Overdue Ageing Buckets */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 1 }}>
              <SpeedOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
              Overdue Distribution by Target Delay
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 2 }}>
              Breakdown of active tasks categorized by delay past current target closure date.
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {delayCategories.map((cat) => {
                const pct = totalOpenWip > 0 ? Math.round((cat.count / totalOpenWip) * 100) : 0;
                return (
                  <Box
                    key={cat.key}
                    onClick={() => {
                      if (cat.key === "not_yet_due") {
                        onSelectOverdue(false);
                      } else {
                        onSelectOverdue(true);
                      }
                    }}
                    sx={{
                      p: 1.25,
                      borderRadius: radiusTokens.md,
                      border: `1px solid ${colorTokens.workspace.border}`,
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      "&:hover": { borderColor: cat.color, backgroundColor: "#F8FAFC" },
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cat.color }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.8rem", color: colorTokens.text.primary }}>
                          {cat.label}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.85rem", color: cat.color }}>
                          {cat.count}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem", minWidth: 32, textAlign: "right" }}>
                          ({pct}%)
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 5,
                        borderRadius: 2.5,
                        backgroundColor: "#E2E8F0",
                        "& .MuiLinearProgress-bar": { backgroundColor: cat.color },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Grid>

          {/* Active Items Ageing (Canonical Standard Buckets) */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 1 }}>
              <ScheduleOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
              Active Actions Ageing Profile
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 2 }}>
              Total elapsed days since creation date for all active Open and WIP items.
            </Typography>

            <TableContainer sx={{ border: `1px solid ${colorTokens.workspace.border}`, borderRadius: radiusTokens.md }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Ageing Bucket</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Count</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>% Active</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Filter</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(["0-7 Days", "8-15 Days", "16-30 Days", "30+ Days"] as const).map((bucket) => {
                    const count = bucketCounts[bucket] || 0;
                    const pct = totalOpenWip > 0 ? Math.round((count / totalOpenWip) * 100) : 0;
                    const isSelected = activeBucket === bucket;

                    return (
                      <TableRow key={bucket} hover sx={{ backgroundColor: isSelected ? "#F0F9FF" : "inherit" }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: "0.78rem" }}>
                          {bucket}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.82rem" }}>
                          {count}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.78rem" }}>
                          {pct}%
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={isSelected ? "Active" : "Select"}
                            color={isSelected ? "primary" : "default"}
                            clickable
                            onClick={() => onSelectBucket(isSelected ? undefined : bucket)}
                            sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Closure Benchmark Box */}
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
                backgroundColor: "#F8FAFC",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary, display: "block", mb: 0.5 }}>
                Closure Delivery Benchmark
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "#16A34A", fontWeight: 700, display: "block" }}>
                    ✓ On-Time: {closurePerf.on_time_closed}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "#EA580C", fontWeight: 700, display: "block" }}>
                    ⚠ Delayed: {closurePerf.delayed_closed}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};
