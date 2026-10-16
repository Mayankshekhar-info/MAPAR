import React, { useState, useMemo } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FunctionsIcon from "@mui/icons-material/Functions";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import HistoryToggleOffIcon from "@mui/icons-material/HistoryToggleOff";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { DeepRecordDetail } from "../types/cockpit.types";
import { StatusChip } from "../../../components/StatusChip/StatusChip";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

interface DeepRecordDrawerProps {
  open: boolean;
  record: DeepRecordDetail | null | undefined;
  isLoading: boolean;
  onClose: () => void;
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

export const DeepRecordDrawer: React.FC<DeepRecordDrawerProps> = ({
  open,
  record,
  isLoading,
  onClose,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  const stagedRows = record?.staged_records || [];
  const stagedCols = record?.staged_columns || [];

  const filteredStagedRows = useMemo(() => {
    if (!searchTerm.trim()) return stagedRows;
    const lower = searchTerm.toLowerCase();
    return stagedRows.filter((r) =>
      Object.values(r).some((val) => String(val).toLowerCase().includes(lower))
    );
  }, [stagedRows, searchTerm]);

  const pagedStagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredStagedRows.slice(start, start + rowsPerPage);
  }, [filteredStagedRows, page, rowsPerPage]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 540, md: 680 },
          p: 0,
          bgcolor: "#F8FAFC",
        },
      }}
    >
      {/* Drawer Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: "#0F172A",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "#38BDF8", fontWeight: 700, letterSpacing: "0.1em" }}>
            LEVEL 3 RECORD & DATA INTELLIGENCE
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#FFFFFF" }}>
            {record?.kpi.name || "KPI Record Detail"}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "#94A3B8", "&:hover": { color: "#FFFFFF" } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Drawer Content */}
      <Box sx={{ p: 2, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {isLoading || !record ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Skeleton variant="rounded" height={100} />
            <Skeleton variant="rounded" height={140} />
            <Skeleton variant="rounded" height={220} />
          </Box>
        ) : (
          <>
            {/* Card 1: Performance Benchmark */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#FFFFFF",
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  Operational Performance
                </Typography>
                <StatusChip
                  status={mapStatusToChip(record.performance.rag_status)}
                  label={record.performance.rag_status}
                  size="small"
                />
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, mb: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    Target
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: "Roboto Mono" }}>
                    {record.performance.target !== null ? record.performance.target : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    Actual
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: "Roboto Mono" }}>
                    {record.performance.actual !== null ? record.performance.actual : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                    Achievement
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 700,
                      fontFamily: "Roboto Mono",
                      color:
                        record.performance.achievement_pct !== null && record.performance.achievement_pct >= 95
                          ? colorTokens.status.success.main
                          : colorTokens.status.warning.main,
                    }}
                  >
                    {record.performance.achievement_pct !== null ? `${record.performance.achievement_pct}%` : "—"}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1 }} />

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  Variance %: <strong>{record.performance.variance_pct ?? "0"}%</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  Trend: <strong>{record.performance.trend}</strong>
                </Typography>
              </Box>
            </Box>

            {/* Card 2: Multi-Rule Comparison Rules (if configured) */}
            {record.comparisons && record.comparisons.length > 0 && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "#FFFFFF",
                  borderRadius: radiusTokens.md,
                  border: `1px solid ${colorTokens.workspace.border}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <RuleOutlinedIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Configured Column Rules & Targets
                  </Typography>
                </Box>

                {record.comparisons.map((comp, idx) => (
                  <Box key={idx} sx={{ mb: 1.5, p: 1.25, bgcolor: "#F8FAFC", borderRadius: radiusTokens.sm, border: `1px solid #E2E8F0` }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: colorTokens.primary.main }}>
                        {comp.comparison_name}
                      </Typography>
                      <StatusChip
                        status={mapStatusToChip(comp.overall_status)}
                        label={comp.status_label || comp.overall_status}
                        size="small"
                      />
                    </Box>

                    {comp.rules && comp.rules.map((rule, rIdx) => (
                      <Box
                        key={rIdx}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 1fr 1fr 1.2fr 1fr",
                          gap: 1,
                          py: 0.5,
                          alignItems: "center",
                          borderTop: rIdx > 0 ? "1px solid #EDF2F7" : "none",
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {rule.column_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontFamily: "Roboto Mono" }}>
                          Std: {rule.standard_value ?? "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: "Roboto Mono" }}>
                          Act: {rule.calculated_actual ?? "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.68rem", color: colorTokens.text.secondary }}>
                          {rule.performance_direction === "HIGHER_BETTER"
                            ? "Higher is Better"
                            : rule.performance_direction === "LOWER_BETTER"
                            ? "Lower is Better"
                            : "Exact Target"}
                        </Typography>
                        <StatusChip
                          status={mapStatusToChip(rule.status)}
                          label={rule.status_label || rule.status}
                          size="small"
                        />
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            )}

            {/* Card 3: Real Uploaded Staged Records Inspection */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#FFFFFF",
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TableChartOutlinedIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Supporting Uploaded Records
                  </Typography>
                  <Chip
                    label={`${record.total_staged_records ?? stagedRows.length} rows`}
                    size="small"
                    sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: "rgba(2, 132, 199, 0.1)", color: colorTokens.primary.main }}
                  />
                </Box>

                <TextField
                  size="small"
                  placeholder="Filter uploaded rows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  sx={{ width: 180, "& .MuiInputBase-root": { fontSize: "0.75rem", height: 28 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: colorTokens.text.secondary }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {stagedRows.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center", color: colorTokens.text.secondary }}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    No raw staged records found for this period and hierarchy scope.
                  </Typography>
                </Box>
              ) : (
                <>
                  <TableContainer sx={{ maxHeight: 280, border: `1px solid #E2E8F0`, borderRadius: radiusTokens.sm }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {stagedCols.map((col) => (
                            <TableCell
                              key={col}
                              sx={{
                                bgcolor: "#1E293B",
                                color: "#FFFFFF",
                                fontWeight: 700,
                                fontSize: "0.68rem",
                                py: 0.6,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {col}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pagedStagedRows.map((row, rIdx) => (
                          <TableRow key={rIdx} sx={{ "&:hover": { bgcolor: "#F8FAFC" } }}>
                            {stagedCols.map((col) => (
                              <TableCell
                                key={col}
                                sx={{
                                  fontSize: "0.72rem",
                                  py: 0.5,
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
                    count={filteredStagedRows.length}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25]}
                    sx={{
                      "& .MuiTablePagination-toolbar": { minHeight: 36, px: 0 },
                      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.72rem" },
                    }}
                  />
                </>
              )}
            </Box>

            {/* Card 4: Hierarchy Scope */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#FFFFFF",
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <AccountTreeOutlinedIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Organizational Scope
                </Typography>
              </Box>

              <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.primary, mb: 0.5 }}>
                <strong>Circle:</strong> {record.hierarchy.circle_name} ({record.hierarchy.circle_code})
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.primary, mb: 0.5 }}>
                <strong>Region:</strong> {record.hierarchy.circle_region}
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.primary, mb: 0.5 }}>
                <strong>Governance Domain:</strong> {record.kpi.domain.name} ({record.kpi.domain.code})
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.primary }}>
                <strong>Period:</strong> {record.period.name} ({record.period.start_date} to {record.period.end_date})
              </Typography>
            </Box>

            {/* Card 5: Audit & Pipeline */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#FFFFFF",
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <HistoryToggleOffIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Audit & Data Pipeline
                </Typography>
              </Box>

              <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.secondary }}>
                Source: <strong>{record.audit.entered_by}</strong>
              </Typography>
              {record.audit.created_at && (
                <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.secondary, mt: 0.5 }}>
                  Ingested: {new Date(record.audit.created_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
};

