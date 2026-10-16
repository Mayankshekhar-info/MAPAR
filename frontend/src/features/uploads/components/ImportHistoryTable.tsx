import React, { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import HistoryIcon from "@mui/icons-material/History";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import dayjs from "dayjs";

import { ImportBatch } from "../types/uploads.types";
import { colorTokens } from "../../../app/theme/tokens";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingState } from "../../../components/LoadingState";

interface ImportHistoryTableProps {
  batches: ImportBatch[];
  isLoading: boolean;
  canManage?: boolean;
  onViewBatch: (batch: ImportBatch) => void;
  onDownloadErrors: (batch: ImportBatch) => void;
  onCommitBatch: (batch: ImportBatch) => void;
  onUploadExcel: () => void;
}

export const ImportHistoryTable: React.FC<ImportHistoryTableProps> = ({
  batches,
  isLoading,
  canManage = true,
  onViewBatch,
  onDownloadErrors,
  onCommitBatch,
  onUploadExcel,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchesSearch =
        search === "" ||
        b.batch_id.toLowerCase().includes(search.toLowerCase()) ||
        b.template_name.toLowerCase().includes(search.toLowerCase()) ||
        b.original_filename.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, search, statusFilter]);

  if (isLoading) {
    return <LoadingState message="Loading import batch history..." />;
  }

  return (
    <Card
      sx={{
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Table Toolbar */}
      <Box
        sx={{
          p: 2.5,
          bgcolor: colorTokens.workspace.surface,
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <HistoryIcon sx={{ color: colorTokens.primary.main }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Upload Batches &amp; Import History
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Audit log of all uploaded workbooks, validation states, and committed records
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Search batches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { xs: "100%", md: 240 } }}
          />

          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ width: 150 }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="VALIDATED">Validated</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="UPLOADED">Uploaded</MenuItem>
          </TextField>
        </Stack>
      </Box>

      {/* Batches Table */}
      {filteredBatches.length === 0 ? (
        <Box sx={{ py: 6, px: 3 }}>
          <EmptyState
            title="No import batches yet"
            description="Upload completed Excel files against your configured templates to view batch history and validation reports."
            action={
              canManage ? (
                <Button variant="contained" color="primary" onClick={onUploadExcel} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}>
                  Upload Excel File
                </Button>
              ) : undefined
            }
          />
        </Box>
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead sx={{ bgcolor: colorTokens.workspace.background }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Batch ID</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Template &amp; Version</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Reporting Period</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Uploaded By</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }} align="center">
                  Total Rows
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }} align="center">
                  Valid / Errors
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>Uploaded At</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBatches.map((batch) => (
                <TableRow
                  key={batch.id}
                  hover
                  sx={{
                    "&:last-child td, &:last-child th": { border: 0 },
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      onClick={() => onViewBatch(batch)}
                      sx={{
                        fontWeight: 700,
                        color: colorTokens.primary.main,
                        cursor: "pointer",
                        fontFamily: "monospace",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      {batch.batch_id}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                      {batch.original_filename}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {batch.template_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                      Schema v{batch.template_version_number}
                    </Typography>
                    {batch.applied_kpi_name && (
                      <Typography variant="caption" sx={{ color: "#6D28D9", fontWeight: 700, display: "block", mt: 0.25 }}>
                        KPI: {batch.applied_kpi_name}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ color: colorTokens.text.primary }}>
                      {batch.reporting_period_name || "—"}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: colorTokens.text.primary }}>
                      {batch.uploaded_by_name}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                      {batch.total_rows}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.status.success.main }}>
                        {batch.valid_rows}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                        /
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: batch.error_rows > 0 ? colorTokens.status.error.main : colorTokens.text.muted,
                        }}
                      >
                        {batch.error_rows}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack spacing={0.5} alignItems="flex-start">
                      <Chip
                        label={batch.status}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          bgcolor:
                            batch.status === "COMPLETED"
                              ? colorTokens.status.success.light
                              : batch.status === "FAILED"
                              ? colorTokens.status.error.light
                              : colorTokens.status.warning.light,
                          color:
                            batch.status === "COMPLETED"
                              ? colorTokens.status.success.main
                              : batch.status === "FAILED"
                              ? colorTokens.status.error.main
                              : colorTokens.status.warning.main,
                          borderRadius: "6px",
                        }}
                      />
                      {batch.kpi_execution_status && (
                        <Chip
                          label={`KPI: ${batch.kpi_execution_status}`}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.62rem",
                            height: 18,
                            bgcolor:
                              batch.kpi_execution_status === "COMPLETED"
                                ? "#EDE9FE"
                                : batch.kpi_execution_status === "COMPATIBILITY_ERROR"
                                ? "#FEF3C7"
                                : colorTokens.status.error.light,
                            color:
                              batch.kpi_execution_status === "COMPLETED"
                                ? "#6D28D9"
                                : batch.kpi_execution_status === "COMPATIBILITY_ERROR"
                                ? "#B45309"
                                : colorTokens.status.error.main,
                            borderRadius: "4px",
                          }}
                        />
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
                      {dayjs(batch.created_at).format("MMM D, YYYY HH:mm")}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                      <Tooltip title="View Batch Details & Lineage">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => onViewBatch(batch)}
                          sx={{
                            borderRadius: "8px",
                            textTransform: "none",
                            fontSize: "0.78rem",
                            px: 1.25,
                            borderColor: colorTokens.workspace.border,
                            color: colorTokens.text.primary,
                          }}
                        >
                          Details
                        </Button>
                      </Tooltip>

                      {batch.error_rows > 0 && (
                        <Tooltip title="Download Error Report (.xlsx)">
                          <IconButton
                            size="small"
                            onClick={() => onDownloadErrors(batch)}
                            sx={{ color: colorTokens.status.error.main }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {canManage && batch.valid_rows > 0 && batch.status !== "COMPLETED" && (
                        <Tooltip title="Commit valid records into MAPAR">
                          <IconButton
                            size="small"
                            onClick={() => onCommitBatch(batch)}
                            sx={{ color: colorTokens.status.success.main }}
                          >
                            <CheckCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
};
