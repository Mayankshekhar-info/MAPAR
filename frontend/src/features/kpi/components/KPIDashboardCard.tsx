import React, { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  LinearProgress,
  Chip,
  Collapse,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";

import { KPIDashboardCard as CardData, RAGStatusType } from "../types/kpi";

interface KPIDashboardCardProps {
  data: CardData;
  onInspect: (card: CardData) => void;
  onRecalculate?: (card: CardData) => void;
  isCalculating?: boolean;
}

const mapStatusToColor = (
  statusCode?: string,
  ragStatus?: RAGStatusType
): { bg: string; text: string; border: string; label: string; icon: "check" | "warning" | "error" | "help" } => {
  if (statusCode === "NO_DATA" || statusCode === "PENDING_DATA") {
    return {
      bg: "#F1F5F9",
      text: "#475569",
      border: "#CBD5E1",
      label: statusCode === "PENDING_DATA" ? "Pending Data" : "No Data Available",
      icon: "help",
    };
  }
  if (statusCode === "CONFIG_INVALID" || statusCode === "COLUMN_MISSING") {
    return {
      bg: "#FFFBEB",
      text: "#92400E",
      border: "#FCD34D",
      label: statusCode === "COLUMN_MISSING" ? "Column Missing in Upload" : "Configuration Invalid",
      icon: "warning",
    };
  }
  if (statusCode === "FAILED") {
    return {
      bg: "#FEE2E2",
      text: "#991B1B",
      border: "#FCA5A5",
      label: "Calculation Failed",
      icon: "error",
    };
  }
  if (statusCode === "PENDING") {
    return {
      bg: "#E0F2FE",
      text: "#075985",
      border: "#7DD3FC",
      label: "Pending Calculation",
      icon: "help",
    };
  }

  // Exact descriptive status mapping
  if (statusCode === "MET" || statusCode === "MEETS_TARGET") {
    return {
      bg: "#ECFDF5",
      text: "#065F46",
      border: "#A7F3D0",
      label: "Meets Target",
      icon: "check",
    };
  }
  if (statusCode === "NOT_MET" || statusCode === "BELOW_TARGET") {
    return {
      bg: "#FEF2F2",
      text: "#991B1B",
      border: "#FECACA",
      label: "Below Target",
      icon: "error",
    };
  }
  if (statusCode === "EXCEEDED_LIMIT") {
    return {
      bg: "#FEF2F2",
      text: "#991B1B",
      border: "#FECACA",
      label: "Exceeded Limit",
      icon: "error",
    };
  }
  if (statusCode === "DOES_NOT_MATCH") {
    return {
      bg: "#FEF2F2",
      text: "#991B1B",
      border: "#FECACA",
      label: "Does Not Match",
      icon: "error",
    };
  }

  // Fallback to RAG
  if (ragStatus === "GREEN") {
    return {
      bg: "#ECFDF5",
      text: "#065F46",
      border: "#A7F3D0",
      label: "Meets Target",
      icon: "check",
    };
  }
  if (ragStatus === "AMBER") {
    return {
      bg: "#FFFBEB",
      text: "#B45309",
      border: "#FDE68A",
      label: "Warning Threshold",
      icon: "warning",
    };
  }
  if (ragStatus === "RED") {
    return {
      bg: "#FEF2F2",
      text: "#991B1B",
      border: "#FECACA",
      label: "Below Target",
      icon: "error",
    };
  }

  return {
    bg: "#F8FAFC",
    text: "#64748B",
    border: "#E2E8F0",
    label: "Evaluating",
    icon: "help",
  };
};

export const KPIDashboardCard: React.FC<KPIDashboardCardProps> = ({
  data,
  onInspect,
  onRecalculate,
  isCalculating = false,
}) => {
  const [activeCompTab, setActiveCompTab] = useState(0);
  const [showFunnel, setShowFunnel] = useState(false);

  const funnel = data.funnel_breakdown;
  const configuredComparisons = (data.presentation_config?.comparisons || (funnel as any)?.comparisons || []) as any[];

  // Fallback primary comparison if none configured
  const comparisonsToRender =
    configuredComparisons.length > 0
      ? configuredComparisons
      : [
          {
            name: data.kpi_name,
            metric_label: "Standard Target",
            unit: data.unit,
            target_value: data.target_value,
            actual_value: data.calculated_value,
            calculated_actual: data.calculated_value,
            calculated_variance: data.variance_to_target,
            achievement_percentage: data.achievement_percentage,
            performance_status: data.calculation_status === "NO_DATA" ? "NO_DATA" : data.rag_status === "GREEN" ? "MEETS_TARGET" : "BELOW_TARGET",
            rag_status: data.rag_status,
            dataset_name: (funnel as any)?.source_dataset_name || "Uploads",
          },
        ];

  const currentComp = comparisonsToRender[Math.min(activeCompTab, comparisonsToRender.length - 1)] || comparisonsToRender[0];

  // Resolve calculation status & colors
  const statusCode = currentComp.performance_status || data.calculation_status;
  const statusMeta = mapStatusToColor(statusCode, currentComp.rag_status || data.rag_status);

  // Values resolution
  const targetVal =
    currentComp.target_value !== null && currentComp.target_value !== undefined && currentComp.target_value !== ""
      ? Number(currentComp.target_value)
      : data.target_value;

  const actualVal =
    currentComp.calculated_actual !== null && currentComp.calculated_actual !== undefined
      ? currentComp.calculated_actual
      : currentComp.actual_value !== null && currentComp.actual_value !== undefined && currentComp.actual_value !== ""
      ? Number(currentComp.actual_value)
      : data.calculated_value;

  const varianceVal =
    currentComp.calculated_variance !== null && currentComp.calculated_variance !== undefined
      ? currentComp.calculated_variance
      : data.variance_to_target;

  const achievementPct =
    currentComp.achievement_percentage !== null && currentComp.achievement_percentage !== undefined
      ? currentComp.achievement_percentage
      : data.achievement_percentage;

  const unit = currentComp.unit || data.unit || "%";
  const reportingPeriod = (funnel as any)?.reporting_period || "Active Period";
  const sourceDatasetName = currentComp.dataset_name || (funnel as any)?.source_dataset_name || "Uploaded Dataset";
  const isNoData = statusCode === "NO_DATA" || (actualVal === null && targetVal !== null);

  // Calculate clean Progress Bar value
  let progressPct = 0;
  if (targetVal && actualVal !== null && !isNoData) {
    if (achievementPct !== null && achievementPct !== undefined) {
      progressPct = Math.min(Math.max(achievementPct, 0), 100);
    } else if (targetVal > 0) {
      progressPct = Math.min(Math.max((actualVal / targetVal) * 100, 0), 100);
    }
  }

  // Format Gap text (Section 8 & 10 layout spec)
  const formatGapText = () => {
    if (data.error_message) {
      return data.error_message;
    }
    if (isNoData) return "No compatible records in selected period";
    if (varianceVal === null || varianceVal === undefined) return "Gap: Not calculated";

    const formattedGap = varianceVal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const sign = varianceVal > 0 ? "+" : "";

    if (unit === "%") {
      return `Gap: ${sign}${formattedGap} percentage points`;
    }
    if (currentComp.performance_direction === "LOWER_BETTER" && varianceVal > 0) {
      return `Gap: ${formattedGap} ${unit} above the limit`;
    }
    return `Gap: ${sign}${formattedGap} ${unit}`;
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        border: "1px solid",
        borderColor: "divider",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          borderColor: "primary.300",
        },
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        bgcolor: "#ffffff",
      }}
    >
      <CardContent sx={{ p: 2.5, pb: 2, display: "flex", flexDirection: "column", gap: 1.8 }}>
        {/* ========================================================================= */}
        {/* HEADER: KPI Code, Assigned Node, Reporting Period, Actions                */}
        {/* ========================================================================= */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap", mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: "primary.main",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  fontSize: "0.72rem",
                }}
              >
                {data.kpi_code}
              </Typography>

              {data.assigned_hierarchy_level && (
                <Chip
                  size="small"
                  icon={<AccountTreeOutlinedIcon sx={{ fontSize: "0.75rem !important" }} />}
                  label={data.hierarchy_name || data.assigned_hierarchy_level}
                  sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600, bgcolor: "grey.100" }}
                  variant="outlined"
                />
              )}

              <Chip
                size="small"
                icon={<CalendarTodayOutlinedIcon sx={{ fontSize: "0.7rem !important" }} />}
                label={reportingPeriod}
                sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600, bgcolor: "primary.50", color: "primary.800" }}
              />
            </Box>

            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                lineHeight: 1.3,
                fontSize: "1.05rem",
                wordBreak: "break-word",
              }}
            >
              {data.kpi_name}
            </Typography>
          </Box>

          {/* Action icons */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            {onRecalculate && (
              <Tooltip title="Recalculate from Uploaded Data">
                <IconButton
                  size="small"
                  disabled={isCalculating}
                  onClick={() => onRecalculate(data)}
                  sx={{ color: "text.secondary" }}
                >
                  <RefreshIcon fontSize="small" sx={{ animation: isCalculating ? "spin 1s linear infinite" : "none" }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Inspect Calculation Lineage & Records">
              <IconButton size="small" onClick={() => onInspect(data)} sx={{ color: "text.secondary" }}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Multi-Comparison Tabs (if more than 1 comparison configured) */}
        {comparisonsToRender.length > 1 && (
          <Box sx={{ borderBottom: 1, borderColor: "divider", mt: -0.5 }}>
            <Tabs
              value={activeCompTab}
              onChange={(_, val) => setActiveCompTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 32,
                "& .MuiTab-root": {
                  minHeight: 32,
                  py: 0.5,
                  px: 1.5,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "none",
                },
              }}
            >
              {comparisonsToRender.map((c, idx) => (
                <Tab key={idx} label={c.name || `Comparison ${idx + 1}`} />
              ))}
            </Tabs>
          </Box>
        )}

        {/* ========================================================================= */}
        {/* COMPARISON METRIC BLOCK: TARGET vs ACTUAL (Section 10 Layout Spec)        */}
        {/* ========================================================================= */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 0.5 }}>
          {/* Target Box */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: "grey.50",
              border: "1px solid",
              borderColor: "grey.200",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: "text.secondary",
                letterSpacing: 0.5,
                textTransform: "uppercase",
                fontSize: "0.68rem",
                display: "block",
                mb: 0.3,
              }}
            >
              Standard / Target
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary" }}>
                {targetVal !== null && targetVal !== undefined ? targetVal.toLocaleString() : "—"}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
                {unit}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
              {currentComp.performance_direction === "HIGHER_BETTER"
                ? "Higher is Better"
                : currentComp.performance_direction === "LOWER_BETTER"
                ? "Maximum Limit"
                : "Exact Target"}
            </Typography>
          </Paper>

          {/* Actual Achievement Box */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: isNoData ? "grey.50" : statusMeta.bg,
              border: "1px solid",
              borderColor: isNoData ? "grey.200" : statusMeta.border,
              transition: "all 0.2s ease",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: isNoData ? "text.secondary" : statusMeta.text,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                fontSize: "0.68rem",
                display: "block",
                mb: 0.3,
              }}
            >
              Actual Achievement
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: isNoData ? "text.secondary" : statusMeta.text,
                }}
              >
                {actualVal !== null && actualVal !== undefined
                  ? typeof actualVal === "number"
                    ? actualVal.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : actualVal
                  : "—"}
              </Typography>
              {actualVal !== null && (
                <Typography variant="body2" sx={{ fontWeight: 600, color: isNoData ? "text.secondary" : statusMeta.text }}>
                  {unit}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: isNoData ? "text.secondary" : statusMeta.text, fontSize: "0.7rem", fontWeight: 600 }}>
              {isNoData ? "No records found" : `${sourceDatasetName}`}
            </Typography>
          </Paper>
        </Box>

        {/* ========================================================================= */}
        {/* GAP / VARIANCE & PROGRESS BAR                                            */}
        {/* ========================================================================= */}
        <Box sx={{ mt: 0.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: isNoData ? "text.secondary" : statusMeta.text,
                fontSize: "0.85rem",
              }}
            >
              {formatGapText()}
            </Typography>

            {achievementPct !== null && achievementPct !== undefined && !isNoData && (
              <Typography variant="caption" sx={{ fontWeight: 700, color: statusMeta.text }}>
                {achievementPct}% Achievement
              </Typography>
            )}
          </Box>

          {/* Target vs Actual Progress Visualization */}
          {!isNoData ? (
            <Box sx={{ position: "relative", width: "100%", my: 0.5 }}>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: "grey.200",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: statusMeta.text,
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          ) : (
            <Box sx={{ py: 0.5 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                Upload dataset matching reporting period to view actual performance.
              </Typography>
            </Box>
          )}
        </Box>

        {/* Multi-Rule Table (when comparison has multiple column rules) */}
        {currentComp.rules && currentComp.rules.length > 1 && (
          <Box sx={{ mt: 0.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Configured Column Rules ({currentComp.rules.length})
              </Typography>
              {currentComp.overall_status_label && (
                <Chip
                  size="small"
                  label={`Overall: ${currentComp.overall_status_label}`}
                  sx={{
                    height: 20,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    bgcolor: currentComp.overall_status === "MET" ? "#ECFDF5" : currentComp.overall_status === "CONFIG_INVALID" ? "#FFFBEB" : "#FEF2F2",
                    color: currentComp.overall_status === "MET" ? "#065F46" : currentComp.overall_status === "CONFIG_INVALID" ? "#92400E" : "#991B1B",
                    border: "1px solid",
                    borderColor: currentComp.overall_status === "MET" ? "#A7F3D0" : currentComp.overall_status === "CONFIG_INVALID" ? "#FCD34D" : "#FECACA",
                  }}
                />
              )}
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, maxHeight: 220, overflowY: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ "& th": { bgcolor: "grey.100", fontWeight: 700, fontSize: "0.7rem", py: 0.6 } }}>
                  <TableRow>
                    <TableCell>Excel Column</TableCell>
                    <TableCell align="right">Standard</TableCell>
                    <TableCell align="right">Achieved</TableCell>
                    <TableCell>Direction</TableCell>
                    <TableCell align="right">Variance</TableCell>
                    <TableCell align="center">Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentComp.rules.map((rule: any, rIdx: number) => {
                    const ruleStatus = rule.status_label || (rule.performance_status === "MEETS_TARGET" ? "Met" : rule.performance_status === "DOES_NOT_MATCH" || rule.performance_status === "BELOW_TARGET" || rule.performance_status === "EXCEEDED_LIMIT" ? "Not Met" : rule.calculation_status === "NO_DATA" ? "Pending Data" : rule.calculation_status === "CONFIG_INVALID" ? "Column Missing" : "Evaluating");
                    const isRuleMet = ruleStatus === "Met" || rule.performance_status === "MEETS_TARGET";
                    const isRuleMissing = ruleStatus === "Column Missing" || rule.calculation_status === "CONFIG_INVALID";
                    const isRulePending = ruleStatus === "Pending Data" || rule.calculation_status === "NO_DATA";

                    return (
                      <TableRow key={rule.id || rIdx} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600, py: 0.6, maxWidth: 160, wordBreak: "break-word" }}>
                          {rule.achieved_data_column || "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", py: 0.6 }}>
                          {rule.standard_value ?? "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: 700, py: 0.6 }}>
                          {rule.calculated_actual !== null && rule.calculated_actual !== undefined
                            ? typeof rule.calculated_actual === "number"
                              ? rule.calculated_actual.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : rule.calculated_actual
                            : "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", py: 0.6, color: "text.secondary" }}>
                          {rule.performance_direction === "HIGHER_BETTER"
                            ? "Higher is Better"
                            : rule.performance_direction === "LOWER_BETTER"
                            ? "Lower is Better"
                            : "Exact Target"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: 600, py: 0.6, color: isRuleMet ? "success.dark" : "text.secondary" }}>
                          {rule.calculated_variance !== null && rule.calculated_variance !== undefined
                            ? rule.calculated_variance > 0
                              ? `+${rule.calculated_variance}`
                              : rule.calculated_variance
                            : "—"}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 0.6 }}>
                          <Chip
                            size="small"
                            label={ruleStatus}
                            sx={{
                              height: 18,
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              bgcolor: isRuleMet ? "#ECFDF5" : isRuleMissing ? "#FFFBEB" : isRulePending ? "#F1F5F9" : "#FEF2F2",
                              color: isRuleMet ? "#065F46" : isRuleMissing ? "#92400E" : isRulePending ? "#475569" : "#991B1B",
                              border: "1px solid",
                              borderColor: isRuleMet ? "#A7F3D0" : isRuleMissing ? "#FCD34D" : isRulePending ? "#CBD5E1" : "#FECACA",
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ========================================================================= */}
        {/* STATUS ROW: Status Badge & Metric Lineage Details                         */}
        {/* ========================================================================= */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Chip
            size="small"
            icon={
              statusMeta.icon === "check" ? (
                <CheckCircleOutlineIcon sx={{ fontSize: "0.85rem !important", color: `${statusMeta.text} !important` }} />
              ) : statusMeta.icon === "warning" ? (
                <WarningAmberIcon sx={{ fontSize: "0.85rem !important", color: `${statusMeta.text} !important` }} />
              ) : statusMeta.icon === "error" ? (
                <ErrorOutlineIcon sx={{ fontSize: "0.85rem !important", color: `${statusMeta.text} !important` }} />
              ) : (
                <HelpOutlineIcon sx={{ fontSize: "0.85rem !important", color: `${statusMeta.text} !important` }} />
              )
            }
            label={currentComp.overall_status_label ? `Status: ${currentComp.overall_status_label}` : `Status: ${statusMeta.label}`}
            sx={{
              bgcolor: statusMeta.bg,
              color: statusMeta.text,
              border: "1px solid",
              borderColor: statusMeta.border,
              fontWeight: 700,
              fontSize: "0.75rem",
              height: 26,
            }}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <CloudUploadOutlinedIcon sx={{ fontSize: "0.85rem", color: "text.secondary" }} />
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              Source: {sourceDatasetName}
            </Typography>
          </Box>
        </Box>

        {/* Collapsible Funnel Drawer (Lineage Audit) */}
        {funnel && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              onClick={() => setShowFunnel(!showFunnel)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                py: 0.4,
                px: 1,
                borderRadius: 1,
                bgcolor: "grey.50",
                border: "1px solid",
                borderColor: "grey.200",
                "&:hover": { bgcolor: "grey.100" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <FilterAltOutlinedIcon sx={{ fontSize: "0.8rem", color: "primary.main" }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  Record Lineage & Scoping ({funnel.reporting_period_records ?? data.records_considered} evaluated)
                </Typography>
              </Box>
              {showFunnel ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>
            <Collapse in={showFunnel}>
              <Box sx={{ p: 1.2, mt: 0.5, bgcolor: "background.paper", borderRadius: 1.5, border: "1px solid", borderColor: "divider", fontSize: "0.75rem" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
                  <span>1. Total Uploaded in Dataset:</span>
                  <strong>{funnel.total_uploaded_records ?? data.records_considered} records</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
                  <span>2. Within Org Scope ({funnel.organization_scope || "Assigned Node"}):</span>
                  <strong>{funnel.organization_scope_records ?? data.records_considered} records</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
                  <span>3. In Reporting Period ({reportingPeriod}):</span>
                  <strong>{funnel.reporting_period_records ?? data.records_considered} records</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", color: "primary.main", fontWeight: 700 }}>
                  <span>4. Evaluated for Metric:</span>
                  <strong>{funnel.kpi_filtered_records ?? data.records_considered} rows</strong>
                </Box>
              </Box>
            </Collapse>
          </Box>
        )}
      </CardContent>

      <Divider />

      {/* ========================================================================= */}
      {/* FOOTER: Freshness, Records Count, Last Calculated Timestamp               */}
      {/* ========================================================================= */}
      <Box
        sx={{
          px: 2.5,
          py: 1.2,
          bgcolor: "grey.50",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
          Last Calculated:{" "}
          <strong>
            {data.calculated_at
              ? new Date(data.calculated_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"}
          </strong>
        </Typography>

        <Typography
          variant="caption"
          onClick={() => onInspect(data)}
          sx={{
            color: "primary.main",
            fontSize: "0.72rem",
            fontWeight: 700,
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
            display: "flex",
            alignItems: "center",
            gap: 0.4,
          }}
        >
          <TableChartOutlinedIcon sx={{ fontSize: "0.85rem" }} />
          Inspect Records ({data.records_considered})
        </Typography>
      </Box>
    </Card>
  );
};
