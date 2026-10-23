import React, { useState, useEffect } from "react";
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
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceActionPoint } from "../types/governance.types";

interface RequestTargetRevisionModalProps {
  open: boolean;
  action: GovernanceActionPoint | null;
  onClose: () => void;
  onSubmit: (actionId: number, requestedTargetDate: string, reason: string) => Promise<void>;
}

export const RequestTargetRevisionModal: React.FC<RequestTargetRevisionModalProps> = ({
  open,
  action,
  onClose,
  onSubmit,
}) => {
  const [requestedDate, setRequestedDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (action) {
      // Suggest two weeks from current target as default
      const current = action.current_target_date || action.target_closure_date || "";
      if (current) {
        const d = new Date(current);
        d.setDate(d.getDate() + 14);
        setRequestedDate(d.toISOString().split("T")[0]);
      } else {
        const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
        setRequestedDate(twoWeeks);
      }
      setReason("");
      setErrorMsg(null);
    }
  }, [action, open]);

  if (!action) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!requestedDate) {
      setErrorMsg("Requested new target date is required.");
      return;
    }

    if (requestedDate === action.current_target_date) {
      setErrorMsg("Requested new target date must be different from current target date.");
      return;
    }

    if (!reason.trim()) {
      setErrorMsg("A mandatory business reason explaining the revision request is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(action.id, requestedDate, reason.trim());
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.errors || err.response?.data?.detail || err.message || "Failed to submit revision request.";
      setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.md } }}>
      <DialogTitle sx={{ fontWeight: 800, color: colorTokens.text.primary, display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <EventRepeatIcon sx={{ color: colorTokens.primary.main, fontSize: 24 }} />
        Request Target Date Revision
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
          {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

          {/* Task Context Card */}
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
                label={action.action_id}
                size="small"
                sx={{ fontWeight: 800, backgroundColor: "#E0F2FE", color: "#0369A1" }}
              />
              <Chip
                label={action.status}
                size="small"
                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
              />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
              {action.action_point}
            </Typography>

            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
              Circle: <strong>{action.circle.name}</strong> &bull; Owner: <strong>{action.owner?.full_name || action.owner_name_override || "Unassigned"}</strong>
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 1.5, pt: 1.5, borderTop: `1px solid ${colorTokens.workspace.border}` }}>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Original Target Date:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  {action.target_closure_date}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                  Current Effective Target:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  {action.current_target_date}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ fontSize: "0.8rem" }}>
            The current active target date will <strong>not</strong> change immediately. Your request will be saved in <strong>Pending</strong> status and submitted to Governance & Risk reviewers for formal approval.
          </Alert>

          <TextField
            label="Requested New Target Date"
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            required
            size="small"
            helperText="Select the proposed extension date required to achieve deliverables."
          />

          <TextField
            label="Reason for Target Date Revision *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            required
            placeholder="Explain the specific root causes, blockers, vendor delays, or unforeseen conditions requiring extra time..."
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
            disabled={isSubmitting}
            sx={{
              backgroundColor: colorTokens.primary.main,
              "&:hover": { backgroundColor: colorTokens.primary.dark },
              fontWeight: 700,
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Revision Request"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
