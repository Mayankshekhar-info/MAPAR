import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LayersIcon from "@mui/icons-material/Layers";
import DownloadIcon from "@mui/icons-material/Download";
import PublishIcon from "@mui/icons-material/Publish";
import CalculateIcon from "@mui/icons-material/Calculate";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";

import { ImportBatch } from "../types/uploads.types";
import { useCompatibleKPIs } from "../hooks/useImportBatches";
import { uploadsService } from "../api/uploadsService";
import { colorTokens } from "../../../app/theme/tokens";

interface ValidationSummaryCardProps {
  batch: ImportBatch;
  isCommitting: boolean;
  canManage?: boolean;
  onCommit: () => void;
  onDownloadErrorReport: () => void;
  onBatchUpdated?: () => void;
}

export const ValidationSummaryCard: React.FC<ValidationSummaryCardProps> = ({
  batch,
  isCommitting,
  canManage = true,
  onCommit,
  onDownloadErrorReport,
  onBatchUpdated,
}) => {
  const isCommitted = batch.status === "COMPLETED";
  const hasErrors = batch.error_rows > 0;
  const canCommit = canManage && batch.valid_rows > 0 && !isCommitted;

  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [selectedKpiId, setSelectedKpiId] = useState<number | "">("");
  const [isProcessingKpi, setIsProcessingKpi] = useState(false);
  const [kpiProcessError, setKpiProcessError] = useState<string | null>(null);

  const { data: compatibleKPIs = [], isLoading: isLoadingKpis } = useCompatibleKPIs(batch.template_id);

  const handleProcessKPI = async () => {
    if (!selectedKpiId) return;
    setIsProcessingKpi(true);
    setKpiProcessError(null);
    try {
      await uploadsService.processBatchKPI(batch.batch_id, Number(selectedKpiId));
      setKpiModalOpen(false);
      if (onBatchUpdated) {
        onBatchUpdated();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setKpiProcessError(err?.response?.data?.message || err.message || "Failed to process KPI.");
    } finally {
      setIsProcessingKpi(false);
    }
  };

  const kpiResult: any = batch.kpi_result_summary;

  return (
    <Card
      sx={{
        p: 3,
        borderRadius: "14px",
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          pb: 2.5,
          borderBottom: `1px solid ${colorTokens.workspace.divider}`,
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Import Validation Results
            </Typography>

            {/* Distinct Upload Status */}
            <Chip
              label={`Upload: ${batch.status}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: "0.75rem",
                bgcolor:
                  batch.status === "COMPLETED"
                    ? colorTokens.status.success.light
                    : batch.status === "FAILED" || (hasErrors && !canCommit)
                    ? colorTokens.status.error.light
                    : colorTokens.status.warning.light,
                color:
                  batch.status === "COMPLETED"
                    ? colorTokens.status.success.main
                    : batch.status === "FAILED" || (hasErrors && !canCommit)
                    ? colorTokens.status.error.main
                    : colorTokens.status.warning.main,
                borderRadius: "6px",
              }}
            />

            {/* Distinct KPI Execution Status */}
            {batch.kpi_execution_status && (
              <Chip
                label={`KPI: ${batch.kpi_execution_status}`}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  bgcolor:
                    batch.kpi_execution_status === "COMPLETED"
                      ? "#EDE9FE"
                      : batch.kpi_execution_status === "PROCESSING"
                      ? "#E0F2FE"
                      : batch.kpi_execution_status === "COMPATIBILITY_ERROR"
                      ? "#FEF3C7"
                      : colorTokens.status.error.light,
                  color:
                    batch.kpi_execution_status === "COMPLETED"
                      ? "#6D28D9"
                      : batch.kpi_execution_status === "PROCESSING"
                      ? "#0369A1"
                      : batch.kpi_execution_status === "COMPATIBILITY_ERROR"
                      ? "#B45309"
                      : colorTokens.status.error.main,
                  borderRadius: "6px",
                }}
              />
            )}
          </Stack>

          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.75 }}>
            File: <strong>{batch.original_filename}</strong> &bull; Template:{" "}
            <strong>
              {batch.template_name} (v{batch.template_version_number})
            </strong>{" "}
            {batch.reporting_period_name && `• Period: ${batch.reporting_period_name}`}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={<CalculateIcon fontSize="small" />}
            onClick={() => setKpiModalOpen(true)}
            sx={{
              fontWeight: 600,
              borderRadius: "8px",
              textTransform: "none",
              color: "#6D28D9",
              borderColor: "#DDD6FE",
              "&:hover": { bgcolor: "#F5F3FF", borderColor: "#C4B5FD" },
            }}
          >
            {batch.applied_kpi_name ? "Recalculate / Change KPI" : "Execute KPI"}
          </Button>

          {hasErrors && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={onDownloadErrorReport}
              sx={{
                fontWeight: 600,
                borderRadius: "8px",
                textTransform: "none",
              }}
            >
              Download Error Report (.xlsx)
            </Button>
          )}

          {canCommit && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              disabled={isCommitting}
              startIcon={
                isCommitting ? <CircularProgress size={16} color="inherit" /> : <PublishIcon fontSize="small" />
              }
              onClick={onCommit}
              sx={{
                fontWeight: 600,
                borderRadius: "8px",
                textTransform: "none",
                bgcolor: colorTokens.status.success.main,
                "&:hover": {
                  bgcolor: "#059669",
                },
              }}
            >
              {isCommitting ? "Importing Records..." : `Import ${batch.valid_rows} Valid Records`}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Metric Cards (Total, Valid, Errors) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
          gap: 2,
          mt: 2.5,
        }}
      >
        <Box
          sx={{
            p: 2,
            borderRadius: "10px",
            bgcolor: colorTokens.workspace.background,
            border: `1px solid ${colorTokens.workspace.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "8px",
              bgcolor: colorTokens.secondary.lighter,
              color: colorTokens.secondary.dark,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LayersIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, textTransform: "uppercase" }}>
              Total Rows Parsed
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              {batch.total_rows}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            p: 2,
            borderRadius: "10px",
            bgcolor: colorTokens.status.success.light,
            border: "1px solid rgba(16, 185, 129, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "8px",
              bgcolor: "#FFFFFF",
              color: colorTokens.status.success.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircleOutlineIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: "#065F46", fontWeight: 600, textTransform: "uppercase" }}>
              Valid Rows
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.status.success.main }}>
              {batch.valid_rows}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            p: 2,
            borderRadius: "10px",
            bgcolor: hasErrors ? colorTokens.status.error.light : colorTokens.workspace.background,
            border: hasErrors ? "1px solid rgba(239, 68, 68, 0.2)" : `1px solid ${colorTokens.workspace.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "8px",
              bgcolor: "#FFFFFF",
              color: hasErrors ? colorTokens.status.error.main : colorTokens.text.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ErrorOutlineIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: hasErrors ? "#991B1B" : colorTokens.text.muted, fontWeight: 600, textTransform: "uppercase" }}>
              Invalid / Error Rows
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: hasErrors ? colorTokens.status.error.main : colorTokens.text.muted }}>
              {batch.error_rows}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* KPI Execution Outcome Section */}
      {batch.applied_kpi_name && (
        <Card
          variant="outlined"
          sx={{
            mt: 2.5,
            p: 2.5,
            borderRadius: "10px",
            bgcolor: "#F9FAFB",
            border: "1px solid #E5E7EB",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CalculateIcon sx={{ color: "#6D28D9" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                Applied KPI Calculation: {batch.applied_kpi_name} ({batch.applied_kpi_code})
              </Typography>
            </Stack>
            {kpiResult?.rag_status && (
              <Chip
                label={`RAG: ${kpiResult.rag_status}`}
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor:
                    kpiResult.rag_status === "GREEN"
                      ? colorTokens.status.success.light
                      : kpiResult.rag_status === "AMBER"
                      ? colorTokens.status.warning.light
                      : colorTokens.status.error.light,
                  color:
                    kpiResult.rag_status === "GREEN"
                      ? colorTokens.status.success.main
                      : kpiResult.rag_status === "AMBER"
                      ? colorTokens.status.warning.main
                      : colorTokens.status.error.main,
                }}
              />
            )}
          </Stack>

          {batch.kpi_execution_status === "COMPLETED" && kpiResult ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
                  Calculated Result
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#6D28D9" }}>
                  {kpiResult.calculated_value != null ? Number(kpiResult.calculated_value).toFixed(2) : "0.00"}{" "}
                  <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>
                    {kpiResult.unit || ""}
                  </Typography>
                </Typography>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
                  Records Processed
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  {kpiResult.records_considered ?? batch.valid_rows}
                </Typography>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
                  Hierarchy Scope &amp; Period
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {kpiResult.hierarchy_node_name || "Assigned Node"} &bull; {batch.reporting_period_name || "Daily/Weekly"}
                </Typography>
              </Box>
            </Box>
          ) : batch.kpi_execution_status === "COMPATIBILITY_ERROR" ? (
            <Alert severity="warning" sx={{ borderRadius: "8px" }}>
              <strong>Compatibility Error:</strong> {kpiResult?.message || "Required KPI columns not found in uploaded workbook."}
              {kpiResult?.missing_columns && (
                <Box sx={{ mt: 1 }}>
                  Missing columns: <strong>{kpiResult.missing_columns.join(", ")}</strong>
                </Box>
              )}
            </Alert>
          ) : (
            <Alert severity="error" sx={{ borderRadius: "8px" }}>
              Calculation did not complete: {kpiResult?.error || "Unexpected engine error."}
            </Alert>
          )}
        </Card>
      )}

      {/* Summary Notes */}
      {batch.summary_notes && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: colorTokens.workspace.background, borderRadius: "8px" }}>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            {batch.summary_notes}
          </Typography>
        </Box>
      )}

      {/* Modal: Process with KPI */}
      <Dialog open={kpiModalOpen} onClose={() => setKpiModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Execute KPI on Upload Batch
          </Typography>
          <Button onClick={() => setKpiModalOpen(false)} size="small" sx={{ minWidth: 32, p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </Button>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {kpiProcessError && (
            <Alert severity="error" sx={{ borderRadius: "8px" }}>
              {kpiProcessError}
            </Alert>
          )}
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Select an active KPI to execute against the {batch.valid_rows} valid staged records of batch{" "}
            <strong>{batch.batch_id}</strong>.
          </Typography>

          <TextField
            select
            label="Select Compatible KPI"
            fullWidth
            size="small"
            value={selectedKpiId}
            onChange={(e) => setSelectedKpiId(Number(e.target.value))}
            disabled={isProcessingKpi || isLoadingKpis}
          >
            {compatibleKPIs.map((kpi) => (
              <MenuItem key={kpi.id} value={kpi.id}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {kpi.name} ({kpi.code})
                  </Typography>
                  <Chip
                    label={kpi.is_compatible ? "Compatible" : "Missing Columns"}
                    size="small"
                    sx={{
                      fontSize: "0.62rem",
                      height: 18,
                      bgcolor: kpi.is_compatible ? colorTokens.status.success.light : colorTokens.status.warning.light,
                      color: kpi.is_compatible ? colorTokens.status.success.main : colorTokens.status.warning.main,
                    }}
                  />
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setKpiModalOpen(false)} disabled={isProcessingKpi}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedKpiId || isProcessingKpi}
            onClick={handleProcessKPI}
            startIcon={isProcessingKpi ? <CircularProgress size={16} /> : <CalculateIcon />}
            sx={{ bgcolor: "#6D28D9", "&:hover": { bgcolor: "#5B21B6" } }}
          >
            {isProcessingKpi ? "Calculating..." : "Execute KPI"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};
