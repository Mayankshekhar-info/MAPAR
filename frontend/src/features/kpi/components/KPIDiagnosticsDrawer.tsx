import React, { useEffect, useState, useMemo } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  TablePagination,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SpeedIcon from "@mui/icons-material/Speed";
import StorageIcon from "@mui/icons-material/Storage";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { kpiService } from "../api/kpiService";
import { KPIDiagnosticsData } from "../types/kpi";
import { StatusChip } from "../../../components/StatusChip/StatusChip";

interface KPIDiagnosticsDrawerProps {
  resultId: number | null;
  open: boolean;
  onClose: () => void;
}

export const KPIDiagnosticsDrawer: React.FC<KPIDiagnosticsDrawerProps> = ({
  resultId,
  open,
  onClose,
}) => {
  const [data, setData] = useState<KPIDiagnosticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [recordSearch, setRecordSearch] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  useEffect(() => {
    if (!resultId || !open) {
      setData(null);
      setActiveTab(0);
      setRecordSearch("");
      setPage(0);
      return;
    }

    setLoading(true);
    setError(null);
    kpiService
      .fetchDiagnostics(resultId)
      .then((res) => setData(res))
      .catch((err) => setError(err?.message || "Failed to load calculation diagnostics."))
      .finally(() => setLoading(false));
  }, [resultId, open]);

  // Filtered rows for Refined Dataset tab
  const rawRecords = data?.refined_records || [];
  const displayColumns = useMemo(() => {
    if (data?.refined_columns && data.refined_columns.length > 0) {
      return data.refined_columns;
    }
    if (rawRecords.length > 0) {
      return Object.keys(rawRecords[0]);
    }
    return [];
  }, [data?.refined_columns, rawRecords]);

  const filteredRecords = useMemo(() => {
    if (!recordSearch.trim()) return rawRecords;
    const q = recordSearch.trim().toLowerCase();
    return rawRecords.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      )
    );
  }, [rawRecords, recordSearch]);

  const pagedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 640, md: 740 }, p: 3 },
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            KPI Calculation & Refined Dataset
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Authoritative lineage, filtered source records & audit history
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {data && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Overview summary banner */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {data.kpi_code}
              </Typography>
              <StatusChip
                status={
                  data.rag_status === "GREEN"
                    ? "success"
                    : data.rag_status === "AMBER"
                    ? "warning"
                    : "error"
                }
                label={data.rag_status}
              />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.kpi_name}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
              Hierarchy: {data.hierarchy_name} ({data.hierarchy_level}:{data.hierarchy_id})
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              Calculated At: {new Date(data.calculated_at).toLocaleString()}
            </Typography>
          </Paper>

          {/* Navigation Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab
              icon={<TableChartOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label={`Refined Dataset (${data.records_considered})`}
              sx={{ fontWeight: 600, fontSize: "0.82rem" }}
            />
            <Tab
              icon={<FilterAltOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Funnel Pipeline"
              sx={{ fontWeight: 600, fontSize: "0.82rem" }}
            />
            <Tab
              icon={<HistoryOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label={`Audit (${data.audit_history?.length || 0})`}
              sx={{ fontWeight: 600, fontSize: "0.82rem" }}
            />
          </Tabs>

          {/* TAB 0: Refined Dataset */}
          {activeTab === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {/* Applied Filter Tags */}
              {data.applied_filters && data.applied_filters.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>
                    Applied Filter Conditions:
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                    {data.applied_filters.map((f, i) => (
                      <Chip
                        key={i}
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`${f.field_name} ${f.operator} ${f.value || "EMPTY"}`}
                        sx={{ fontSize: "0.72rem" }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Search bar inside records */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <TextField
                  size="small"
                  placeholder="Filter records..."
                  value={recordSearch}
                  onChange={(e) => {
                    setRecordSearch(e.target.value);
                    setPage(0);
                  }}
                  sx={{ width: 280 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Showing {filteredRecords.length} of {data.records_considered} refined rows
                </Typography>
              </Box>

              {/* Records Table */}
              {filteredRecords.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: "center", bgcolor: "action.hover", borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
                    No uploaded records matched the configured filters and organization scope.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, borderRadius: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 45, bgcolor: "background.paper" }}>#</TableCell>
                        {displayColumns.map((col) => (
                          <TableCell key={col} sx={{ fontWeight: 700, bgcolor: "background.paper", textTransform: "capitalize" }}>
                            {col.replace(/_/g, " ")}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedRecords.map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ color: "text.disabled", fontSize: "0.75rem" }}>
                            {page * rowsPerPage + idx + 1}
                          </TableCell>
                          {displayColumns.map((col) => (
                            <TableCell key={col} sx={{ fontSize: "0.8rem" }}>
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredRecords.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </Box>
          )}

          {/* TAB 1: Funnel Pipeline & Parameters */}
          {activeTab === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Record Lineage Counts */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
                  <StorageIcon color="primary" sx={{ mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {data.records_considered}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Records Considered
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
                  <SpeedIcon color="secondary" sx={{ mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {data.records_excluded}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Records Excluded
                  </Typography>
                </Paper>
              </Box>

              {/* KPI Funnel Breakdown Pipeline */}
              {data.lineage_info?.funnel_breakdown && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    KPI Data Processing Funnel
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1, borderRadius: 1, bgcolor: "action.hover" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        1. Uploaded Dataset Records
                      </Typography>
                      <Chip size="small" label={`${data.lineage_info.funnel_breakdown.total_uploaded_records} rows`} variant="outlined" />
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1, borderRadius: 1, bgcolor: "action.hover" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        2. Organization Scope Matching
                      </Typography>
                      <Chip size="small" label={`${data.lineage_info.funnel_breakdown.organization_scope_records} rows`} variant="outlined" color="info" />
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1, borderRadius: 1, bgcolor: "action.hover" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        3. Reporting Period Filter
                      </Typography>
                      <Chip size="small" label={`${data.lineage_info.funnel_breakdown.reporting_period_records} rows`} variant="outlined" color="primary" />
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1, borderRadius: 1, bgcolor: "action.selected" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>
                        4. User KPI Filters Passing
                      </Typography>
                      <Chip size="small" label={`${data.lineage_info.funnel_breakdown.kpi_filtered_records} rows`} color="success" />
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* Parameter Values Table */}
              {data.lineage_info?.parameter_values && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Aggregated Source Parameters
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Parameter</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            Value
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(data.lineage_info.parameter_values).map(([k, v]: [string, any]) => (
                          <TableRow key={k}>
                            <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                              {k}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {Number(v).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Batches Considered */}
              {data.lineage_info?.batches_considered && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.8 }}>
                    Source Upload Batches
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                    {data.lineage_info.batches_considered.length > 0 ? (
                      data.lineage_info.batches_considered.map((b: string) => (
                        <Chip key={b} label={b} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Direct/System source
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* TAB 2: Audit History */}
          {activeTab === 2 && (
            <Box>
              {data.audit_history && data.audit_history.length > 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {data.audit_history.map((a) => (
                    <Accordion key={a.id} variant="outlined" sx={{ borderRadius: 1.5 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", pr: 2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {a.trigger_type}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {new Date(a.created_at).toLocaleTimeString()} ({a.execution_time_ms} ms)
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          Executed By: {a.executed_by}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          Calculated Value: {a.calculated_value ?? "None"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          Records: {a.records_considered} evaluated, {a.records_excluded} filtered out
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No audit history recorded yet.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
};
