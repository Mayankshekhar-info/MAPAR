import React from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import { MasterSummaryRow } from "../types/cockpit.types";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

interface MasterSummaryMatrixProps {
  rows: MasterSummaryRow[];
  totalRecords: number;
  selectedRowId: string | null;
  isLoading: boolean;
  onSelectRow: (row: MasterSummaryRow) => void;
  metricsSummary?: {
    total_kpis: number;
    green_kpis: number;
    amber_kpis: number;
    red_kpis: number;
    overall_achievement: number;
    total_comparisons?: number;
    rules_met?: number;
    rules_not_met?: number;
    rules_pending_data?: number;
    rules_config_issue?: number;
    last_calculated_at?: string | null;
    has_data?: boolean;
  };
}

function formatMetricNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function mapStatusToChip(status: string): "success" | "warning" | "error" | "neutral" {
  switch (status?.toUpperCase()) {
    case "GREEN":
    case "MET":
    case "OPTIMAL":
    case "MEETS_TARGET":
      return "success";
    case "AMBER":
    case "WARNING":
      return "warning";
    case "RED":
    case "NOT_MET":
    case "CRITICAL":
    case "BELOW_TARGET":
      return "error";
    default:
      return "neutral";
  }
}

export const MasterSummaryMatrix: React.FC<MasterSummaryMatrixProps> = ({
  rows,
  totalRecords,
  selectedRowId,
  isLoading,
  onSelectRow,
  metricsSummary,
}) => {
  const totalComparisons = metricsSummary?.total_comparisons ?? totalRecords;
  const rulesMet = metricsSummary?.rules_met ?? (metricsSummary?.green_kpis || 0);
  const rulesNotMet = metricsSummary?.rules_not_met ?? ((metricsSummary?.amber_kpis || 0) + (metricsSummary?.red_kpis || 0));
  const rulesPending = metricsSummary?.rules_pending_data ?? 0;
  const rulesIssues = metricsSummary?.rules_config_issue ?? 0;
  const lastCalc = metricsSummary?.last_calculated_at
    ? new Date(metricsSummary.last_calculated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Executive Management Scorecard Bar */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: "#0F172A",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          borderBottom: "1px solid #1E293B",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.68rem", fontWeight: 700, display: "block" }}>
              TOTAL COMPARISONS
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#38BDF8", fontFamily: "Roboto Mono", lineHeight: 1.1 }}>
              {totalComparisons}
            </Typography>
          </Box>

          <Box sx={{ borderLeft: "1px solid rgba(255,255,255,0.15)", pl: 1.5 }}>
            <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.68rem", fontWeight: 700, display: "block" }}>
              MEETING TARGET (MET)
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#34D399", fontFamily: "Roboto Mono", lineHeight: 1.1 }}>
              {rulesMet}
            </Typography>
          </Box>

          <Box sx={{ borderLeft: "1px solid rgba(255,255,255,0.15)", pl: 1.5 }}>
            <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.68rem", fontWeight: 700, display: "block" }}>
              ACTION REQUIRED (NOT MET)
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#F87171", fontFamily: "Roboto Mono", lineHeight: 1.1 }}>
              {rulesNotMet}
            </Typography>
          </Box>

          {rulesPending > 0 && (
            <Box sx={{ borderLeft: "1px solid rgba(255,255,255,0.15)", pl: 1.5 }}>
              <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.68rem", fontWeight: 700, display: "block" }}>
                AWAITING DATA
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#FBBF24", fontFamily: "Roboto Mono", lineHeight: 1.1 }}>
                {rulesPending}
              </Typography>
            </Box>
          )}

          {rulesIssues > 0 && (
            <Box sx={{ borderLeft: "1px solid rgba(255,255,255,0.15)", pl: 1.5 }}>
              <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.68rem", fontWeight: 700, display: "block" }}>
                CONFIG / MISSING
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#E879F9", fontFamily: "Roboto Mono", lineHeight: 1.1 }}>
                {rulesIssues}
              </Typography>
            </Box>
          )}
        </Box>

        {lastCalc && (
          <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: "0.7rem" }}>
            Calculated: <strong>{lastCalc}</strong>
          </Typography>
        )}
      </Box>

      {/* Matrix Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "#F8FAFC",
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, color: colorTokens.text.primary, letterSpacing: "0.02em" }}
            >
              OPERATIONAL SUMMARY MATRIX
            </Typography>
            <Chip
              label={`${totalRecords} Rows`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 700,
                bgcolor: "rgba(2, 132, 199, 0.1)",
                color: colorTokens.primary.main,
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.72rem" }}>
            Select an organization row to view calculated KPI rules & deep supporting records
          </Typography>
        </Box>
      </Box>

      {/* Table Container */}
      <TableContainer sx={{ flex: 1, maxHeight: 680, overflowY: "auto" }}>
        <Table stickyHeader size="small" aria-label="operational summary matrix">
          {/* Grouped Table Header */}
          <TableHead>
            {/* Top Group Row */}
            <TableRow>
              <TableCell
                colSpan={2}
                align="center"
                sx={{
                  bgcolor: "#0F172A",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  py: 0.6,
                  borderRight: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                ORGANIZATIONAL UNIT
              </TableCell>
              <TableCell
                colSpan={4}
                align="center"
                sx={{
                  bgcolor: "#1E293B",
                  color: "#38BDF8",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  py: 0.6,
                }}
              >
                PERFORMANCE METRICS
              </TableCell>
            </TableRow>

            {/* Sub-column Row */}
            <TableRow>
              <TableCell
                sx={{
                  bgcolor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.primary,
                  py: 0.8,
                  width: "24%",
                }}
              >
                CIRCLE
              </TableCell>
              <TableCell
                sx={{
                  bgcolor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.primary,
                  py: 0.8,
                  width: "32%",
                  borderRight: `1px solid ${colorTokens.workspace.border}`,
                }}
              >
                DEPARTMENT / DOMAIN
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  bgcolor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.primary,
                  py: 0.8,
                  width: "15%",
                }}
              >
                TARGET
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  bgcolor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.primary,
                  py: 0.8,
                  width: "15%",
                }}
              >
                ACTUAL
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  bgcolor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.primary,
                  py: 0.8,
                  width: "14%",
                }}
              >
                ACH %
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  bgcolor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.primary,
                  py: 0.8,
                  width: "15%",
                }}
              >
                STATUS
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="90%" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width="50%" /></TableCell>
                  <TableCell align="center"><Skeleton variant="rounded" width={55} height={18} /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: colorTokens.text.secondary }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mb: 0.5 }}>
                    No calculated KPI results or uploaded data available for this scope.
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary, maxWidth: 450, display: "block", mx: "auto" }}>
                    Excel file upload, schema column validation, or KPI calculation engine execution is pending. You can upload data via the Uploads module or adjust the reporting period above.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isSelected = selectedRowId === row.id;
                const isSubtotal = row.is_subtotal;
                const isGrandTotal = row.is_grand_total;

                return (
                  <TableRow
                    key={row.id}
                    id={`cockpit-row-${row.id}`}
                    onClick={() => onSelectRow(row)}
                    sx={{
                      cursor: isGrandTotal ? "default" : "pointer",
                      transition: "background-color 0.15s ease",
                      bgcolor: isSelected
                        ? "rgba(2, 132, 199, 0.12)"
                        : isGrandTotal
                        ? "#E2E8F0"
                        : isSubtotal
                        ? "#F0F9FF"
                        : "inherit",
                      borderLeft: isSelected
                        ? `3px solid ${colorTokens.primary.main}`
                        : isSubtotal
                        ? `3px solid ${colorTokens.primary.main}`
                        : "3px solid transparent",
                      "&:hover": {
                        bgcolor: isGrandTotal
                          ? "#E2E8F0"
                          : isSelected
                          ? "rgba(2, 132, 199, 0.16)"
                          : isSubtotal
                          ? "#E0F2FE"
                          : "#F1F5F9",
                      },
                    }}
                  >
                    {/* Circle Column */}
                    <TableCell
                      sx={{
                        py: isSubtotal ? 1.0 : 0.75,
                        fontSize: "0.78rem",
                        fontWeight: isSubtotal || isGrandTotal ? 700 : 500,
                        color: isGrandTotal
                          ? "#0F172A"
                          : isSubtotal
                          ? colorTokens.primary.main
                          : colorTokens.text.primary,
                      }}
                    >
                      {isGrandTotal ? "National / All" : row.circle_name}
                    </TableCell>

                    {/* Department / Domain Column */}
                    <TableCell
                      sx={{
                        py: isSubtotal ? 1.0 : 0.75,
                        fontSize: "0.78rem",
                        fontWeight: isSubtotal || isGrandTotal ? 700 : 400,
                        color: isSubtotal ? colorTokens.primary.main : colorTokens.text.primary,
                        borderRight: `1px solid ${colorTokens.workspace.border}`,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{row.domain_name}</span>
                        {!isGrandTotal && (
                          <Tooltip title={`${row.kpi_count} Universal KPIs monitored`}>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{
                                fontSize: "0.68rem",
                                color: colorTokens.text.secondary,
                                bgcolor: "rgba(0, 0, 0, 0.04)",
                                px: 0.6,
                                py: 0.1,
                                borderRadius: 1,
                              }}
                            >
                              {row.kpi_count} KPI{row.kpi_count > 1 ? "s" : ""}
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>

                    {/* Target Metric */}
                    <TableCell
                      align="right"
                      sx={{
                        py: isSubtotal ? 1.0 : 0.75,
                        fontSize: "0.78rem",
                        fontWeight: isSubtotal || isGrandTotal ? 700 : 400,
                        fontFamily: "Roboto Mono, monospace",
                        color: colorTokens.text.secondary,
                      }}
                    >
                      {formatMetricNumber(row.target)}
                    </TableCell>

                    {/* Actual Metric */}
                    <TableCell
                      align="right"
                      sx={{
                        py: isSubtotal ? 1.0 : 0.75,
                        fontSize: "0.78rem",
                        fontWeight: isSubtotal || isGrandTotal ? 700 : 600,
                        fontFamily: "Roboto Mono, monospace",
                        color: colorTokens.text.primary,
                      }}
                    >
                      {formatMetricNumber(row.actual)}
                    </TableCell>

                    {/* Achievement % */}
                    <TableCell
                      align="right"
                      sx={{
                        py: isSubtotal ? 1.0 : 0.75,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        fontFamily: "Roboto Mono, monospace",
                        color:
                          row.achievement_pct >= 95
                            ? colorTokens.status.success.main
                            : row.achievement_pct >= 85
                            ? colorTokens.status.warning.main
                            : colorTokens.status.error.main,
                      }}
                    >
                      {row.achievement_pct.toFixed(1)}%
                    </TableCell>

                    {/* Status Chip */}
                    <TableCell align="center" sx={{ py: isSubtotal ? 1.0 : 0.75 }}>
                      <StatusChip
                        status={mapStatusToChip(row.status)}
                        label={row.status}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
