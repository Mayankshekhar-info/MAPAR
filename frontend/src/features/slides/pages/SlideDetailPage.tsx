import React, { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import HistoryIcon from "@mui/icons-material/History";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import SearchIcon from "@mui/icons-material/Search";

import { useSlideDetail } from "../hooks/useSlideDetail";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";

export const SlideDetailPage: React.FC = () => {
  const { recordId, detail, isLoading, error, refetch, isFromCockpit, backLabel, handleBack } = useSlideDetail();

  const getRagColors = (rag?: string) => {
    switch (rag?.toUpperCase()) {
      case "GREEN":
        return colorTokens.status.success;
      case "AMBER":
        return colorTokens.status.warning;
      case "RED":
        return colorTokens.status.error;
      default:
        return colorTokens.status.neutral;
    }
  };

  const renderTrendIcon = (trend?: string) => {
    if (trend === "UP") return <TrendingUpIcon sx={{ color: colorTokens.status.success.main, fontSize: 18 }} />;
    if (trend === "DOWN") return <TrendingDownIcon sx={{ color: colorTokens.status.error.main, fontSize: 18 }} />;
    return <TrendingFlatIcon sx={{ color: colorTokens.text.muted, fontSize: 18 }} />;
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null || isNaN(num)) return "0.0";
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(num);
  };

  if (isLoading) {
    return (
      <Box sx={{ pb: 4 }}>
        <Skeleton variant="rectangular" width={180} height={36} sx={{ mb: 3, borderRadius: radiusTokens.md }} />
        <Skeleton variant="rectangular" width="60%" height={28} sx={{ mb: 2, borderRadius: radiusTokens.sm }} />
        <Skeleton variant="rectangular" width="100%" height={160} sx={{ mb: 3, borderRadius: radiusTokens.lg }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: radiusTokens.lg }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: radiusTokens.lg }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !detail) {
    return (
      <Box sx={{ pb: 4, maxWidth: 650, mx: "auto", mt: 6 }}>
        <Alert
          severity="error"
          sx={{ borderRadius: radiusTokens.lg, p: 3 }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 800 }}>Record Access Error</AlertTitle>
          Operational record #{recordId} could not be retrieved. You may lack authorization for this Circle, or the record does not exist.
        </Alert>
        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            sx={{ borderRadius: radiusTokens.md, textTransform: "none", fontWeight: 600 }}
          >
            {backLabel}
          </Button>
        </Box>
      </Box>
    );
  }

  const {
    resource,
    hierarchy,
    metrics,
    source,
    audit_history,
    issues,
    actions,
    related_records,
    upload_provenance,
    comparisons,
    staged_records,
    staged_columns,
    total_staged_records,
  } = detail;
  const ragStyle = getRagColors(metrics.rag_status);

  const [stagedPage, setStagedPage] = useState(0);
  const [stagedRowsPerPage, setStagedRowsPerPage] = useState(10);
  const [stagedSearch, setStagedSearch] = useState("");

  const rawStaged = staged_records || [];
  const rawCols = staged_columns || [];

  const filteredStaged = useMemo(() => {
    if (!stagedSearch.trim()) return rawStaged;
    const lower = stagedSearch.toLowerCase();
    return rawStaged.filter((r) =>
      Object.values(r).some((val) => String(val).toLowerCase().includes(lower))
    );
  }, [rawStaged, stagedSearch]);

  const pagedStaged = useMemo(() => {
    const start = stagedPage * stagedRowsPerPage;
    return filteredStaged.slice(start, start + stagedRowsPerPage);
  }, [filteredStaged, stagedPage, stagedRowsPerPage]);

  // Dynamic 7-tier breadcrumb segments
  const breadcrumbItems = [
    hierarchy.main_company,
    hierarchy.sub_company,
    hierarchy.project,
    hierarchy.circle,
    hierarchy.domain,
    hierarchy.department,
    hierarchy.team,
    resource.code,
  ].filter(Boolean);

  return (
    <Box sx={{ pb: 5 }}>
      {/* 1. Back Navigation & Action Bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleBack}
          startIcon={<ArrowBackIcon />}
          sx={{
            borderRadius: radiusTokens.md,
            fontWeight: 700,
            fontSize: "0.82rem",
            textTransform: "none",
            bgcolor: "#FFFFFF",
            borderColor: colorTokens.workspace.border,
            color: colorTokens.text.primary,
            "&:hover": { borderColor: colorTokens.primary.main, bgcolor: colorTokens.workspace.borderSubtle },
          }}
        >
          {backLabel}
        </Button>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {source.is_frozen && (
            <Chip
              icon={<LockOutlinedIcon sx={{ fontSize: "14px !important" }} />}
              label="CYCLE FROZEN"
              size="small"
              sx={{
                bgcolor: colorTokens.status.neutral.light,
                color: colorTokens.status.neutral.text,
                fontWeight: 700,
                fontSize: "0.72rem",
                borderRadius: radiusTokens.xs,
              }}
            />
          )}
          <Chip
            label={source.period_name}
            size="small"
            sx={{
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.darker,
              fontWeight: 700,
              fontSize: "0.72rem",
              borderRadius: radiusTokens.xs,
            }}
          />
        </Box>
      </Box>

      {/* 2. Organizational Breadcrumb Bar */}
      <Card
        sx={{
          p: 1.5,
          mb: 3,
          borderRadius: radiusTokens.md,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: colorTokens.workspace.background,
          boxShadow: shadowTokens.subtle,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <AccountTreeOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
          <Typography variant="caption" sx={{ fontWeight: 800, color: colorTokens.text.muted, mr: 0.5 }}>
            {isFromCockpit ? "MANAGEMENT COCKPIT HIERARCHY:" : "SLIDE VIEW HIERARCHY:"}
          </Typography>
          {breadcrumbItems.map((item, idx) => (
            <React.Fragment key={idx}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: idx === breadcrumbItems.length - 1 ? 800 : 600,
                  color: idx === breadcrumbItems.length - 1 ? colorTokens.primary.main : colorTokens.text.secondary,
                }}
              >
                {item}
              </Typography>
              {idx < breadcrumbItems.length - 1 && (
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  /
                </Typography>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Card>

      {/* 3. Entity Header Card */}
      <Card
        sx={{
          p: 3,
          mb: 3,
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          borderLeft: `6px solid ${ragStyle.main}`,
          boxShadow: shadowTokens.card,
          bgcolor: "#FFFFFF",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
              <Chip
                label={resource.code}
                sx={{
                  bgcolor: colorTokens.primary.lighter,
                  color: colorTokens.primary.darker,
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  borderRadius: radiusTokens.xs,
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                {resource.name}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, maxWidth: 750, mb: 1.5 }}>
              {resource.definition || "Standardized operational resource / performance metric definition."}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap", color: colorTokens.text.muted }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <LocationOnOutlinedIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                  Circle: {hierarchy.circle} ({hierarchy.region} Region)
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PersonOutlineIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                  Circle Head: {hierarchy.circle_head}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <EventOutlinedIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                  Cycle: {source.period_name}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ textAlign: "right" }}>
            <Chip
              label={metrics.rag_status}
              sx={{
                bgcolor: ragStyle.light,
                color: ragStyle.text,
                border: `1px solid ${ragStyle.border}`,
                fontWeight: 900,
                fontSize: "0.85rem",
                px: 1,
                py: 2,
                borderRadius: radiusTokens.sm,
              }}
            />
          </Box>
        </Box>
      </Card>

      {/* 4. Core Performance / Resource Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card
            sx={{
              p: 3,
              borderRadius: radiusTokens.lg,
              border: `1px solid ${colorTokens.workspace.border}`,
              boxShadow: shadowTokens.subtle,
              bgcolor: "#FFFFFF",
              height: "100%",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary, mb: 2 }}>
              Operational Performance & Resource Values
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                gap: 2,
                p: 2.5,
                borderRadius: radiusTokens.md,
                bgcolor: colorTokens.workspace.background,
                border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                mb: 3,
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  REQUIRED (TARGET)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                  {formatNumber(metrics.required)} {metrics.unit}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  AVAILABLE (ACTUAL)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: ragStyle.text }}>
                  {formatNumber(metrics.available)} {metrics.unit}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  GAP (VARIANCE)
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: metrics.gap > 0 ? colorTokens.status.error.text : colorTokens.status.success.text,
                  }}
                >
                  {formatNumber(metrics.gap)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  ACHIEVEMENT
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {renderTrendIcon(metrics.trend)}
                  <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                    {formatNumber(metrics.achievement_percentage)}%
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Additional Formula & Details */}
            {resource.calculation_formula && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.muted, display: "block", mb: 0.5 }}>
                  CALCULATION FORMULA / LOGIC
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    p: 1.5,
                    bgcolor: colorTokens.workspace.borderSubtle,
                    borderRadius: radiusTokens.sm,
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                    color: colorTokens.text.secondary,
                  }}
                >
                  {resource.calculation_formula}
                </Typography>
              </Box>
            )}

            {metrics.notes && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.muted, display: "block", mb: 0.5 }}>
                  OPERATIONAL NOTES & CONTEXT
                </Typography>
                <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontStyle: "italic" }}>
                  "{metrics.notes}"
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Right: Data Ingestion & Audit Metadata */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              p: 3,
              borderRadius: radiusTokens.lg,
              border: `1px solid ${colorTokens.workspace.border}`,
              boxShadow: shadowTokens.subtle,
              bgcolor: "#FFFFFF",
              height: "100%",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary, mb: 2 }}>
              Source & Ingestion Provenance
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  REPORTING CYCLE
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  {source.period_name}
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  {source.start_date || "—"} to {source.end_date || "—"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  ENTERED BY / SUBMITTER
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  {source.entered_by.name}
                </Typography>
                {source.entered_by.email && (
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    {source.entered_by.email}
                  </Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 700, display: "block" }}>
                  RECORD TIMESTAMPS
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                  Created: {source.created_at ? new Date(source.created_at).toLocaleString() : "System Initial"}
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                  Updated: {source.updated_at ? new Date(source.updated_at).toLocaleString() : "—"}
                </Typography>
              </Box>

              {audit_history.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                      <HistoryIcon sx={{ fontSize: 16, color: colorTokens.primary.main }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                        RECENT AUDIT ACTIVITY
                      </Typography>
                    </Box>
                    {audit_history.slice(0, 3).map((aud) => (
                      <Box key={aud.id} sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, display: "block" }}>
                          [{aud.action}] {aud.level}: {aud.object_repr}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.68rem" }}>
                          By {aud.user} • {aud.timestamp ? new Date(aud.timestamp).toLocaleDateString() : ""}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* 5. Governance Root Causes & Corrective Actions */}
      {(issues.length > 0 || actions.length > 0) && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {issues.length > 0 && (
            <Grid size={{ xs: 12, md: actions.length > 0 ? 6 : 12 }}>
              <Card
                sx={{
                  p: 3,
                  borderRadius: radiusTokens.lg,
                  border: `1px solid ${colorTokens.workspace.border}`,
                  boxShadow: shadowTokens.subtle,
                  bgcolor: "#FFFFFF",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <WarningAmberIcon sx={{ color: colorTokens.status.warning.main, fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                    Linked Root Cause Observations ({issues.length})
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {issues.map((iss) => (
                    <Box
                      key={iss.id}
                      sx={{
                        p: 2,
                        borderRadius: radiusTokens.md,
                        bgcolor: colorTokens.workspace.background,
                        border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                          {iss.issue_code} — {iss.title}
                        </Typography>
                        <Chip
                          label={iss.rag_status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            borderRadius: radiusTokens.xs,
                            bgcolor: iss.rag_status === "RED" ? colorTokens.status.error.light : colorTokens.status.warning.light,
                            color: iss.rag_status === "RED" ? colorTokens.status.error.text : colorTokens.status.warning.text,
                          }}
                        />
                      </Box>
                      {iss.root_cause && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 0.5 }}>
                          <span style={{ fontWeight: 700 }}>RCA:</span> {iss.root_cause}
                        </Typography>
                      )}
                      {iss.corrective_action && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1 }}>
                          <span style={{ fontWeight: 700 }}>Action:</span> {iss.corrective_action}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                        Owner: {iss.owner_name || "Unassigned"} • Target: {iss.target_date || "—"}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Card>
            </Grid>
          )}

          {actions.length > 0 && (
            <Grid size={{ xs: 12, md: issues.length > 0 ? 6 : 12 }}>
              <Card
                sx={{
                  p: 3,
                  borderRadius: radiusTokens.lg,
                  border: `1px solid ${colorTokens.workspace.border}`,
                  boxShadow: shadowTokens.subtle,
                  bgcolor: "#FFFFFF",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AssignmentTurnedInIcon sx={{ color: colorTokens.primary.main, fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                    Linked Governance Actions ({actions.length})
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {actions.map((act) => (
                    <Box
                      key={act.id}
                      sx={{
                        p: 2,
                        borderRadius: radiusTokens.md,
                        bgcolor: colorTokens.workspace.background,
                        border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                          {act.action_code}
                        </Typography>
                        <Chip
                          label={act.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            borderRadius: radiusTokens.xs,
                            bgcolor: colorTokens.primary.lighter,
                            color: colorTokens.primary.darker,
                          }}
                        />
                      </Box>
                      {act.management_direction && (
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1 }}>
                          {act.management_direction}
                        </Typography>
                      )}
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.68rem" }}>
                            Progress
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.68rem" }}>
                            {act.progress_percentage}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={act.progress_percentage}
                          sx={{ height: 4, borderRadius: 2 }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.7rem" }}>
                        Accountable: {act.accountable_owner} • Target: {act.target_date || "—"}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Configured Multi-Rule Column Comparisons Card */}
      {comparisons && comparisons.length > 0 && (
        <Card
          sx={{
            p: 3,
            mb: 3,
            borderRadius: radiusTokens.lg,
            border: `1px solid ${colorTokens.workspace.border}`,
            bgcolor: "#FFFFFF",
            boxShadow: shadowTokens.subtle,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <RuleOutlinedIcon sx={{ color: colorTokens.primary.main, fontSize: 22 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Configured Target vs. Achievement Column Rules ({comparisons.length} Comparisons)
            </Typography>
          </Box>

          {comparisons.map((comp, cIdx) => (
            <Box
              key={cIdx}
              sx={{
                mb: 2,
                p: 2,
                borderRadius: radiusTokens.md,
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.primary.main }}>
                  {comp.comparison_name}
                </Typography>
                <Chip
                  label={comp.status_label || comp.overall_status}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    bgcolor: getRagColors(comp.overall_status).light,
                    color: getRagColors(comp.overall_status).text,
                    borderRadius: radiusTokens.xs,
                  }}
                />
              </Box>

              <TableContainer sx={{ bgcolor: "#FFFFFF", borderRadius: radiusTokens.sm, border: "1px solid #EDF2F7" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#F1F5F9" }}>
                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700 }}>EXCEL COLUMN</TableCell>
                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700 }} align="right">STANDARD / TARGET</TableCell>
                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700 }} align="right">CALCULATED ACTUAL</TableCell>
                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700 }}>PERFORMANCE DIRECTION</TableCell>
                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700 }} align="right">VARIANCE</TableCell>
                      <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700 }} align="center">STATUS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comp.rules && comp.rules.map((rule, rIdx) => (
                      <TableRow key={rIdx} sx={{ "&:hover": { bgcolor: "#F8FAFC" } }}>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                          {rule.column_name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", fontFamily: "Roboto Mono" }}>
                          {formatNumber(rule.standard_value ?? undefined)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "Roboto Mono" }}>
                          {formatNumber(rule.calculated_actual ?? undefined)}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.72rem", color: colorTokens.text.secondary }}>
                          {rule.performance_direction === "HIGHER_BETTER"
                            ? "Higher is Better"
                            : rule.performance_direction === "LOWER_BETTER"
                            ? "Lower is Better"
                            : "Exact Target"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", fontFamily: "Roboto Mono" }}>
                          {rule.variance !== null && rule.variance !== undefined
                            ? `${rule.variance > 0 ? "+" : ""}${formatNumber(rule.variance)}`
                            : "—"}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={rule.status_label || rule.status}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              fontWeight: 800,
                              borderRadius: radiusTokens.xs,
                              bgcolor: getRagColors(rule.status).light,
                              color: getRagColors(rule.status).text,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Card>
      )}

      {/* Dynamic Uploaded Excel Records Inspection View */}
      {rawStaged.length > 0 && (
        <Card
          sx={{
            p: 3,
            mb: 3,
            borderRadius: radiusTokens.lg,
            border: `1px solid ${colorTokens.workspace.border}`,
            bgcolor: "#FFFFFF",
            boxShadow: shadowTokens.subtle,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TableChartOutlinedIcon sx={{ color: colorTokens.primary.main, fontSize: 22 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                Supporting Uploaded Excel Records ({total_staged_records ?? rawStaged.length} Rows)
              </Typography>
            </Box>

            <TextField
              size="small"
              placeholder="Search uploaded cell values..."
              value={stagedSearch}
              onChange={(e) => setStagedSearch(e.target.value)}
              sx={{ width: 240, "& .MuiInputBase-root": { fontSize: "0.78rem" } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: colorTokens.text.secondary }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <TableContainer sx={{ maxHeight: 380, border: `1px solid #E2E8F0`, borderRadius: radiusTokens.md }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {rawCols.map((col) => (
                    <TableCell
                      key={col}
                      sx={{
                        bgcolor: "#1E293B",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        py: 0.8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedStaged.map((row, rIdx) => (
                  <TableRow key={rIdx} sx={{ "&:hover": { bgcolor: "#F8FAFC" } }}>
                    {rawCols.map((col) => (
                      <TableCell
                        key={col}
                        sx={{
                          fontSize: "0.78rem",
                          py: 0.7,
                          whiteSpace: "nowrap",
                          fontFamily: typeof row[col] === "number" ? "Roboto Mono" : "inherit",
                        }}
                      >
                        {row[col] !== undefined && row[col] !== null ? String(row[col]) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredStaged.length}
            page={stagedPage}
            onPageChange={(_, newPage) => setStagedPage(newPage)}
            rowsPerPage={stagedRowsPerPage}
            onRowsPerPageChange={(e) => {
              setStagedRowsPerPage(parseInt(e.target.value, 10));
              setStagedPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{
              "& .MuiTablePagination-toolbar": { minHeight: 40 },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.78rem" },
            }}
          />
        </Card>
      )}

      {/* Upload Ingestion Provenance Card (if imported via Uploads pipeline) */}
      {upload_provenance && (
        <Card
          sx={{
            p: 3,
            mb: 3,
            borderRadius: radiusTokens.lg,
            border: `1px solid ${colorTokens.workspace.border}`,
            bgcolor: "#F8FAFC",
            boxShadow: shadowTokens.subtle,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CloudDoneOutlinedIcon sx={{ color: colorTokens.status.success.main, fontSize: 22 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Excel Upload Pipeline Provenance
            </Typography>
            <Chip
              label={upload_provenance.status}
              size="small"
              sx={{
                bgcolor: colorTokens.status.success.light,
                color: colorTokens.status.success.text,
                fontWeight: 800,
                fontSize: "0.68rem",
                borderRadius: radiusTokens.xs,
              }}
            />
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block" }}>
                Template
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                {upload_provenance.template_name} ({upload_provenance.template_code}) v{upload_provenance.version}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block" }}>
                Source Excel File
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, wordBreak: "break-all" }}>
                {upload_provenance.original_filename}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block" }}>
                Batch ID
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                {upload_provenance.batch_id}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block" }}>
                Ingested By & Rows
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                {upload_provenance.uploaded_by} • {upload_provenance.imported_rows}/{upload_provenance.total_rows} rows
              </Typography>
            </Grid>
          </Grid>
        </Card>
      )}

      {/* 6. Related Operational Records in Same Circle */}
      {related_records.length > 0 && (
        <Card
          sx={{
            p: 3,
            borderRadius: radiusTokens.lg,
            border: `1px solid ${colorTokens.workspace.border}`,
            boxShadow: shadowTokens.subtle,
            bgcolor: "#FFFFFF",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary, mb: 1.5 }}>
            Other Operational Records in {hierarchy.circle} ({related_records.length})
          </Typography>
          <Grid container spacing={2}>
            {related_records.map((rel) => (
              <Grid key={rel.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: radiusTokens.md,
                    bgcolor: colorTokens.workspace.background,
                    border: `1px solid ${colorTokens.workspace.borderSubtle}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: colorTokens.primary.main, display: "block" }}>
                      {rel.code}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {rel.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={rel.rag_status}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      borderRadius: radiusTokens.xs,
                      bgcolor: getRagColors(rel.rag_status).light,
                      color: getRagColors(rel.rag_status).text,
                    }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Card>
      )}
    </Box>
  );
};
