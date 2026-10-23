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
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { ExcelUploadResponse } from "../types/governance.types";

interface GovernanceExcelModalProps {
  open: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onDownloadTemplate: () => Promise<void>;
  onUpload: (file: File) => Promise<ExcelUploadResponse>;
  onSuccess: () => void;
}

export const GovernanceExcelModal: React.FC<GovernanceExcelModalProps> = ({
  open,
  isLoading,
  onClose,
  onDownloadTemplate,
  onUpload,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ExcelUploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setGeneralError(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setGeneralError("Please select a valid Excel (.xlsx) file.");
        return;
      }
      setSelectedFile(file);
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
      setUploadResult(null);
      setGeneralError(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setGeneralError(null);
    setUploadResult(null);

    try {
      const res = await onUpload(selectedFile);
      setUploadResult(res);
      if (res.success) {
        onSuccess();
      }
    } catch (err: any) {
      const respData = err?.response?.data;
      if (respData && respData.errors && Array.isArray(respData.errors)) {
        setUploadResult(respData);
      } else {
        const msg = respData?.errors || respData?.message || "Failed to process Excel workbook.";
        setGeneralError(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.lg } }}>
      <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: colorTokens.workspace.border }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
          Excel Import & Tracker Template
        </Typography>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
          Download standard pre-formatted template or batch upload action points
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Step 1: Download Standard Template */}
        <Box
          sx={{
            p: 2.25,
            mb: 3,
            backgroundColor: "#F8FAFC",
            borderRadius: radiusTokens.md,
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              1. Download Official Action Tracker Template
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              Downloads single &apos;Open Points Tracker&apos; sheet with pre-configured headers, validation dropdowns, and username/email owner assignment.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudDownloadOutlinedIcon />}
            onClick={onDownloadTemplate}
            sx={{
              borderColor: colorTokens.primary.main,
              color: colorTokens.primary.main,
              fontWeight: 600,
            }}
          >
            Download Template (.xlsx)
          </Button>
        </Box>

        {/* Step 2: Upload Completed File */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
          2. Upload Completed Excel Tracker
        </Typography>

        <Box
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: "2px dashed",
            borderColor: selectedFile ? colorTokens.primary.main : "#CBD5E1",
            borderRadius: radiusTokens.md,
            p: 4,
            textAlign: "center",
            backgroundColor: selectedFile ? "#F0F9FF" : "#FAFAFA",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              borderColor: colorTokens.primary.main,
              backgroundColor: "#F0F9FF",
            },
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            style={{ display: "none" }}
          />
          {selectedFile ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <InsertDriveFileOutlinedIcon sx={{ fontSize: 44, color: colorTokens.primary.main, mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                {selectedFile.name}
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                {(selectedFile.size / 1024).toFixed(1)} KB — Click or drop to replace
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <CloudUploadOutlinedIcon sx={{ fontSize: 44, color: colorTokens.text.muted, mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                Drop completed Excel workbook here, or browse
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                Supports standard .xlsx format generated from the template
              </Typography>
            </Box>
          )}
        </Box>

        {generalError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {generalError}
          </Alert>
        )}

        {/* Upload Result: Success */}
        {uploadResult && uploadResult.success && (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mt: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Upload Completed Successfully!
            </Typography>
            <Typography variant="body2">
              Imported {uploadResult.created_count} new action point(s), updated {uploadResult.updated_count} existing record(s) out of {uploadResult.total_rows} total rows.
            </Typography>
          </Alert>
        )}

        {/* Upload Result: Row Errors */}
        {uploadResult && !uploadResult.success && uploadResult.errors && uploadResult.errors.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Validation Failed ({uploadResult.errors.length} error{uploadResult.errors.length > 1 ? "s" : ""})
              </Typography>
              <Typography variant="caption">
                No records were saved. Please fix the following row errors in your Excel file and upload again:
              </Typography>
            </Alert>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 220, borderRadius: radiusTokens.sm }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: "#FEF2F2", color: "#991B1B" } }}>
                    <TableCell sx={{ width: 80 }}>Row #</TableCell>
                    <TableCell sx={{ width: 140 }}>Field</TableCell>
                    <TableCell>Validation Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadResult.errors.map((err, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Chip label={`Row ${err.row}`} size="small" sx={{ height: 20, fontSize: "0.7rem", backgroundColor: "#FEE2E2", color: "#991B1B" }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                        {err.field}
                      </TableCell>
                      <TableCell sx={{ color: colorTokens.status.error.main, fontSize: "0.8rem" }}>
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: colorTokens.workspace.border }}>
        <Button onClick={handleClose} color="inherit">
          {uploadResult?.success ? "Close" : "Cancel"}
        </Button>
        <Button
          variant="contained"
          disabled={!selectedFile || isUploading}
          onClick={handleUploadSubmit}
          sx={{
            backgroundColor: colorTokens.primary.main,
            "&:hover": { backgroundColor: colorTokens.primary.dark },
          }}
        >
          {isUploading ? "Validating & Importing..." : "Validate & Upload"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
