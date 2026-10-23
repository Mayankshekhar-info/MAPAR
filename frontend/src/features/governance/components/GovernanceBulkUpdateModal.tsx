import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import {
  SimpleUser,
  BulkOperationResult,
  BulkUpdateActionsPayload,
  BulkWeeklySubmitPayload,
  BulkEvidenceReviewPayload,
} from "../types/governance.types";

export type BulkModalMode = "actions" | "weekly" | "evidence";

interface GovernanceBulkUpdateModalProps {
  open: boolean;
  mode: BulkModalMode;
  selectedIds: number[];
  users?: SimpleUser[];
  onClose: () => void;
  onBulkUpdateActions?: (payload: BulkUpdateActionsPayload) => Promise<BulkOperationResult>;
  onBulkSubmitWeekly?: (payload: BulkWeeklySubmitPayload) => Promise<BulkOperationResult>;
  onBulkReviewEvidence?: (payload: BulkEvidenceReviewPayload) => Promise<BulkOperationResult>;
}

export const GovernanceBulkUpdateModal: React.FC<GovernanceBulkUpdateModalProps> = ({
  open,
  mode,
  selectedIds,
  users = [],
  onClose,
  onBulkUpdateActions,
  onBulkSubmitWeekly,
  onBulkReviewEvidence,
}) => {
  // Action fields
  const [ownerId, setOwnerId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");

  // Weekly fields
  const [reportingWeek, setReportingWeek] = useState<string>("2026-W42");
  const [workCompleted, setWorkCompleted] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Evidence fields
  const [decision, setDecision] = useState<"Accepted" | "Rework Required">("Accepted");
  const [reviewComment, setReviewComment] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkOperationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReset = () => {
    setOwnerId("");
    setStatus("");
    setPriority("");
    setTargetDate("");
    setWorkCompleted("");
    setProgressPercent(0);
    setDecision("Accepted");
    setReviewComment("");
    setBulkResult(null);
    setErrorMsg(null);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setErrorMsg(null);
    setIsLoading(true);

    try {
      let res: BulkOperationResult | undefined;

      if (mode === "actions" && onBulkUpdateActions) {
        const payload: BulkUpdateActionsPayload = {
          task_ids: selectedIds,
        };
        if (ownerId) payload.owner_id = Number(ownerId);
        if (status) payload.status = status as any;
        if (priority) payload.priority = priority as any;
        if (targetDate) payload.target_closure_date = targetDate;
        res = await onBulkUpdateActions(payload);
      } else if (mode === "weekly" && onBulkSubmitWeekly) {
        if (!workCompleted.trim()) {
          setErrorMsg("Please describe work completed for this weekly bulk entry.");
          setIsLoading(false);
          return;
        }
        res = await onBulkSubmitWeekly({
          task_ids: selectedIds,
          reporting_week: reportingWeek,
          work_completed: workCompleted,
          progress_percent: progressPercent,
          status: (status as any) || "WIP",
        });
      } else if (mode === "evidence" && onBulkReviewEvidence) {
        res = await onBulkReviewEvidence({
          evidence_ids: selectedIds,
          decision,
          review_comment: reviewComment,
        });
      }

      if (res) {
        setBulkResult(res);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Bulk operation failed. Please check your permissions and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const titleMap = {
    actions: "Bulk Update Governance Tasks",
    weekly: "Bulk Weekly Progress Submission",
    evidence: "Bulk Evidence Review",
  };

  return (
    <Dialog open={open} onClose={handleModalClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DynamicFeedIcon sx={{ color: colorTokens.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            {titleMap[mode]}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
          {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""} selected for batch execution
        </Typography>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {errorMsg && (
            <Alert severity="error" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          {/* Result view if already completed */}
          {bulkResult ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert
                severity={bulkResult.failed_count === 0 ? "success" : "warning"}
                icon={bulkResult.failed_count === 0 ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
              >
                Processed {bulkResult.total} items: {bulkResult.successful_count} succeeded,{" "}
                {bulkResult.failed_count} failed.
              </Alert>

              <Box sx={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${colorTokens.workspace.border}`, borderRadius: radiusTokens.sm, p: 1 }}>
                {bulkResult.results.map((r, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 0.75,
                      px: 1,
                      borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                      {r.action_id || `ID #${r.task_id || r.evidence_id}`}
                    </Typography>
                    <Chip
                      label={r.success ? "Success" : String(r.error || "Failed")}
                      size="small"
                      color={r.success ? "success" : "error"}
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.68rem" }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <>
              {/* Actions Mode Fields */}
              {mode === "actions" && (
                <>
                  <TextField
                    label="Assign Owner (Optional)"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    select
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">-- Keep Existing Owners --</MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.full_name} (@{u.username}) — {u.email} [ID: #{u.id}] ({u.role})
                      </MenuItem>
                    ))}
                  </TextField>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <TextField
                      label="Status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      select
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="">-- Keep Existing --</MenuItem>
                      <MenuItem value="Open">Open</MenuItem>
                      <MenuItem value="WIP">WIP</MenuItem>
                      <MenuItem value="Closed">Closed</MenuItem>
                    </TextField>

                    <TextField
                      label="Priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      select
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="">-- Keep Existing --</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="Low">Low</MenuItem>
                    </TextField>
                  </Box>

                  <TextField
                    label="Target Closure Date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                    helperText="Leave blank to preserve each task's current target date"
                  />
                </>
              )}

              {/* Weekly Mode Fields */}
              {mode === "weekly" && (
                <>
                  <TextField
                    label="Reporting Week"
                    value={reportingWeek}
                    onChange={(e) => setReportingWeek(e.target.value)}
                    fullWidth
                    size="small"
                    required
                  />
                  <TextField
                    label="Shared Work Completed Summary"
                    value={workCompleted}
                    onChange={(e) => setWorkCompleted(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                    size="small"
                    required
                    placeholder="Describe common update applying to all selected tasks..."
                  />
                  <TextField
                    label="Progress %"
                    type="number"
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    inputProps={{ min: 0, max: 100 }}
                    fullWidth
                    size="small"
                  />
                </>
              )}

              {/* Evidence Mode Fields */}
              {mode === "evidence" && (
                <>
                  <TextField
                    label="Review Decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as any)}
                    select
                    fullWidth
                    size="small"
                    required
                  >
                    <MenuItem value="Accepted">Accept Selected Evidence</MenuItem>
                    <MenuItem value="Rework Required">Request Rework</MenuItem>
                  </TextField>
                  <TextField
                    label="Review Feedback / Note"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                    size="small"
                    placeholder="Enter review notes or reason for rework request..."
                  />
                </>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleModalClose} disabled={isLoading} sx={{ color: colorTokens.text.secondary }}>
            {bulkResult ? "Done" : "Cancel"}
          </Button>
          {!bulkResult && (
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading || selectedIds.length === 0}
              sx={{
                backgroundColor: colorTokens.primary.main,
                "&:hover": { backgroundColor: colorTokens.primary.dark },
                borderRadius: radiusTokens.sm,
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              {isLoading ? "Processing..." : `Apply to ${selectedIds.length} Items`}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};
