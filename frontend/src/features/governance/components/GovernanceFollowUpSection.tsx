import React, { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import NotificationImportantOutlinedIcon from "@mui/icons-material/NotificationImportantOutlined";
import Skeleton from "@mui/material/Skeleton";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { UrgentRiskItem } from "../types/governance.types";

interface GovernanceFollowUpSectionProps {
  urgentItems?: UrgentRiskItem[];
  isLoading?: boolean;
  onSelectAction: (actionId: number) => void;
  sx?: any;
}

export const GovernanceFollowUpSection: React.FC<GovernanceFollowUpSectionProps> = ({
  urgentItems = [],
  isLoading = false,
  onSelectAction,
  sx,
}) => {
  const [filterMode, setFilterMode] = useState<"all" | "overdue" | "high_priority" | "evidence">("all");

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
          <Skeleton variant="text" width={220} height={32} />
          <Skeleton variant="rounded" width={80} height={24} />
        </Box>
        <Skeleton variant="rounded" height={240} />
      </Paper>
    );
  }

  if (urgentItems.length === 0) {
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
          <NotificationImportantOutlinedIcon sx={{ fontSize: 20, color: colorTokens.primary.main }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
            Actionable Risks & Urgent Follow-up
          </Typography>
        </Box>
        <Box sx={{ p: 4, textAlign: "center" }}>
          <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 40, color: "#16A34A", mb: 1 }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Zero Urgent Risks
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 0.5 }}>
            All active action points are within target timeline and up to date.
          </Typography>
        </Box>
      </Paper>
    );
  }

  const filteredItems = urgentItems.filter((item) => {
    if (filterMode === "overdue") return item.is_overdue;
    if (filterMode === "high_priority") return item.priority === "High";
    if (filterMode === "evidence")
      return item.evidence_status === "Pending Review" || item.evidence_status === "Rework Required";
    return true;
  });

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
          <NotificationImportantOutlinedIcon sx={{ fontSize: 20, color: "#EA580C" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.95rem" }}>
            Focused Management Follow-Up
          </Typography>
          <Chip
            label={`${urgentItems.length} items requiring attention`}
            size="small"
            sx={{
              backgroundColor: "#FFF7ED",
              color: "#C2410C",
              fontWeight: 700,
              fontSize: "0.72rem",
              height: 22,
              border: "1px solid #FFEDD5",
            }}
          />
        </Box>

        {/* Quick Filter Buttons */}
        <Box sx={{ display: "flex", gap: 0.75 }}>
          <Button
            size="small"
            variant={filterMode === "all" ? "contained" : "outlined"}
            onClick={() => setFilterMode("all")}
            sx={{
              textTransform: "none",
              fontSize: "0.72rem",
              py: 0.25,
              px: 1,
              minWidth: "auto",
              fontWeight: 700,
              ...(filterMode === "all"
                ? { backgroundColor: colorTokens.primary.main }
                : { borderColor: colorTokens.workspace.border, color: colorTokens.text.secondary }),
            }}
          >
            All Critical ({urgentItems.length})
          </Button>
          <Button
            size="small"
            variant={filterMode === "overdue" ? "contained" : "outlined"}
            onClick={() => setFilterMode("overdue")}
            sx={{
              textTransform: "none",
              fontSize: "0.72rem",
              py: 0.25,
              px: 1,
              minWidth: "auto",
              fontWeight: 700,
              ...(filterMode === "overdue"
                ? { backgroundColor: "#DC2626" }
                : { borderColor: colorTokens.workspace.border, color: colorTokens.text.secondary }),
            }}
          >
            Overdue ({urgentItems.filter((i) => i.is_overdue).length})
          </Button>
          <Button
            size="small"
            variant={filterMode === "high_priority" ? "contained" : "outlined"}
            onClick={() => setFilterMode("high_priority")}
            sx={{
              textTransform: "none",
              fontSize: "0.72rem",
              py: 0.25,
              px: 1,
              minWidth: "auto",
              fontWeight: 700,
              ...(filterMode === "high_priority"
                ? { backgroundColor: "#D97706" }
                : { borderColor: colorTokens.workspace.border, color: colorTokens.text.secondary }),
            }}
          >
            High Priority ({urgentItems.filter((i) => i.priority === "High").length})
          </Button>
          <Button
            size="small"
            variant={filterMode === "evidence" ? "contained" : "outlined"}
            onClick={() => setFilterMode("evidence")}
            sx={{
              textTransform: "none",
              fontSize: "0.72rem",
              py: 0.25,
              px: 1,
              minWidth: "auto",
              fontWeight: 700,
              ...(filterMode === "evidence"
                ? { backgroundColor: "#7C3AED" }
                : { borderColor: colorTokens.workspace.border, color: colorTokens.text.secondary }),
            }}
          >
            Evidence Review (
            {urgentItems.filter((i) => i.evidence_status === "Pending Review" || i.evidence_status === "Rework Required").length}
            )
          </Button>
        </Box>
      </Box>

      {/* Table */}
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
              <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem", color: colorTokens.text.primary, width: 110 }}>
                Action ID
              </TableCell>
              <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem", color: colorTokens.text.primary }}>
                Action Point & Deliverable
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: colorTokens.text.primary, width: 140 }}>
                Circle / Owner
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: colorTokens.text.primary, width: 130 }}>
                Target Date
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: colorTokens.text.primary, width: 130 }}>
                Delay / Status
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: colorTokens.text.primary, width: 80 }}>
                Priority
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: colorTokens.text.primary, width: 90 }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3, color: colorTokens.text.muted }}>
                  No actions matching this follow-up filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{
                    "&:hover": { backgroundColor: "#F8FAFC" },
                  }}
                >
                  {/* Action ID */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      onClick={() => onSelectAction(item.id)}
                      sx={{
                        fontWeight: 700,
                        color: colorTokens.primary.main,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      {item.action_id}
                    </Typography>
                  </TableCell>

                  {/* Title */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: colorTokens.text.primary,
                        fontSize: "0.8rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {item.action_point}
                    </Typography>
                  </TableCell>

                  {/* Circle & Owner */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.78rem", color: colorTokens.text.primary }}>
                      {item.owner_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem", display: "block" }}>
                      {item.circle_name} ({item.circle_code})
                    </Typography>
                  </TableCell>

                  {/* Target Date */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600, color: colorTokens.text.primary }}>
                      {item.current_target_date || "—"}
                    </Typography>
                  </TableCell>

                  {/* Delay / Urgency Badge */}
                  <TableCell>
                    {item.is_overdue ? (
                      <Chip
                        label={`${item.days_overdue}d overdue`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          backgroundColor: "#FEE2E2",
                          color: "#DC2626",
                        }}
                      />
                    ) : (
                      <Chip
                        label="On Track"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                        }}
                      />
                    )}
                    {item.evidence_status === "Pending Review" && (
                      <Chip
                        label="Pending Review"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          backgroundColor: "#F5F3FF",
                          color: "#7C3AED",
                          ml: 0.5,
                        }}
                      />
                    )}
                    {item.evidence_status === "Rework Required" && (
                      <Chip
                        label="Rework"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          backgroundColor: "#FEF2F2",
                          color: "#DC2626",
                          ml: 0.5,
                        }}
                      />
                    )}
                  </TableCell>

                  {/* Priority */}
                  <TableCell align="center">
                    <Chip
                      label={item.priority}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        backgroundColor:
                          item.priority === "High" ? "#FEE2E2" : item.priority === "Medium" ? "#FEF3C7" : "#F1F5F9",
                        color:
                          item.priority === "High" ? "#DC2626" : item.priority === "Medium" ? "#D97706" : "#475569",
                      }}
                    />
                  </TableCell>

                  {/* Action Button */}
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewIcon sx={{ fontSize: "12px !important" }} />}
                      onClick={() => onSelectAction(item.id)}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.7rem",
                        py: 0.25,
                        px: 1,
                        borderColor: colorTokens.workspace.border,
                        color: colorTokens.primary.main,
                        "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
                      }}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
