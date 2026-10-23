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

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceActionPoint, ReviseTargetPayload } from "../types/governance.types";

interface GovernanceRevisionModalProps {
  open: boolean;
  action: GovernanceActionPoint | null;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (id: number, payload: ReviseTargetPayload) => Promise<void>;
}

export const GovernanceRevisionModal: React.FC<GovernanceRevisionModalProps> = ({
  open,
  action,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const [newTargetDate, setNewTargetDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [approvedBy, setApprovedBy] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNewTargetDate("");
      setReason("");
      setApprovedBy("");
      setErrorMsg(null);
    }
  }, [open]);

  if (!action) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newTargetDate) {
      setErrorMsg("Please select a new target closure date.");
      return;
    }
    if (newTargetDate === action.current_target_date) {
      setErrorMsg("New target date must be different from current target date.");
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Please provide a valid justification/reason for revising the target date.");
      return;
    }

    try {
      await onSubmit(action.id, {
        new_target_date: newTargetDate,
        reason: reason.trim(),
        approved_by: approvedBy.trim(),
      });
      onClose();
    } catch (err: any) {
      const respError = err?.response?.data?.errors;
      if (typeof respError === "string") {
        setErrorMsg(respError);
      } else if (typeof respError === "object") {
        setErrorMsg(Object.values(respError).flat().join(" "));
      } else {
        setErrorMsg("Failed to revise target date. Please try again.");
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.lg } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: colorTokens.workspace.border }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Revise Target Closure Date
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            Action ID: {action.action_id} — {action.action_point.slice(0, 50)}...
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}

          <Box sx={{ mb: 2.5, p: 2, backgroundColor: "#F8FAFC", borderRadius: radiusTokens.sm, border: "1px solid #E2E8F0" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                Current Target Date:
              </Typography>
              <Chip
                label={action.current_target_date}
                size="small"
                sx={{ fontWeight: 700, backgroundColor: "#EFF6FF", color: "#1D4ED8" }}
              />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                Previous Revision Count:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {action.revision_count}
              </Typography>
            </Box>
          </Box>

          <TextField
            fullWidth
            size="small"
            type="date"
            required
            label="New Revised Target Date"
            InputLabelProps={{ shrink: true }}
            value={newTargetDate}
            onChange={(e) => setNewTargetDate(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            required
            multiline
            rows={3}
            label="Reason for Revision"
            placeholder="Document rationale, vendor delays, scope alterations, or dependencies..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Approved By (Approver / Designation)"
            placeholder="e.g. VP Operations / Circle Head"
            value={approvedBy}
            onChange={(e) => setApprovedBy(e.target.value)}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: colorTokens.workspace.border }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            sx={{
              backgroundColor: colorTokens.primary.main,
              "&:hover": { backgroundColor: colorTokens.primary.dark },
            }}
          >
            {isLoading ? "Saving Revision..." : "Save Revision"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
