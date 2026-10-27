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
import VerifiedIcon from "@mui/icons-material/Verified";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { useApproveTaskReview } from "../hooks/useGovernance";

interface ApproveReviewModalProps {
  open: boolean;
  onClose: () => void;
  actionId: number;
  actionIdDisplay: string;
  actionPointTitle: string;
  ownerName?: string;
  reviewerName?: string;
  reviewerNotes?: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const ApproveReviewModal: React.FC<ApproveReviewModalProps> = ({
  open,
  onClose,
  actionId,
  actionIdDisplay,
  actionPointTitle,
  ownerName,
  reviewerName,
  reviewerNotes,
  onSuccess,
  onError,
}) => {
  const [decision, setDecision] = useState<"Approved" | "Rework Required">("Approved");
  const [comments, setComments] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const approveMutation = useApproveTaskReview();
  const isSubmitting = approveMutation.isPending;

  const handleSubmit = async () => {
    setFormError(null);
    if (decision === "Rework Required" && !comments.trim()) {
      setFormError("Please provide return comments explaining what needs to be reworked.");
      return;
    }

    try {
      const res = await approveMutation.mutateAsync({
        actionId,
        payload: {
          decision,
          comments: comments.trim(),
        },
      });
      onSuccess?.(res.message || `Decision recorded as '${decision}'.`);
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.decision?.[0] ||
        err.message ||
        "Failed to record approval decision.";
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
            backgroundColor: "#F0FDF4",
            color: "#16A34A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VerifiedIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, lineHeight: 1.2 }}>
            Final Task Approval
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            Authorize original task owner to close the task or return for rework
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
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#16A34A", textTransform: "uppercase" }}>
            {actionIdDisplay}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mt: 0.5 }}>
            {actionPointTitle}
          </Typography>
          <Box sx={{ display: "flex", gap: 3, mt: 1, flexWrap: "wrap" }}>
            {ownerName && (
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                Task Owner: <strong>{ownerName}</strong>
              </Typography>
            )}
            {reviewerName && (
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                Verified By: <strong>{reviewerName}</strong>
              </Typography>
            )}
          </Box>
          {reviewerNotes && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${colorTokens.workspace.border}` }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary }}>
                Reviewer's Verification Notes:
              </Typography>
              <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontSize: "0.85rem", mt: 0.25 }}>
                {reviewerNotes}
              </Typography>
            </Box>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 2.5, borderRadius: radiusTokens.md, fontSize: "0.82rem" }}>
          <strong>Note:</strong> Approving this task authorizes the original task owner to perform closure. It does not automatically mark the task Closed.
        </Alert>

        {/* Decision Selection */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1.5 }}>
          Approver Decision
        </Typography>
        <RadioGroup
          value={decision}
          onChange={(e) => setDecision(e.target.value as "Approved" | "Rework Required")}
          sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2.5 }}
        >
          <Paper
            elevation={0}
            onClick={() => setDecision("Approved")}
            sx={{
              p: 1.5,
              cursor: "pointer",
              borderRadius: radiusTokens.md,
              border: `2px solid ${decision === "Approved" ? colorTokens.status.success.main : colorTokens.workspace.border}`,
              backgroundColor: decision === "Approved" ? "#F0FDF4" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FormControlLabel
                value="Approved"
                control={<Radio size="small" sx={{ color: colorTokens.status.success.main, "&.Mui-checked": { color: colorTokens.status.success.main } }} />}
                label={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#166534" }}>
                      Approve Task
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                      Authorizes the original owner to mark this task as Closed
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </Box>
            <CheckCircleIcon sx={{ color: colorTokens.status.success.main, fontSize: 24, mr: 1 }} />
          </Paper>

          <Paper
            elevation={0}
            onClick={() => setDecision("Rework Required")}
            sx={{
              p: 1.5,
              cursor: "pointer",
              borderRadius: radiusTokens.md,
              border: `2px solid ${decision === "Rework Required" ? "#DC2626" : colorTokens.workspace.border}`,
              backgroundColor: decision === "Rework Required" ? "#FEF2F2" : "#FFFFFF",
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
                      Reject / Return for Rework
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                      Return task to owner for correction and resubmission
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </Box>
            <ReplayIcon sx={{ color: "#DC2626", fontSize: 24, mr: 1 }} />
          </Paper>
        </RadioGroup>

        {/* Approver Comments */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
            Approver Directives & Comments {decision === "Rework Required" && <span style={{ color: "#DC2626" }}>*</span>}
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder={
              decision === "Approved"
                ? "Add executive approval comments or audit remarks (optional)..."
                : "Explain required corrections and reasons for rejecting verification..."
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
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
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <VerifiedIcon />}
          sx={{
            backgroundColor: decision === "Approved" ? colorTokens.status.success.main : "#DC2626",
            borderRadius: radiusTokens.md,
            fontWeight: 700,
            textTransform: "none",
            px: 2.5,
            "&:hover": {
              backgroundColor: decision === "Approved" ? colorTokens.status.success.text : "#B91C1C",
            },
          }}
        >
          {isSubmitting ? "Recording..." : decision === "Approved" ? "Approve Task" : "Return for Rework"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
