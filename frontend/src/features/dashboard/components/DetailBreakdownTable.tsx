import React, { useState } from "react";
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
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { DetailRecord, DetailBreakdownResponse } from "../types/cockpit.types";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

interface DetailBreakdownTableProps {
  detailData: DetailBreakdownResponse | null | undefined;
  isLoading: boolean;
  onSelectRecord: (recordId: number) => void;
  onInspectRecord?: (recordId: number) => void;
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

function formatDirection(dir?: string): string {
  if (!dir) return "Higher is Better";
  switch (dir.toUpperCase()) {
    case "LOWER_BETTER":
      return "Lower is Better";
    case "EXACT_TARGET":
      return "Exact Target";
    default:
      return "Higher is Better";
  }
}

export const DetailBreakdownTable: React.FC<DetailBreakdownTableProps> = ({
  detailData,
  isLoading,
  onSelectRecord,
  onInspectRecord,
}) => {
  const context = detailData?.context;
  const records = detailData?.records || [];
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const toggleExpand = (recId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows((prev) => ({ ...prev, [recId]: !prev[recId] }));
  };

  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Detail Header & Context */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#F8FAFC",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              DETAIL BREAKDOWN
            </Typography>
            <Chip
              label={`${records.length} Records`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 700,
                bgcolor: "rgba(16, 185, 129, 0.1)",
                color: colorTokens.status.success.main,
              }}
            />
          </Box>
          {context ? (
            <Typography variant="caption" sx={{ color: colorTokens.primary.main, fontWeight: 600, fontSize: "0.72rem" }}>
              Scope: {context.circle_name} {context.domain_name ? `→ ${context.domain_name}` : ""}
              {context.period_name ? ` (${context.period_name})` : ""}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontSize: "0.72rem" }}>
              Select a row in the matrix to view detailed breakdown
            </Typography>
          )}
        </Box>
      </Box>

      {/* Detail Table */}
      <TableContainer sx={{ maxHeight: 420, overflowY: "auto" }}>
        <Table stickyHeader size="small" aria-label="detail breakdown table">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  bgcolor: "#1E293B",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  letterSpacing: "0.05em",
                  py: 0.8,
                  width: "36%",
                }}
              >
                KPI / COMPARISON RULE
              </TableCell>
              <TableCell
                sx={{
                  bgcolor: "#1E293B",
                  color: "#CBD5E1",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  py: 0.8,
                  width: "12%",
                }}
              >
                EXCEL COLUMN
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  bgcolor: "#1E293B",
                  color: "#CBD5E1",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  py: 0.8,
                  width: "13%",
                }}
              >
                TARGET
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  bgcolor: "#1E293B",
                  color: "#CBD5E1",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  py: 0.8,
                  width: "13%",
                }}
              >
                ACTUAL
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  bgcolor: "#1E293B",
                  color: "#CBD5E1",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  py: 0.8,
                  width: "14%",
                }}
              >
                STATUS
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  bgcolor: "#1E293B",
                  color: "#CBD5E1",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  py: 0.8,
                  width: "12%",
                }}
              >
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-detail-${idx}`}>
                  <TableCell><Skeleton variant="text" width="85%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width="60%" /></TableCell>
                  <TableCell align="center"><Skeleton variant="rounded" width={50} height={18} /></TableCell>
                  <TableCell align="center"><Skeleton variant="rounded" width={40} height={18} /></TableCell>
                </TableRow>
              ))
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5, color: colorTokens.text.secondary }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    No detailed records available for this selection.
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                    Please select a row from the Operational Summary Matrix.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              records.map((rec) => {
                const rules = rec.rules || [];
                const hasMultiRules = rules.length > 1;
                const isExpanded = Boolean(expandedRows[rec.id]);
                const firstRule = rules[0];

                return (
                  <React.Fragment key={rec.id}>
                    <TableRow
                      id={`detail-record-row-${rec.id}`}
                      sx={{
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                        bgcolor: isExpanded ? "rgba(2, 132, 199, 0.04)" : "#FFFFFF",
                        "&:hover": {
                          bgcolor: "rgba(2, 132, 199, 0.08)",
                        },
                      }}
                      onClick={() => onSelectRecord(rec.id)}
                    >
                      {/* KPI Name & Code */}
                      <TableCell sx={{ py: 0.8 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          {hasMultiRules && (
                            <IconButton
                              size="small"
                              onClick={(e) => toggleExpand(rec.id, e)}
                              sx={{ p: 0.25, color: colorTokens.primary.main }}
                            >
                              {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                            </IconButton>
                          )}
                          <Chip
                            label={rec.kpi_code}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: "0.62rem",
                              fontWeight: 700,
                              bgcolor: "#F1F5F9",
                              color: colorTokens.text.primary,
                            }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ fontSize: "0.78rem", fontWeight: 600, color: colorTokens.text.primary }}
                          >
                            {rec.kpi_name}
                          </Typography>
                          {hasMultiRules && (
                            <Chip
                              label={`${rules.length} Rules`}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                bgcolor: "rgba(2, 132, 199, 0.08)",
                                color: colorTokens.primary.main,
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      {/* Excel Column */}
                      <TableCell sx={{ py: 0.8, fontSize: "0.75rem", color: colorTokens.text.secondary }}>
                        {firstRule?.column_name || rec.kpi_unit || "—"}
                      </TableCell>

                      {/* Target */}
                      <TableCell
                        align="right"
                        sx={{
                          py: 0.8,
                          fontSize: "0.78rem",
                          fontFamily: "Roboto Mono, monospace",
                          color: colorTokens.text.secondary,
                        }}
                      >
                        {formatMetricNumber(firstRule?.standard_value ?? rec.target)}
                      </TableCell>

                      {/* Actual */}
                      <TableCell
                        align="right"
                        sx={{
                          py: 0.8,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          fontFamily: "Roboto Mono, monospace",
                          color: colorTokens.text.primary,
                        }}
                      >
                        {formatMetricNumber(firstRule?.calculated_actual ?? rec.actual)}
                      </TableCell>

                      {/* Status */}
                      <TableCell align="center" sx={{ py: 0.8 }}>
                        <StatusChip
                          status={mapStatusToChip(firstRule?.status || rec.rag_status)}
                          label={firstRule?.status_label || rec.rag_status}
                          size="small"
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="center" sx={{ py: 0.8 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                          {onInspectRecord && (
                            <Tooltip title="Inspect Uploaded Records">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInspectRecord(rec.id);
                                }}
                                sx={{ p: 0.5, color: colorTokens.primary.main, "&:hover": { bgcolor: "rgba(2, 132, 199, 0.1)" } }}
                              >
                                <TableChartOutlinedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Full Detail & Root Cause Analysis">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectRecord(rec.id);
                              }}
                              sx={{ p: 0.5, color: colorTokens.text.secondary, "&:hover": { color: colorTokens.primary.main } }}
                            >
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Sub-table for Multiple Rules if Expanded */}
                    {hasMultiRules && (
                      <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                        <TableCell colSpan={6} sx={{ p: 0, borderBottom: "1px solid #E2E8F0" }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 1.5, pl: 4, bgcolor: "#F8FAFC" }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, mb: 1, display: "block" }}>
                                CONFIGURED COLUMN RULES UNDER THIS COMPARISON:
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontSize: "0.68rem", fontWeight: 700, py: 0.5 }}>EXCEL COLUMN</TableCell>
                                    <TableCell sx={{ fontSize: "0.68rem", fontWeight: 700, py: 0.5 }}>STANDARD / TARGET</TableCell>
                                    <TableCell sx={{ fontSize: "0.68rem", fontWeight: 700, py: 0.5 }}>CALCULATED ACTUAL</TableCell>
                                    <TableCell sx={{ fontSize: "0.68rem", fontWeight: 700, py: 0.5 }}>DIRECTION</TableCell>
                                    <TableCell sx={{ fontSize: "0.68rem", fontWeight: 700, py: 0.5 }}>RULE STATUS</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {rules.map((rule, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 600, py: 0.5 }}>
                                        {rule.column_name}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.72rem", fontFamily: "Roboto Mono", py: 0.5 }}>
                                        {formatMetricNumber(rule.standard_value)}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, fontFamily: "Roboto Mono", py: 0.5 }}>
                                        {formatMetricNumber(rule.calculated_actual)}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.68rem", py: 0.5, color: colorTokens.text.secondary }}>
                                        {formatDirection(rule.performance_direction)}
                                      </TableCell>
                                      <TableCell sx={{ py: 0.5 }}>
                                        <StatusChip
                                          status={mapStatusToChip(rule.status)}
                                          label={rule.status_label || rule.status}
                                          size="small"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

