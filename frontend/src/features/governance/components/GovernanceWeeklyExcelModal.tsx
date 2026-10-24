import React, { useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import {
  WeeklyExcelPreviewData,
  WeeklyExcelUploadResponse,
} from "../types/governance.types";
import { governanceService } from "../api/governanceService";

interface GovernanceWeeklyExcelModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GovernanceWeeklyExcelModal: React.FC<GovernanceWeeklyExcelModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<boolean>(false);
  const [isExportingErrors, setIsExportingErrors] = useState<boolean>(false);

  const [previewData, setPreviewData] = useState<WeeklyExcelPreviewData | null>(null);
  const [uploadResult, setUploadResult] = useState<WeeklyExcelUploadResponse | null>(null);
  const [allowRevision, setAllowRevision] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"ALL" | "VALID" | "INVALID">("ALL");

  const resetState = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setUploadResult(null);
    setGeneralError(null);
    setAllowRevision(false);
    setIsPreviewing(false);
    setIsUploading(false);
    setFilterMode("ALL");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      setGeneralError(null);
      await governanceService.downloadWeeklyTemplate();
    } catch (err: any) {
      setGeneralError("Failed to download template. Please try again.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setGeneralError("Please select a valid Excel (.xlsx) file.");
        return;
      }
      setSelectedFile(file);
      setPreviewData(null);
      setUploadResult(null);
      setGeneralError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setGeneralError("Please drop a valid Excel (.xlsx) file.");
        return;
      }
      setSelectedFile(file);
      setPreviewData(null);
      setUploadResult(null);
      setGeneralError(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;
    setIsPreviewing(true);
    setGeneralError(null);
    try {
      const res = await governanceService.previewWeeklyExcel(selectedFile);
      if (res.success) {
        setPreviewData(res.preview);
      } else {
        setGeneralError("Failed to validate Excel file.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to parse and validate Excel file.";
      setGeneralError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setGeneralError(null);
    try {
      const res = await governanceService.uploadWeeklyExcel(selectedFile, allowRevision);
      setUploadResult(res);
      if (res.success && res.successful_count > 0) {
        onSuccess();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Import failed. Please check the file.";
      setGeneralError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportErrorReport = async () => {
    if (!uploadResult?.error_report?.length) return;
    setIsExportingErrors(true);
    try {
      await governanceService.exportWeeklyErrorReport(uploadResult.error_report);
    } catch (err) {
      setGeneralError("Failed to export error report.");
    } finally {
      setIsExportingErrors(false);
    }
  };

  const filteredPreviewRows = previewData?.rows.filter((r) => {
    if (filterMode === "VALID") return r.is_valid;
    if (filterMode === "INVALID") return !r.is_valid;
    return true;
  }) || [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: radiusTokens.lg, maxHeight: "90vh" } }}
    >
      <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: colorTokens.workspace.border }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Weekly Task Updates — Excel Bulk Upload
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
              Prepare your weekly updates in Excel and import them securely against your assigned tasks.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudDownloadOutlinedIcon />}
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            sx={{
              borderColor: colorTokens.primary.main,
              color: colorTokens.primary.main,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {isDownloadingTemplate ? "Downloading..." : "Download Weekly Template"}
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {generalError && (
          <Alert severity="error" onClose={() => setGeneralError(null)}>
            {generalError}
          </Alert>
        )}

        {/* Step 3: Result View */}
        {uploadResult ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert
              severity={uploadResult.successful_count > 0 ? "success" : "warning"}
              icon={uploadResult.successful_count > 0 ? <CheckCircleOutlineIcon /> : <WarningAmberOutlinedIcon />}
              sx={{ fontWeight: 600 }}
            >
              Bulk Import Complete: Successfully imported {uploadResult.successful_count} of {uploadResult.total_rows} weekly updates.
              {uploadResult.failed_count > 0 && ` (${uploadResult.failed_count} updates were rejected due to errors or unauthorized task access).`}
            </Alert>

            {/* Error Report Download if any failed */}
            {uploadResult.failed_count > 0 && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "#fff5f5",
                  border: "1px solid #fed7d7",
                  borderRadius: radiusTokens.md,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1.5,
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#c53030" }}>
                    {uploadResult.failed_count} Records Failed or Were Rejected
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#742a2a" }}>
                    Download the comprehensive Excel error report with exact row numbers and correction instructions.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<FileDownloadOutlinedIcon />}
                  onClick={handleExportErrorReport}
                  disabled={isExportingErrors}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {isExportingErrors ? "Generating..." : "Download Error Report (.xlsx)"}
                </Button>
              </Box>
            )}

            {/* Results Table */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Import Breakdown:
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#fafafa" }}>
                    <TableCell sx={{ fontWeight: 700, width: 70 }}>Row</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 130 }}>Task ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Task Title</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 110 }}>Week</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadResult.results.map((r, idx) => (
                    <TableRow key={idx} sx={{ bgcolor: r.success ? "inherit" : "#fffafa" }}>
                      <TableCell>{r.row_num}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.task_id}</TableCell>
                      <TableCell sx={{ color: colorTokens.text.secondary }}>{r.task_title || "—"}</TableCell>
                      <TableCell>{r.reporting_week || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.success ? "Success" : "Failed"}
                          color={r.success ? "success" : "error"}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        {r.success ? (
                          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600 }}>
                            Saved (Progress: {r.progress_percent}%)
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600 }}>
                            {r.error}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : previewData ? (
          /* Step 2: Preview & Validation View */
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Summary Statistics */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 1.5,
              }}
            >
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", bgcolor: "#f8fafc" }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
                  Total Rows
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  {previewData.total_rows}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", bgcolor: "#f0fdf4", borderColor: "#bbf7d0" }}>
                <Typography variant="caption" sx={{ color: "#166534", fontWeight: 600 }}>
                  Valid Records
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#15803d" }}>
                  {previewData.valid_rows_count}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", bgcolor: "#fff1f2", borderColor: "#fecdd3" }}>
                <Typography variant="caption" sx={{ color: "#9f1239", fontWeight: 600 }}>
                  Rejected / Unauthorized
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#be123c" }}>
                  {previewData.invalid_rows_count}
                </Typography>
              </Paper>
            </Box>

            {/* Filter mode chips */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={`All (${previewData.total_rows})`}
                  clickable
                  color={filterMode === "ALL" ? "primary" : "default"}
                  onClick={() => setFilterMode("ALL")}
                  size="small"
                />
                <Chip
                  label={`Valid (${previewData.valid_rows_count})`}
                  clickable
                  color={filterMode === "VALID" ? "success" : "default"}
                  onClick={() => setFilterMode("VALID")}
                  size="small"
                />
                <Chip
                  label={`Errors / Unauthorized (${previewData.invalid_rows_count})`}
                  clickable
                  color={filterMode === "INVALID" ? "error" : "default"}
                  onClick={() => setFilterMode("INVALID")}
                  size="small"
                />
              </Stack>

              {previewData.rows.some((r) => r.already_exists) && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allowRevision}
                      onChange={(e) => setAllowRevision(e.target.checked)}
                      size="small"
                      color="warning"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 600, color: "#b45309" }}>
                      Allow revision of previously submitted weeks
                    </Typography>
                  }
                />
              )}
            </Box>

            {/* Interactive Preview Table */}
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 700, width: 60 }}>Row</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 120 }}>Task ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Task Title</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 100 }}>Week</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 85 }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 80 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 100 }}>Validation</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Errors / Access Checks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPreviewRows.map((row) => (
                    <TableRow
                      key={row.row_num}
                      sx={{
                        bgcolor: !row.is_valid ? "#fff5f5" : row.already_exists ? "#fffbeb" : "inherit",
                      }}
                    >
                      <TableCell>{row.row_num}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{row.task_id}</TableCell>
                      <TableCell sx={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <Tooltip title={row.task_title}>
                          <span>{row.task_title || "—"}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{row.reporting_week}</TableCell>
                      <TableCell>{row.progress_percent}%</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.is_valid ? "Valid" : "Invalid"}
                          color={row.is_valid ? "success" : "error"}
                          variant="filled"
                          sx={{ fontSize: "0.7rem", height: 20 }}
                        />
                      </TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "block" }}>
                            {row.errors.join("; ")}
                          </Typography>
                        ) : row.already_exists ? (
                          <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 600, display: "block" }}>
                            Prior update exists for this week (requires revision checkbox).
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: "success.main" }}>
                            Ready to import
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          /* Step 1: Upload Dropzone & Instructions */
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box
              sx={{
                border: "2px dashed",
                borderColor: selectedFile ? colorTokens.primary.main : colorTokens.workspace.border,
                borderRadius: radiusTokens.md,
                p: 4,
                textAlign: "center",
                bgcolor: selectedFile ? "rgba(22, 119, 255, 0.04)" : "#fafafa",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  borderColor: colorTokens.primary.main,
                  bgcolor: "rgba(22, 119, 255, 0.04)",
                },
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <CloudUploadOutlinedIcon sx={{ fontSize: 48, color: colorTokens.primary.main, mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                {selectedFile ? selectedFile.name : "Drag and drop your weekly update Excel file here"}
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                Supports standard .xlsx templates with Task ID mapping
              </Typography>
            </Box>

            {selectedFile && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.5,
                  bgcolor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: radiusTokens.md,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <InsertDriveFileOutlinedIcon sx={{ color: "success.main" }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  sx={{
                    bgcolor: colorTokens.primary.main,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  {isPreviewing ? <CircularProgress size={20} color="inherit" /> : "Validate & Preview Rows"}
                </Button>
              </Box>
            )}

            {/* Explanatory guidelines */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#f8fafc",
                border: "1px solid",
                borderColor: colorTokens.workspace.border,
                borderRadius: radiusTokens.md,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: colorTokens.text.primary }}>
                Task Mapping & Access Control Guidelines:
              </Typography>
              <Typography variant="caption" component="div" sx={{ color: colorTokens.text.secondary, lineHeight: 1.6 }}>
                • <strong>Task ID Mapping:</strong> Every row must have a valid Task ID (e.g. <code>ACT-00501</code>).<br />
                • <strong>Strict Authorization:</strong> You can only update tasks assigned to your account. Any rows belonging to other users will be rejected.<br />
                • <strong>Duplicate Prevention:</strong> If a weekly report already exists for the same week, it will be flagged to prevent accidental overwrites.<br />
                • <strong>Pre-filled Template:</strong> Click <em>"Download Weekly Template"</em> at top right to get an Excel file pre-loaded with all your active assigned tasks.
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: colorTokens.workspace.border }}>
        {uploadResult ? (
          <Button
            variant="contained"
            onClick={handleClose}
            sx={{ bgcolor: colorTokens.primary.main, textTransform: "none", fontWeight: 600 }}
          >
            Done
          </Button>
        ) : previewData ? (
          <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <Button
              variant="outlined"
              onClick={() => {
                setPreviewData(null);
                setSelectedFile(null);
              }}
              sx={{ textTransform: "none" }}
            >
              Upload Different File
            </Button>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button onClick={handleClose} sx={{ textTransform: "none", color: colorTokens.text.secondary }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmImport}
                disabled={previewData.valid_rows_count === 0 || isUploading}
                sx={{
                  bgcolor: colorTokens.primary.main,
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                {isUploading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  `Import ${previewData.valid_rows_count} Valid Updates`
                )}
              </Button>
            </Box>
          </Box>
        ) : (
          <Button onClick={handleClose} sx={{ textTransform: "none", color: colorTokens.text.secondary }}>
            Cancel
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
