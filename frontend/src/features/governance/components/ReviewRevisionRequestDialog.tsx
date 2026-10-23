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
import Chip from "@mui/material/Chip";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceTargetRevisionRequest } from "../types/governance.types";

interface ReviewRevisionRequestDialogProps {
  open: boolean;
  request: GovernanceTargetRevisionRequest | null;
  currentUserId?: number | null;
  onClose: () => void;
  onSubmit: (requestId: number, decision: "Approved" | "Rejected", comment: string) => Promise<void>;
}

export const ReviewRevisionRequestDialog: React.FC<ReviewRevisionRequestDialogProps> = ({
  open,
  request,
  currentUserId,
  onClose,
  onSubmit,
}) => {
  const [decision, setDecision] = useState<"Approved" | "Rejected">("Approved");
  const [comment, setComment] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!request) return null;

  const isSelfRequester = Boolean(currentUserId && request.requested_by?.id === currentUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isSelfRequester) {
      setErrorMsg("Separation of duties: You cannot approve or reject your own revision request.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(request.id, decision, comment.trim());
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.errors || err.response?.data?.detail || err.message || "Failed to process review.";
      setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.md } }}>
      <DialogTitle sx={{ fontWeight: 800, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <FactCheckIcon sx={{ color: colorTokens.primary.main, fontSize: 24 }} />
        Review Target Date Revision Request
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
          {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

          {isSelfRequester && (
            <Alert severity="warning">
              You are the requester of this extension. Under MAPAR Governance rules, approval or rejection must be performed by a different authorized Governance reviewer.
            </Alert>
          )}

          {/* Request Details Card */}
          <Box
            sx={{
              p: 2,
              borderRadius: radiusTokens.sm,
              backgroundColor: colorTokens.workspace.background,
              border: `1px solid ${colorTokens.workspace.border}`,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Chip
                label={request.action_id}
                size="small"
                sx={{ fontWeight: 800, backgroundColor: "#E0F2FE", color: "#0369A1" }}
              />
              <Chip
                label={request.status}
                size="small"
                sx={{
                  fontWeight: 700,
                  backgroundColor: request.status === "Approved" ? "#DCFCE7" : request.status === "Pending" ? "#FEF3C7" : "#FEE2E2",
                  color: request.status === "Approved" ? "#15803D" : request.status === "Pending" ? "#B45309" : "#B91C1C",
                }}
              />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
              {request.action_point_title}
            </Typography>

            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
              Circle: <strong>{request.circle_name}</strong> &bull; Assigned Owner: <strong>{request.owner_name}</strong>
            </Typography>

            {/* Date Progression Box */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, p: 1.5, borderRadius: radiusTokens.xs, backgroundColor: "#FFFFFF", border: `1px solid ${colorTokens.workspace.border}` }}>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Original Target:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {request.original_target_date}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Current Target:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {request.current_target_date}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Proposed Date:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.primary.main }}>
                  {request.requested_target_date}
                </Typography>
              </Box>
            </Box>

            {/* Reason Statement */}
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                Requester Reason ({request.requested_by?.full_name || request.requested_by?.username || "Requester"} on {new Date(request.requested_at).toLocaleDateString()}):
              </Typography>
              <Typography variant="body2" sx={{ color: colorTokens.text.primary, mt: 0.5, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                "{request.reason}"
              </Typography>
            </Box>
          </Box>

          {/* Decision Selection */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
              Review Decision *
            </Typography>
            <RadioGroup
              row
              value={decision}
              onChange={(e) => setDecision(e.target.value as any)}
            >
              <FormControlLabel
                value="Approved"
                control={<Radio sx={{ color: colorTokens.status.success.main, "&.Mui-checked": { color: colorTokens.status.success.main } }} />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: colorTokens.status.success.main, fontWeight: 700 }}>
                    <CheckCircleOutlineIcon fontSize="small" />
                    Approve Revision
                  </Box>
                }
              />
              <FormControlLabel
                value="Rejected"
                control={<Radio sx={{ color: colorTokens.status.error.main, "&.Mui-checked": { color: colorTokens.status.error.main } }} />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: colorTokens.status.error.main, fontWeight: 700 }}>
                    <HighlightOffIcon fontSize="small" />
                    Reject Request
                  </Box>
                }
              />
            </RadioGroup>
          </Box>

          <TextField
            label="Decision Comment / Feedback"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder={
              decision === "Approved"
                ? "Approval reason or instructions (optional)..."
                : "Specify why extension is rejected and guidance for task owner..."
            }
            size="small"
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={isSubmitting} sx={{ color: colorTokens.text.secondary }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || isSelfRequester}
            sx={{
              backgroundColor: decision === "Approved" ? colorTokens.status.success.main : colorTokens.status.error.main,
              "&:hover": {
                backgroundColor: decision === "Approved" ? colorTokens.status.success.text : "#991B1B",
              },
              fontWeight: 700,
            }}
          >
            {isSubmitting ? "Processing..." : decision === "Approved" ? "Confirm Approval" : "Confirm Rejection"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
