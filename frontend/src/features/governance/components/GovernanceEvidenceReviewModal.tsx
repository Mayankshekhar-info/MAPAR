import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Chip from "@mui/material/Chip";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceEvidenceItem, ReviewEvidencePayload } from "../types/governance.types";
import { governanceService } from "../api/governanceService";

interface GovernanceEvidenceReviewModalProps {
  open: boolean;
  evidence: GovernanceEvidenceItem | null;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (evidenceId: number, payload: ReviewEvidencePayload) => Promise<void>;
}

export const GovernanceEvidenceReviewModal: React.FC<GovernanceEvidenceReviewModalProps> = ({
  open,
  evidence,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const [decision, setDecision] = useState<"Accepted" | "Rework Required">("Accepted");
  const [reviewComment, setReviewComment] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDecision("Accepted");
      setReviewComment("");
      setErrorMsg(null);
    }
  }, [open]);

  if (!evidence) return null;

  const handleDownload = async () => {
    try {
      await governanceService.downloadEvidence(evidence.id, evidence.file_name);
    } catch {
      setErrorMsg("Failed to download evidence file.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (decision === "Rework Required" && !reviewComment.trim()) {
      setErrorMsg("Please specify the reason or required corrections when requesting rework.");
      return;
    }

    try {
      await onSubmit(evidence.id, {
        decision,
        review_comment: reviewComment.trim(),
      });
      onClose();
    } catch (err: any) {
      const respError = err?.response?.data?.errors;
      if (typeof respError === "string") {
        setErrorMsg(respError);
      } else if (typeof respError === "object") {
        setErrorMsg(Object.values(respError).flat().join(" "));
      } else {
        setErrorMsg("Failed to submit evidence review.");
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.lg } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: colorTokens.workspace.border }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Review Task Evidence Submission
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            Action ID: {evidence.action_id} • Version #{evidence.version}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}

          {/* Evidence Details Box */}
          <Box sx={{ mb: 2.5, p: 2, backgroundColor: "#F8FAFC", borderRadius: radiusTokens.sm, border: "1px solid #E2E8F0" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                {evidence.title}
              </Typography>
              <Chip
                label={evidence.status}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  backgroundColor:
                    evidence.status === "Accepted"
                      ? "#ECFDF5"
                      : evidence.status === "Rework Required"
                      ? "#FEE2E2"
                      : "#FEF3C7",
                  color:
                    evidence.status === "Accepted"
                      ? "#047857"
                      : evidence.status === "Rework Required"
                      ? "#B91C1C"
                      : "#B45309",
                }}
              />
            </Box>

            {evidence.description && (
              <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 1.5, fontSize: "0.82rem" }}>
                "{evidence.description}"
              </Typography>
            )}

            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Submitted by: {evidence.submitted_by?.full_name || "Assigned User"} ({new Date(evidence.submitted_at).toLocaleDateString()})
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  File: {evidence.file_name} ({(evidence.file_size / 1024).toFixed(1)} KB)
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadOutlinedIcon />}
                onClick={handleDownload}
                sx={{ fontSize: "0.75rem" }}
              >
                Inspect File
              </Button>
            </Box>
          </Box>

          {/* Decision Selection */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
            Review Decision:
          </Typography>
          <RadioGroup
            row
            value={decision}
            onChange={(e) => setDecision(e.target.value as any)}
            sx={{ mb: 2 }}
          >
            <FormControlLabel
              value="Accepted"
              control={<Radio color="success" />}
              label={
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.status.success.text }}>
                  Accept Evidence (Proof Verified)
                </Typography>
              }
            />
            <FormControlLabel
              value="Rework Required"
              control={<Radio color="error" />}
              label={
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.status.error.text }}>
                  Request Rework (Corrections Needed)
                </Typography>
              }
            />
          </RadioGroup>

          <TextField
            fullWidth
            size="small"
            required={decision === "Rework Required"}
            multiline
            rows={3}
            label={decision === "Rework Required" ? "Correction / Rework Feedback (Required)" : "Reviewer Notes (Optional)"}
            placeholder={
              decision === "Rework Required"
                ? "Clearly explain what is missing, unclear, or invalid..."
                : "Add verification notes or approval remarks..."
            }
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2.25, px: 3, borderTop: "1px solid", borderColor: colorTokens.workspace.border, gap: 1 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{
              borderColor: colorTokens.workspace.border,
              color: colorTokens.text.secondary,
              fontWeight: 600,
              textTransform: "none",
              height: 40,
              px: 2.5,
              borderRadius: radiusTokens.sm,
              "&:hover": {
                borderColor: colorTokens.text.muted,
                backgroundColor: colorTokens.workspace.background,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={decision === "Accepted" ? <CheckCircleIcon /> : <CancelIcon />}
            sx={{
              height: 40,
              px: 3.5,
              fontWeight: 700,
              fontSize: "0.875rem",
              textTransform: "none",
              borderRadius: radiusTokens.sm,
              backgroundColor: decision === "Accepted" ? colorTokens.status.success.main : colorTokens.status.error.main,
              boxShadow:
                decision === "Accepted"
                  ? "0 2px 6px rgba(16, 185, 129, 0.35)"
                  : "0 2px 6px rgba(239, 68, 68, 0.35)",
              "&:hover": {
                backgroundColor: decision === "Accepted" ? "#059669" : "#DC2626",
                boxShadow:
                  decision === "Accepted"
                    ? "0 4px 10px rgba(16, 185, 129, 0.45)"
                    : "0 4px 10px rgba(239, 68, 68, 0.45)",
              },
            }}
          >
            {isLoading ? "Saving Review..." : `Confirm ${decision}`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
