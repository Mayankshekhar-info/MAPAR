import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { useSubmitForVerification } from "../hooks/useGovernance";

interface SubmitForVerificationModalProps {
  open: boolean;
  onClose: () => void;
  actionId: number;
  actionIdDisplay: string;
  actionPointTitle: string;
  evidenceRequired?: boolean;
  evidenceStatus?: string;
  assignedReviewerName?: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const SubmitForVerificationModal: React.FC<SubmitForVerificationModalProps> = ({
  open,
  onClose,
  actionId,
  actionIdDisplay,
  actionPointTitle,
  evidenceRequired,
  evidenceStatus,
  assignedReviewerName,
  onSuccess,
  onError,
}) => {
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitMutation = useSubmitForVerification();
  const isSubmitting = submitMutation.isPending;

  const handleSubmit = async () => {
    setFormError(null);
    try {
      const res = await submitMutation.mutateAsync({
        actionId,
        payload: { submission_notes: submissionNotes.trim() },
      });
      onSuccess?.(res.message || "Task submitted for verification successfully.");
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.status?.[0] ||
        err.message ||
        "Failed to submit task for review.";
      setFormError(errorMsg);
      onError?.(errorMsg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.15)",
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 2.5,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: radiusTokens.md,
            backgroundColor: "#EFF6FF",
            color: "#1D4ED8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AssignmentTurnedInIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, lineHeight: 1.2 }}>
            Submit Task for Verification
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            Submit completed work to the designated reviewer for inspection
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {formError && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: radiusTokens.md }}>
            {formError}
          </Alert>
        )}

        {/* Task summary */}
        <Box
          sx={{
            p: 2,
            mb: 2.5,
            backgroundColor: "#F8FAFC",
            borderRadius: radiusTokens.md,
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>
            {actionIdDisplay}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mt: 0.5 }}>
            {actionPointTitle}
          </Typography>
          {assignedReviewerName && (
            <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.secondary, mt: 0.5 }}>
              Assigned Reviewer: <strong>{assignedReviewerName}</strong>
            </Typography>
          )}
        </Box>

        {evidenceRequired && evidenceStatus !== "Accepted" && (
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: radiusTokens.md, fontSize: "0.82rem" }}>
            This task requires supporting evidence/proof. While you can submit for review now, final task closure requires evidence to be uploaded and accepted.
          </Alert>
        )}

        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
            Completion & Verification Notes
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder="Describe the completed deliverables, references to attached proof, or specific inspection instructions for the reviewer..."
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
            disabled={isSubmitting}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: radiusTokens.md,
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${colorTokens.workspace.border}`, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={isSubmitting}
          sx={{ color: colorTokens.text.secondary, fontWeight: 600, textTransform: "none" }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          sx={{
            backgroundColor: colorTokens.primary.main,
            borderRadius: radiusTokens.md,
            fontWeight: 700,
            textTransform: "none",
            px: 2.5,
            "&:hover": { backgroundColor: colorTokens.primary.dark },
          }}
        >
          {isSubmitting ? "Submitting..." : "Submit for Verification"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
