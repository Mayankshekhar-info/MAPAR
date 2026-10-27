import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import RateReviewIcon from "@mui/icons-material/RateReview";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceTaskReview } from "../types/governance.types";
import { useSubmitTaskReview } from "../hooks/useGovernance";

interface SubmitTaskReviewModalProps {
  open: boolean;
  onClose: () => void;
  actionId: number;
  review: GovernanceTaskReview | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const SubmitTaskReviewModal: React.FC<SubmitTaskReviewModalProps> = ({
  open,
  onClose,
  actionId,
  review,
  onSuccess,
  onError,
}) => {
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitMutation = useSubmitTaskReview();
  const isSubmitting = submitMutation.isPending;

  useEffect(() => {
    if (!open || !review) {
      setFindings("");
      setRecommendations("");
      setReviewNotes("");
      setFormError(null);
      return;
    }
    setFindings(review.review_notes || "");
    setRecommendations(review.recommendations || "");
    setReviewNotes("");
    setFormError(null);
  }, [open, review]);

  if (!review) return null;

  const handleSubmit = async () => {
    if (!findings.trim()) {
      setFormError("Findings and Observations are required to submit your review.");
      return;
    }

    setFormError(null);

    try {
      const res = await submitMutation.mutateAsync({
        actionId,
        payload: {
          findings: findings.trim(),
          recommendations: recommendations.trim(),
          review_notes: reviewNotes.trim(),
        },
      });

      const msg = res.message || "Review findings submitted successfully.";
      if (onSuccess) onSuccess(msg);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.findings?.[0] ||
        err?.message ||
        "Failed to submit review.";
      setFormError(msg);
      if (onError) onError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
        },
      }}
    >
      <DialogTitle
        sx={{
          py: 2,
          px: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: radiusTokens.md,
            bgcolor: "#EFF6FF",
            border: "1px solid #BFDBFE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colorTokens.primary.main,
          }}
        >
          <RateReviewIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem", color: colorTokens.text.primary }}>
            Submit Review Findings & Observations
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            {review.action_id} &bull; Assigned by {review.requested_by?.full_name || "Team Lead"}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {formError && (
          <Alert severity="error" sx={{ borderRadius: radiusTokens.sm }}>
            {formError}
          </Alert>
        )}

        {review.instructions && (
          <Box
            sx={{
              p: 2,
              borderRadius: radiusTokens.sm,
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderLeft: `4px solid ${colorTokens.primary.main}`,
            }}
          >
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, display: "block", mb: 0.5 }}>
              REVIEW INSTRUCTIONS FROM ASSIGNER:
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontSize: "0.85rem" }}>
              {review.instructions}
            </Typography>
          </Box>
        )}

        <Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, mb: 1, display: "block" }}>
            FINDINGS / OBSERVATIONS *
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            size="small"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="Record detailed review observations, verification of evidence, facts discovered, or compliance gaps..."
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, mb: 1, display: "block" }}>
            RECOMMENDATIONS & CORRECTIVE ACTIONS (OPTIONAL)
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            size="small"
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            placeholder="Record specific recommended improvements, remediation steps, or preventive measures..."
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700, mb: 1, display: "block" }}>
            ADDITIONAL REVIEW NOTES (OPTIONAL)
          </Typography>
          <TextField
            multiline
            rows={2}
            fullWidth
            size="small"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Any supplementary audit references, test results, or reviewer remarks..."
          />
        </Box>

        <Alert severity="info" sx={{ borderRadius: radiusTokens.sm, fontSize: "0.82rem" }}>
          Submitting this review marks the task as <strong>Review Submitted</strong> and transmits your findings to Governance & Action Tracker for final decision.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
        <Button
          onClick={onClose}
          disabled={isSubmitting}
          sx={{ color: colorTokens.text.secondary, textTransform: "none", fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={16} sx={{ color: "#fff" }} />
            ) : (
              <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            )
          }
          sx={{
            bgcolor: colorTokens.primary.main,
            color: "#FFFFFF",
            fontWeight: 700,
            textTransform: "none",
            borderRadius: radiusTokens.sm,
            px: 2.5,
            "&:hover": { bgcolor: colorTokens.primary.dark },
          }}
        >
          {isSubmitting ? "Submitting Review..." : "Submit Review"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
