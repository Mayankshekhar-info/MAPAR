import React, { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ScheduleIcon from "@mui/icons-material/Schedule";

import Skeleton from "@mui/material/Skeleton";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceMetrics, OwnerDistribution, CircleDistribution } from "../types/governance.types";

interface GovernanceBreakdownTabsProps {
  metrics?: GovernanceMetrics;
  isLoading?: boolean;
  activeOwnerId?: number;
  activeCircleId?: number;
  activeBucket?: string;
  onSelectOwner: (ownerId?: number) => void;
  onSelectCircle: (circleId?: number) => void;
  onSelectBucket: (bucket?: string) => void;
  sx?: any;
}

export const GovernanceBreakdownTabs: React.FC<GovernanceBreakdownTabsProps> = ({
  metrics,
  isLoading = false,
  activeOwnerId,
  activeCircleId,
  activeBucket,
  onSelectOwner,
  onSelectCircle,
  onSelectBucket,
  sx,
}) => {
  const [currentTab, setCurrentTab] = useState<number>(0);

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
        <Skeleton variant="text" width={220} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={240} />
      </Paper>
    );
  }

  const ownerDistribution: OwnerDistribution[] = metrics?.owner_distribution || [];
  const circleDistribution: CircleDistribution[] = metrics?.circle_distribution || [];
  const bucketCounts = metrics?.bucket_counts || {
    "0-7 Days": 0,
    "8-15 Days": 0,
    "16-30 Days": 0,
    "30+ Days": 0,
  };
  const closurePerf = metrics?.closure_performance || {
    on_time_closed: 0,
    delayed_closed: 0,
    on_time_rate: 0,
  };

  const totalOpenWip = (metrics?.open_count || 0) + (metrics?.wip_count || 0);

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
      {/* Tabs Header */}
      <Box sx={{ borderBottom: `1px solid ${colorTokens.workspace.border}`, px: 2, pt: 1, backgroundColor: "#F8FAFC" }}>
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          sx={{
            minHeight: 44,
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.82rem",
              color: colorTokens.text.secondary,
              "&.Mui-selected": { color: colorTokens.primary.main },
            },
          }}
        >
          <Tab icon={<PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Owner-Wise Workload & Accountability" />
          <Tab icon={<PublicOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Circle / State Performance" />
          <Tab icon={<AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Ageing & Closure Performance" />
        </Tabs>
      </Box>

      {/* TAB 1: Owner-Wise Workload */}
      {currentTab === 0 && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem" }}>
              Click any owner row to filter the action points table by assigned user. (Calculated from actual database records)
            </Typography>
            {activeOwnerId && (
              <Chip
                size="small"
                label="Clear Owner Filter"
                onDelete={() => onSelectOwner(undefined)}
                sx={{ fontSize: "0.72rem" }}
              />
            )}
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Action Owner</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Total Assigned</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Open</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>WIP</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Closed</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Overdue</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Pending Evidence</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC", minWidth: 140 }}>Completion Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ownerDistribution.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: colorTokens.text.muted }}>
                      No assigned owner data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  ownerDistribution.map((owner, idx) => {
                    const isSelected = activeOwnerId === owner.owner_id && owner.owner_id !== null;
                    return (
                      <TableRow
                        key={idx}
                        hover
                        onClick={() => onSelectOwner(isSelected ? undefined : owner.owner_id || undefined)}
                        sx={{
                          cursor: "pointer",
                          backgroundColor: isSelected ? "#F0F9FF" : "inherit",
                          "&:hover": { backgroundColor: isSelected ? "#E0F2FE" : "#F8FAFC" },
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                backgroundColor: colorTokens.primary.lighter,
                                color: colorTokens.primary.dark,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                flexShrink: 0,
                                border: `1px solid ${colorTokens.primary.light}`,
                              }}
                            >
                              {owner.initials || owner.owner_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U"}
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.8rem" }}>
                                {owner.owner_name}
                              </Typography>
                              {owner.username && (
                                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                                  @{owner.username}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.82rem" }}>
                          {owner.total}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.8rem", color: "#2563EB" }}>
                          {owner.open}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.8rem", color: "#D97706" }}>
                          {owner.wip}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.8rem", color: "#16A34A" }}>
                          {owner.closed}
                        </TableCell>
                        <TableCell align="center">
                          {owner.overdue > 0 ? (
                            <Chip
                              size="small"
                              label={owner.overdue}
                              sx={{ backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 700, height: 20, fontSize: "0.72rem" }}
                            />
                          ) : (
                            <span style={{ color: "#94A3B8" }}>0</span>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {owner.evidence_pending > 0 ? (
                            <Chip
                              size="small"
                              label={owner.evidence_pending}
                              sx={{ backgroundColor: "#E0F2FE", color: "#0284C7", fontWeight: 700, height: 20, fontSize: "0.72rem" }}
                            />
                          ) : (
                            <span style={{ color: "#94A3B8" }}>0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={owner.completion_rate}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: "#E2E8F0",
                                  "& .MuiLinearProgress-bar": {
                                    backgroundColor:
                                      owner.completion_rate >= 75
                                        ? "#16A34A"
                                        : owner.completion_rate >= 40
                                        ? "#0284C7"
                                        : "#F59E0B",
                                  },
                                }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.72rem", minWidth: 32 }}>
                              {owner.completion_rate}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* TAB 2: Circle / State Performance */}
      {currentTab === 1 && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontSize: "0.8rem" }}>
              Click any circle row to filter tasks by operational circle.
            </Typography>
            {activeCircleId && (
              <Chip
                size="small"
                label="Clear Circle Filter"
                onDelete={() => onSelectCircle(undefined)}
                sx={{ fontSize: "0.72rem" }}
              />
            )}
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Circle / State</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Region</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Total Points</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Open</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>WIP</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Closed</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Overdue</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Escalated (&gt;30d)</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC", minWidth: 140 }}>% Closed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {circleDistribution.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3, color: colorTokens.text.muted }}>
                      No circle performance data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  circleDistribution.map((circle) => {
                    const isSelected = activeCircleId === circle.circle__id;
                    const completionRate = circle.completion_rate ?? (circle.total > 0 ? Math.round((circle.closed / circle.total) * 100) : 0);
                    return (
                      <TableRow
                        key={circle.circle__id}
                        hover
                        onClick={() => onSelectCircle(isSelected ? undefined : circle.circle__id)}
                        sx={{
                          cursor: "pointer",
                          backgroundColor: isSelected ? "#F0F9FF" : "inherit",
                          "&:hover": { backgroundColor: isSelected ? "#E0F2FE" : "#F8FAFC" },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.8rem" }}>
                            {circle.circle__name} ({circle.circle__code})
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.78rem", color: colorTokens.text.secondary }}>
                          {circle.circle__region || "—"}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.82rem" }}>
                          {circle.total}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.8rem", color: "#2563EB" }}>
                          {circle.open}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.8rem", color: "#D97706" }}>
                          {circle.wip}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: "0.8rem", color: "#16A34A" }}>
                          {circle.closed}
                        </TableCell>
                        <TableCell align="center">
                          {(circle.overdue || 0) > 0 ? (
                            <Chip
                              size="small"
                              label={circle.overdue}
                              sx={{ backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 700, height: 20, fontSize: "0.72rem" }}
                            />
                          ) : (
                            <span style={{ color: "#94A3B8" }}>0</span>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {circle.escalated > 0 ? (
                            <Chip
                              size="small"
                              label={circle.escalated}
                              sx={{ backgroundColor: "#FEF2F2", color: "#B91C1C", fontWeight: 800, height: 20, fontSize: "0.72rem" }}
                            />
                          ) : (
                            <span style={{ color: "#94A3B8" }}>0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={completionRate}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: "#E2E8F0",
                                  "& .MuiLinearProgress-bar": {
                                    backgroundColor: completionRate >= 75 ? "#16A34A" : "#0284C7",
                                  },
                                }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.72rem", minWidth: 32 }}>
                              {completionRate}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* TAB 3: Ageing & Closure Performance */}
      {currentTab === 2 && (
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={3}>
            {/* Left: Ageing Summary (Matching Canonical Sheet 4) */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 1 }}>
                <ScheduleIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
                Ageing Summary (Active Open/WIP Items Only)
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 2 }}>
                Categorization of active governance items across standardized ageing buckets.
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Ageing Bucket</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Open/WIP Points</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>% of Active</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#F8FAFC" }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(["0-7 Days", "8-15 Days", "16-30 Days", "30+ Days"] as const).map((bucket) => {
                      const count = bucketCounts[bucket] || 0;
                      const pct = totalOpenWip > 0 ? Math.round((count / totalOpenWip) * 100) : 0;
                      const isSelected = activeBucket === bucket;

                      return (
                        <TableRow
                          key={bucket}
                          hover
                          sx={{
                            backgroundColor: isSelected ? "#F0F9FF" : "inherit",
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  backgroundColor:
                                    bucket === "30+ Days"
                                      ? "#DC2626"
                                      : bucket === "16-30 Days"
                                      ? "#EA580C"
                                      : bucket === "8-15 Days"
                                      ? "#0284C7"
                                      : "#16A34A",
                                }}
                              />
                              {bucket}
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                            {count}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: "0.8rem" }}>
                            {pct}%
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={isSelected ? "Active Filter" : "Filter"}
                              color={isSelected ? "primary" : "default"}
                              clickable
                              onClick={() => onSelectBucket(isSelected ? undefined : bucket)}
                              sx={{ height: 22, fontSize: "0.72rem" }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Right: On-Time Closure Reliability */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 1 }}>
                <DoneAllIcon sx={{ fontSize: 18, color: colorTokens.status.success.main }} />
                Closure Timeliness & Reliability
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 2 }}>
                Delivery benchmark analyzing closed items against original vs revised target dates.
              </Typography>

              <Box
                sx={{
                  p: 2,
                  borderRadius: radiusTokens.md,
                  border: `1px solid ${colorTokens.workspace.border}`,
                  backgroundColor: "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    On-Time Delivery Rate
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.status.success.main }}>
                    {closurePerf.on_time_rate}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={closurePerf.on_time_rate}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#E2E8F0",
                    "& .MuiLinearProgress-bar": { backgroundColor: "#16A34A" },
                  }}
                />

                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", fontSize: "0.7rem" }}>
                      ON-TIME CLOSED
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#16A34A" }}>
                      {closurePerf.on_time_closed}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", fontSize: "0.7rem" }}>
                      DELAYED CLOSURES
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#EA580C" }}>
                      {closurePerf.delayed_closed}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
};
