import React, { useState, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AttachFileIcon from "@mui/icons-material/AttachFile";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceActionPoint } from "../types/governance.types";
import { governanceService } from "../api/governanceService";

interface MandatoryEvidenceClosureModalProps {
  open: boolean;
  action: GovernanceActionPoint | null;
  onClose: () => void;
  onEvidenceUploaded: () => void;
}

export const MandatoryEvidenceClosureModal: React.FC<MandatoryEvidenceClosureModalProps> = ({
  open,
  action,
  onClose,
  onEvidenceUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!action) return null;

  const evidenceStatus = action.evidence_status || "Not Submitted";
  const isPendingReview = evidenceStatus === "Pending Review";
  const isRework = evidenceStatus === "Rework Required";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      setErrorMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select an evidence file (PDF or Image).");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      await governanceService.uploadEvidence(
        action.id,
        selectedFile,
        title || selectedFile.name,
        description
      );
      setSuccessMessage("Evidence submitted successfully! It is now pending review by authorized validators.");
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setTimeout(() => {
        onEvidenceUploaded();
        onClose();
      }, 1400);
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.file ||
        err?.response?.data?.errors ||
        err?.message ||
        "Evidence upload failed. Please check file format and size.";
      setErrorMessage(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colorTokens.status.error.main,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary, lineHeight: 1.2 }}>
              Evidence Required Before Closure
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
              {action.action_id} — {action.action_point}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* Policy Notice Banner */}
        <Alert
          severity="warning"
          icon={<ErrorOutlineIcon />}
          sx={{
            borderRadius: radiusTokens.md,
            backgroundColor: "#FFFBEB",
            color: "#92400E",
            border: "1px solid #FDE68A",
            "& .MuiAlert-icon": { color: "#D97706" },
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Task Closure Is Restricted
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
            This governance action point requires verified evidence (image or PDF document). You cannot mark this task as <strong>Closed</strong> or <strong>Completed</strong> until evidence has been reviewed and Accepted by an authorized validator.
          </Typography>
        </Alert>

        {/* Current Evidence Review Status Card */}
        <Box
          sx={{
            p: 2,
            borderRadius: radiusTokens.md,
            border: `1px solid ${colorTokens.workspace.border}`,
            backgroundColor: colorTokens.workspace.surface,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.muted, textTransform: "uppercase" }}>
              Current Verification Status
            </Typography>
            <Chip
              label={evidenceStatus}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: "0.75rem",
                backgroundColor:
                  evidenceStatus === "Accepted"
                    ? "#DCFCE7"
                    : evidenceStatus === "Pending Review"
                    ? "#E0F2FE"
                    : "#FEE2E2",
                color:
                  evidenceStatus === "Accepted"
                    ? "#16A34A"
                    : evidenceStatus === "Pending Review"
                    ? "#0284C7"
                    : "#DC2626",
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ fontSize: "0.82rem", color: colorTokens.text.secondary }}>
            {isPendingReview && (
              <span>Your evidence is currently awaiting validation by your Circle Manager / Validator. Once approved, the task status can transition to Closed.</span>
            )}
            {isRework && (
              <span>Previous evidence was marked for Rework. Please review reviewer feedback and upload revised proof below.</span>
            )}
            {!isPendingReview && !isRework && (
              <span>No evidence has been uploaded for this task yet. Please attach your completion proof below.</span>
            )}
          </Typography>
        </Box>

        {/* Upload Form if evidence is not pending review */}
        {!isPendingReview && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 0.75 }}>
              <FactCheckOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
              Upload Completion Proof (Image / PDF)
            </Typography>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {/* Drop / Select Area */}
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 2.5,
                border: "2px dashed #CBD5E1",
                borderRadius: radiusTokens.md,
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: selectedFile ? "#F0FDF4" : "#F8FAFC",
                borderColor: selectedFile ? "#86EFAC" : "#CBD5E1",
                "&:hover": { borderColor: colorTokens.primary.main, backgroundColor: "#F0F9FF" },
                transition: "all 0.2s ease",
              }}
            >
              {selectedFile ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                  <AttachFileIcon sx={{ color: colorTokens.status.success.main }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <CloudUploadIcon sx={{ fontSize: 32, color: colorTokens.text.muted, mb: 0.5 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                    Click to browse or drop proof file here
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                    Supported: PDF, PNG, JPG, JPEG, DOCX (Max 25MB)
                  </Typography>
                </Box>
              )}
            </Box>

            <TextField
              label="Evidence Title"
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Signed SLA Acceptance Document"
              fullWidth
            />

            <TextField
              label="Description / Context (Optional)"
              size="small"
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add verification notes or context for the reviewer..."
              fullWidth
            />
          </Box>
        )}

        {/* Upload feedback */}
        {errorMessage && (
          <Alert severity="error" onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" icon={<VerifiedUserOutlinedIcon />}>
            {successMessage}
          </Alert>
        )}
        {isUploading && <LinearProgress />}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: colorTokens.text.secondary }}>
          Cancel
        </Button>
        {!isPendingReview && (
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
            sx={{
              backgroundColor: colorTokens.primary.main,
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: colorTokens.primary.dark },
            }}
          >
            {isUploading ? "Uploading Proof..." : "Upload & Submit for Review"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
