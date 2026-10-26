import React, { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableFooter from "@mui/material/TableFooter";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";

import Skeleton from "@mui/material/Skeleton";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceMetrics, CircleDistribution, OwnerDistribution } from "../types/governance.types";

export interface StatusMatrixFilterPayload {
  circle_id?: number | null;
  owner_id?: number | null;
  status?: string;
  is_overdue?: boolean;
}

interface GovernanceStatusMatrixProps {
  metrics?: GovernanceMetrics;
  isLoading?: boolean;
  activeCircleId?: number | null;
  activeOwnerId?: number | null;
  activeStatus?: string;
  activeOverdue?: boolean;
  onCellClick: (filters: StatusMatrixFilterPayload) => void;
  sx?: any;
}

export const GovernanceStatusMatrix: React.FC<GovernanceStatusMatrixProps> = ({
  metrics,
  isLoading = false,
  activeCircleId,
  activeOwnerId,
  activeStatus,
  activeOverdue,
  onCellClick,
  sx,
}) => {
  const [groupBy, setGroupBy] = useState<"circles" | "owners">("circles");

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
          <Skeleton variant="rounded" width={150} height={32} />
        </Box>
        <Skeleton variant="rounded" height={240} />
      </Paper>
    );
  }

  const circles: CircleDistribution[] = metrics?.circle_distribution || [];
  const owners: OwnerDistribution[] = metrics?.owner_distribution || [];

  // Grand totals across records
  const totalActions = metrics?.total_actions || 0;
  const totalOpen = metrics?.open_count || 0;
  const totalWip = metrics?.wip_count || 0;
  const totalClosed = metrics?.closed_count || 0;
  const totalOverdue = metrics?.overdue_count || 0;
  const overallCompletion = metrics?.completion_rate ?? (totalActions > 0 ? Math.round((totalClosed / totalActions) * 100) : 0);

  const isCellActive = (target: {
    circle_id?: number | null;
    owner_id?: number | null;
    status?: string;
    is_overdue?: boolean;
  }) => {
    if (target.circle_id !== undefined && activeCircleId !== target.circle_id) return false;
    if (target.owner_id !== undefined && activeOwnerId !== target.owner_id) return false;
    if (target.status !== undefined && activeStatus !== target.status) return false;
    if (target.is_overdue !== undefined && activeOverdue !== target.is_overdue) return false;
    return true;
  };

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
      {/* Header with Grouping Toggle */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          p: 2,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          backgroundColor: "#F8FAFC",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GridViewOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
            Action Status Matrix
          </Typography>
          <Chip
            label={groupBy === "circles" ? `${circles.length} Circles` : `${owners.length} Action Owners`}
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

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem", display: { xs: "none", sm: "block" } }}>
            Click any cell to filter matching actions
          </Typography>
          <ToggleButtonGroup
            value={groupBy}
            exclusive
            onChange={(_, val) => val && setGroupBy(val)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.75rem",
                py: 0.4,
                px: 1.2,
                color: colorTokens.text.secondary,
                "&.Mui-selected": {
                  backgroundColor: colorTokens.primary.lighter,
                  color: colorTokens.primary.dark,
                  fontWeight: 800,
                },
              },
            }}
          >
            <ToggleButton value="circles">
              <PublicOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />
              By Circle
            </ToggleButton>
            <ToggleButton value="owners">
              <PeopleAltOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />
              By Owner
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Matrix Table */}
      <TableContainer
        sx={{
          overflowX: "auto",
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#CBD5E1", borderRadius: 2 },
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
              <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem", color: colorTokens.text.primary }}>
                {groupBy === "circles" ? "Circle / Operational Unit" : "Assigned Action Owner"}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#0284C7", width: 80 }}>
                Open
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#D97706", width: 95 }}>
                In Progress
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#16A34A", width: 80 }}>
                Closed
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#DC2626", width: 85 }}>
                Overdue
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, fontSize: "0.75rem", color: colorTokens.text.primary, width: 95 }}>
                Total Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {groupBy === "circles" ? (
              circles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: colorTokens.text.muted }}>
                    No circle performance records found.
                  </TableCell>
                </TableRow>
              ) : (
                circles.map((circle) => {
                  const isCircleSelected = activeCircleId === circle.circle__id;
                  const cRate = circle.completion_rate ?? (circle.total > 0 ? Math.round((circle.closed / circle.total) * 100) : 0);

                  return (
                    <TableRow
                      key={circle.circle__id}
                      hover
                      onClick={() => onCellClick({ circle_id: isCircleSelected ? null : circle.circle__id })}
                      sx={{
                        cursor: "pointer",
                        backgroundColor: isCircleSelected ? "#F0F9FF" : "inherit",
                        "&:hover": { backgroundColor: isCircleSelected ? "#E0F2FE" : "#F8FAFC" },
                      }}
                    >
                      {/* Circle Name */}
                      <TableCell>
                        <Box
                          onClick={() => onCellClick({ circle_id: isCircleSelected ? null : circle.circle__id })}
                          sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 1 }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.82rem" }}>
                            {circle.circle__name}
                          </Typography>
                          <Chip
                            label={circle.circle__code}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              backgroundColor: "#F1F5F9",
                              color: colorTokens.text.secondary,
                            }}
                          />
                          {circle.circle__region && (
                            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                              • {circle.circle__region}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Open Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ circle_id: circle.circle__id, status: "Open" });
                          }}
                          sx={{
                            cursor: "pointer",
                            py: 0.25,
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: circle.open > 0 ? "#0284C7" : "#94A3B8",
                            "&:hover": { backgroundColor: "#F0F9FF" },
                          }}
                        >
                          {circle.open}
                        </Box>
                      </TableCell>

                      {/* In Progress Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ circle_id: circle.circle__id, status: "WIP" });
                          }}
                          sx={{
                            cursor: "pointer",
                            py: 0.25,
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: circle.wip > 0 ? "#D97706" : "#94A3B8",
                            "&:hover": { backgroundColor: "#FEF3C7" },
                          }}
                        >
                          {circle.wip}
                        </Box>
                      </TableCell>

                      {/* Closed Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ circle_id: circle.circle__id, status: "Closed" });
                          }}
                          sx={{
                            cursor: "pointer",
                            py: 0.25,
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: circle.closed > 0 ? "#16A34A" : "#94A3B8",
                            "&:hover": { backgroundColor: "#ECFDF5" },
                          }}
                        >
                          {circle.closed}
                        </Box>
                      </TableCell>

                      {/* Overdue Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ circle_id: circle.circle__id, is_overdue: true });
                          }}
                          sx={{
                            cursor: "pointer",
                            display: "inline-flex",
                            justifyContent: "center",
                          }}
                        >
                          {(circle.overdue || 0) > 0 ? (
                            <Chip
                              label={circle.overdue}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                backgroundColor: "#FEE2E2",
                                color: "#DC2626",
                                cursor: "pointer",
                                "&:hover": { backgroundColor: "#FCA5A5" },
                              }}
                            />
                          ) : (
                            <span style={{ color: "#94A3B8", fontSize: "0.8rem" }}>0</span>
                          )}
                        </Box>
                      </TableCell>

                      {/* Total Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ circle_id: circle.circle__id });
                          }}
                          sx={{
                            cursor: "pointer",
                            fontWeight: 800,
                            fontSize: "0.85rem",
                            color: colorTokens.text.primary,
                            "&:hover": { color: colorTokens.primary.main },
                          }}
                        >
                          {circle.total}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )
            ) : (
              /* Owners Rows */
              owners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: colorTokens.text.muted }}>
                    No assigned action owner records found.
                  </TableCell>
                </TableRow>
              ) : (
                owners.map((owner, idx) => {
                  const isOwnerSelected = activeOwnerId === owner.owner_id && owner.owner_id !== null;
                  return (
                    <TableRow
                      key={idx}
                      hover
                      onClick={() => onCellClick({ owner_id: isOwnerSelected ? null : owner.owner_id })}
                      sx={{
                        cursor: "pointer",
                        backgroundColor: isOwnerSelected ? "#F0F9FF" : "inherit",
                        "&:hover": { backgroundColor: isOwnerSelected ? "#E0F2FE" : "#F8FAFC" },
                      }}
                    >
                      {/* Owner Identity */}
                      <TableCell>
                        <Box
                          onClick={() => onCellClick({ owner_id: isOwnerSelected ? null : owner.owner_id })}
                          sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 1.2 }}
                        >
                          <Box
                            sx={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              backgroundColor: colorTokens.primary.lighter,
                              color: colorTokens.primary.dark,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              flexShrink: 0,
                              border: `1px solid ${colorTokens.primary.light}`,
                            }}
                          >
                            {owner.initials || "U"}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, fontSize: "0.82rem" }}>
                              {owner.owner_name}
                            </Typography>
                            {owner.username && (
                              <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.68rem" }}>
                                @{owner.username}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Open Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ owner_id: owner.owner_id, status: "Open" });
                          }}
                          sx={{
                            cursor: "pointer",
                            py: 0.25,
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: owner.open > 0 ? "#0284C7" : "#94A3B8",
                            "&:hover": { backgroundColor: "#F0F9FF" },
                          }}
                        >
                          {owner.open}
                        </Box>
                      </TableCell>

                      {/* In Progress Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ owner_id: owner.owner_id, status: "WIP" });
                          }}
                          sx={{
                            cursor: "pointer",
                            py: 0.25,
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: owner.wip > 0 ? "#D97706" : "#94A3B8",
                            "&:hover": { backgroundColor: "#FEF3C7" },
                          }}
                        >
                          {owner.wip}
                        </Box>
                      </TableCell>

                      {/* Closed Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ owner_id: owner.owner_id, status: "Closed" });
                          }}
                          sx={{
                            cursor: "pointer",
                            py: 0.25,
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: owner.closed > 0 ? "#16A34A" : "#94A3B8",
                            "&:hover": { backgroundColor: "#ECFDF5" },
                          }}
                        >
                          {owner.closed}
                        </Box>
                      </TableCell>

                      {/* Overdue Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ owner_id: owner.owner_id, is_overdue: true });
                          }}
                          sx={{
                            cursor: "pointer",
                            display: "inline-flex",
                            justifyContent: "center",
                          }}
                        >
                          {owner.overdue > 0 ? (
                            <Chip
                              label={owner.overdue}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                backgroundColor: "#FEE2E2",
                                color: "#DC2626",
                                cursor: "pointer",
                                "&:hover": { backgroundColor: "#FCA5A5" },
                              }}
                            />
                          ) : (
                            <span style={{ color: "#94A3B8", fontSize: "0.8rem" }}>0</span>
                          )}
                        </Box>
                      </TableCell>

                      {/* Total Cell */}
                      <TableCell align="center">
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellClick({ owner_id: owner.owner_id });
                          }}
                          sx={{
                            cursor: "pointer",
                            fontWeight: 800,
                            fontSize: "0.85rem",
                            color: colorTokens.text.primary,
                            "&:hover": { color: colorTokens.primary.main },
                          }}
                        >
                          {owner.total}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )
            )}
          </TableBody>

          {/* Grand Totals Footer */}
          <TableFooter>
            <TableRow sx={{ backgroundColor: "#F1F5F9", borderTop: `2px solid ${colorTokens.workspace.border}` }}>
              <TableCell sx={{ fontWeight: 800, fontSize: "0.8rem", color: colorTokens.text.primary }}>
                Enterprise Grand Total
              </TableCell>
              <TableCell align="center">
                <Box
                  onClick={() => onCellClick({ status: "Open" })}
                  sx={{
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "#0284C7",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {totalOpen}
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box
                  onClick={() => onCellClick({ status: "WIP" })}
                  sx={{
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "#D97706",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {totalWip}
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box
                  onClick={() => onCellClick({ status: "Closed" })}
                  sx={{
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "#16A34A",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {totalClosed}
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box
                  onClick={() => onCellClick({ is_overdue: true })}
                  sx={{
                    cursor: "pointer",
                    display: "inline-flex",
                    justifyContent: "center",
                  }}
                >
                  {totalOverdue > 0 ? (
                    <Chip
                      label={totalOverdue}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        backgroundColor: "#FEE2E2",
                        color: "#DC2626",
                        cursor: "pointer",
                      }}
                    />
                  ) : (
                    <span style={{ color: "#94A3B8", fontSize: "0.8rem" }}>0</span>
                  )}
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box
                  onClick={() => onCellClick({})}
                  sx={{
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    color: colorTokens.text.primary,
                    "&:hover": { color: colorTokens.primary.main },
                  }}
                >
                  {totalActions}
                </Box>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Paper>
  );
};
