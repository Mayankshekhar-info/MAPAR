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
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Paper from "@mui/material/Paper";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ReplayIcon from "@mui/icons-material/Replay";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { useVerifyTaskReview } from "../hooks/useGovernance";

interface VerifyReviewModalProps {
  open: boolean;
  onClose: () => void;
  actionId: number;
  actionIdDisplay: string;
  actionPointTitle: string;
  ownerSubmissionNotes?: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const VerifyReviewModal: React.FC<VerifyReviewModalProps> = ({
  open,
  onClose,
  actionId,
  actionIdDisplay,
  actionPointTitle,
  ownerSubmissionNotes,
  onSuccess,
  onError,
}) => {
  const [outcome, setOutcome] = useState<"Verified" | "Rework Required">("Verified");
  const [reviewNotes, setReviewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const verifyMutation = useVerifyTaskReview();
  const isSubmitting = verifyMutation.isPending;

  const handleSubmit = async () => {
    setFormError(null);
    if (outcome === "Rework Required" && !reviewNotes.trim()) {
      setFormError("Please provide explanation notes detailing what needs correction or rework.");
      return;
    }

    try {
      const res = await verifyMutation.mutateAsync({
        actionId,
        payload: {
          outcome,
          review_notes: reviewNotes.trim(),
        },
      });
      onSuccess?.(res.message || `Review submitted as '${outcome}'.`);
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.outcome?.[0] ||
        err.message ||
        "Failed to submit verification.";
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
            color: "#0284C7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FactCheckIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, lineHeight: 1.2 }}>
            Verify Task & Evidence
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            Review work completed and determine readiness for management approval
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
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#0284C7", textTransform: "uppercase" }}>
            {actionIdDisplay}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mt: 0.5 }}>
            {actionPointTitle}
          </Typography>
          {ownerSubmissionNotes && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${colorTokens.workspace.border}` }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary }}>
                Owner's Submission Note:
              </Typography>
              <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontSize: "0.85rem", mt: 0.25 }}>
                {ownerSubmissionNotes}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Decision Selection */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1.5 }}>
          Verification Decision
        </Typography>
        <RadioGroup
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as "Verified" | "Rework Required")}
          sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2.5 }}
        >
          <Paper
            elevation={0}
            onClick={() => setOutcome("Verified")}
            sx={{
              p: 1.5,
              cursor: "pointer",
              borderRadius: radiusTokens.md,
              border: `2px solid ${outcome === "Verified" ? colorTokens.status.success.main : colorTokens.workspace.border}`,
              backgroundColor: outcome === "Verified" ? "#F0FDF4" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FormControlLabel
                value="Verified"
                control={<Radio size="small" sx={{ color: colorTokens.status.success.main, "&.Mui-checked": { color: colorTokens.status.success.main } }} />}
                label={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#166534" }}>
                      Verified — Ready for Approval
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                      Work is confirmed accurate and task moves to Awaiting Final Approval
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </Box>
            <CheckCircleOutlineIcon sx={{ color: colorTokens.status.success.main, fontSize: 24, mr: 1 }} />
          </Paper>

          <Paper
            elevation={0}
            onClick={() => setOutcome("Rework Required")}
            sx={{
              p: 1.5,
              cursor: "pointer",
              borderRadius: radiusTokens.md,
              border: `2px solid ${outcome === "Rework Required" ? "#DC2626" : colorTokens.workspace.border}`,
              backgroundColor: outcome === "Rework Required" ? "#FEF2F2" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FormControlLabel
                value="Rework Required"
                control={<Radio size="small" sx={{ color: "#DC2626", "&.Mui-checked": { color: "#DC2626" } }} />}
                label={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#991B1B" }}>
                      Rework Required
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                      Return task to original owner with corrective action instructions
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </Box>
            <ReplayIcon sx={{ color: "#DC2626", fontSize: 24, mr: 1 }} />
          </Paper>
        </RadioGroup>

        {/* Verification Comments */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
            Verification Notes & Feedback {outcome === "Rework Required" && <span style={{ color: "#DC2626" }}>*</span>}
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder={
              outcome === "Verified"
                ? "Add any observations, verified calibration logs, or notes for the approver (optional)..."
                : "Explain specifically what needs to be corrected, missing proof files, or required adjustments..."
            }
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
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
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <FactCheckIcon />}
          sx={{
            backgroundColor: outcome === "Verified" ? colorTokens.primary.main : "#DC2626",
            borderRadius: radiusTokens.md,
            fontWeight: 700,
            textTransform: "none",
            px: 2.5,
            "&:hover": {
              backgroundColor: outcome === "Verified" ? colorTokens.primary.dark : "#B91C1C",
            },
          }}
        >
          {isSubmitting ? "Submitting..." : outcome === "Verified" ? "Submit Verification" : "Return for Rework"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
