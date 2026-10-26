import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import {
  GovernanceActionPoint,
  GovernanceWeeklyUpdate,
  SubmitWeeklyUpdatePayload,
} from "../types/governance.types";
import { governanceService } from "../api/governanceService";
import { useAuth } from "../../auth";

interface GovernanceWeeklyUpdateModalProps {
  open: boolean;
  action: GovernanceActionPoint | null;
  onClose: () => void;
  onSubmit: (actionId: number, payload: SubmitWeeklyUpdatePayload) => Promise<void>;
  onRequireEvidence?: (action: GovernanceActionPoint) => void;
  isLoading?: boolean;
}

export const GovernanceWeeklyUpdateModal: React.FC<GovernanceWeeklyUpdateModalProps> = ({
  open,
  action,
  onClose,
  onSubmit,
  onRequireEvidence,
  isLoading = false,
}) => {
  const { user } = useAuth();

  // Current ISO week default helper (e.g. 2026-W42)
  const getDefaultWeek = () => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const yr = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${yr}`;
    } catch {
      return dateStr;
    }
  };

  const [reportingWeek, setReportingWeek] = useState(getDefaultWeek());
  const [workCompleted, setWorkCompleted] = useState("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [achievements, setAchievements] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextWeekPlan, setNextWeekPlan] = useState("");
  const [status, setStatus] = useState<"Open" | "WIP" | "Closed" | "On Hold">("WIP");
  const [updatedBy, setUpdatedBy] = useState("");
  const [revisedTargetDate, setRevisedTargetDate] = useState("");
  const [actualClosureDate, setActualClosureDate] = useState("");
  const [closureEvidence, setClosureEvidence] = useState("");
  const [allowRevision, setAllowRevision] = useState(false);
  const [history, setHistory] = useState<GovernanceWeeklyUpdate[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (action && open) {
      setProgressPercent(action.current_progress_percent || 0);
      setStatus(action.status === "Closed" ? "Closed" : action.status === "Open" ? "Open" : "WIP");
      setReportingWeek(getDefaultWeek());
      setWorkCompleted("");
      setAchievements("");
      setBlockers("");
      setNextWeekPlan("");
      setClosureEvidence("");
      setRevisedTargetDate("");
      setActualClosureDate(action.actual_closure_date || "");
      setAllowRevision(false);
      setErrorMsg(null);

      const updaterName =
        user?.name ||
        user?.username ||
        action.owner?.full_name ||
        action.owner?.username ||
        action.owner_name_override ||
        "";
      setUpdatedBy(updaterName);

      // Fetch update history
      governanceService
        .getWeeklyUpdates(action.id)
        .then((res) => {
          setHistory(Array.isArray(res) ? res : []);
        })
        .catch(() => {
          setHistory([]);
        });
    }
  }, [action, open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;

    if (!reportingWeek.trim()) {
      setErrorMsg("Reporting week is required.");
      return;
    }

    if (!workCompleted.trim()) {
      setErrorMsg("Please describe action taken / progress achieved during this reporting week.");
      return;
    }

    setErrorMsg(null);

    const submitStatus = status === "On Hold" ? "WIP" : status;

    if (submitStatus === "Closed" && action.evidence_required && action.evidence_status !== "Accepted") {
      if (onRequireEvidence) {
        onRequireEvidence(action);
        onClose();
        return;
      }
    }

    try {
      let finalRemarks = closureEvidence.trim();
      if (revisedTargetDate) {
        const revNote = `Revised Target: ${revisedTargetDate}`;
        finalRemarks = finalRemarks ? `${finalRemarks} | ${revNote}` : revNote;
      }

      await onSubmit(action.id, {
        reporting_week: reportingWeek.trim(),
        work_completed: workCompleted.trim(),
        progress_percent: progressPercent,
        achievements: achievements.trim(),
        blockers: blockers.trim(),
        next_week_plan: nextWeekPlan.trim(),
        status: submitStatus,
        actual_closure_date: actualClosureDate || undefined,
        remarks: finalRemarks || undefined,
        allow_revision: allowRevision,
      });
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.reporting_week ||
        err?.response?.data?.errors ||
        err?.message ||
        "Failed to submit weekly update.";
      setErrorMsg(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    }
  };

  if (!action) return null;

  // Metadata labels
  const overdueText = action.is_overdue
    ? `${action.ageing_days || 0} days overdue`
    : action.ageing_days > 0
    ? `${action.ageing_days} days ageing`
    : "on track";

  const circleName = action.circle?.code || action.circle?.name || "Circle";
  const functionName = action.function_area || "General";
  const ownerDisplayName =
    action.owner?.full_name ||
    action.owner?.username ||
    action.owner_name_override ||
    "Unassigned";
  const targetFormatted = formatDateDisplay(action.current_target_date || action.target_closure_date);
  const originalTargetStr = formatDateDisplay(action.target_closure_date || action.current_target_date);
  const revisionsCount = action.revision_count ?? action.revisions?.length ?? 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          p: { xs: 2, sm: 3 },
          maxHeight: "92vh",
        },
      }}
    >
      {/* Top Header Section */}
      <Box sx={{ position: "relative", mb: 2.5 }}>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            right: -8,
            top: -8,
            color: colorTokens.text.muted,
            "&:hover": { color: colorTokens.text.primary, backgroundColor: colorTokens.secondary.lighter },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Metadata breadcrumb line */}
        <Typography
          variant="caption"
          sx={{
            color: colorTokens.text.muted,
            fontSize: "0.82rem",
            fontWeight: 500,
            display: "block",
            mb: 0.5,
          }}
        >
          {action.action_id} · {circleName} · {functionName} · {ownerDisplayName} · target {targetFormatted} ({overdueText})
        </Typography>

        {/* Task Title */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            color: colorTokens.text.primary,
            letterSpacing: "-0.01em",
            mb: 0.75,
            fontSize: { xs: "1.2rem", sm: "1.4rem" },
          }}
        >
          {action.action_point}
        </Typography>

        {/* Task Deliverable / Description */}
        <Typography
          variant="body2"
          sx={{
            color: colorTokens.text.secondary,
            fontSize: "0.88rem",
            lineHeight: 1.45,
          }}
        >
          {action.key_deliverable || "No specific deliverable noted."}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", gap: 2.2 }}>
          {errorMsg && (
            <Alert severity="error" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          {/* Status Section */}
          <Box>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 1 }}>
              Status
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              {[
                { label: "Open", value: "Open", activeBg: "#F59E0B", activeText: "#FFFFFF" },
                { label: "In Progress", value: "WIP", activeBg: colorTokens.primary.main, activeText: "#FFFFFF" },
                { label: "On Hold", value: "On Hold", activeBg: "#64748B", activeText: "#FFFFFF" },
                { label: "Closed", value: "Closed", activeBg: colorTokens.status.success.main, activeText: "#FFFFFF" },
              ].map((item) => {
                const isSelected = status === item.value;
                return (
                  <Button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setStatus(item.value as any);
                      if (item.value === "Closed") {
                        setProgressPercent(100);
                        if (!actualClosureDate) {
                          setActualClosureDate(new Date().toISOString().split("T")[0]);
                        }
                      }
                    }}
                    sx={{
                      borderRadius: "20px",
                      px: 2.2,
                      py: 0.6,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      textTransform: "none",
                      backgroundColor: isSelected ? item.activeBg : colorTokens.workspace.background,
                      color: isSelected ? item.activeText : colorTokens.text.secondary,
                      border: isSelected
                        ? `1px solid ${item.activeBg}`
                        : `1px solid ${colorTokens.workspace.border}`,
                      "&:hover": {
                        backgroundColor: isSelected ? item.activeBg : colorTokens.secondary.lighter,
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* Row: Progress Slider | Updated by | Revised target date */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1.2fr 1.4fr 1.4fr" },
              gap: 2,
              alignItems: "flex-start",
            }}
          >
            {/* Progress Slider */}
            <Box sx={{ pt: 0.5 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Progress{" "}
                <span style={{ color: colorTokens.primary.main, fontWeight: 700 }}>{progressPercent}%</span>
              </Typography>
              <Slider
                value={progressPercent}
                onChange={(_, val) => setProgressPercent(val as number)}
                min={0}
                max={100}
                step={5}
                valueLabelDisplay="auto"
                sx={{
                  color: colorTokens.primary.main,
                  height: 5,
                  mt: 1,
                  "& .MuiSlider-thumb": {
                    width: 14,
                    height: 14,
                    backgroundColor: colorTokens.primary.main,
                  },
                  "& .MuiSlider-track": {
                    backgroundColor: colorTokens.primary.main,
                  },
                  "& .MuiSlider-rail": {
                    backgroundColor: colorTokens.workspace.border,
                  },
                }}
              />
            </Box>

            {/* Updated by */}
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Updated by
              </Typography>
              <TextField
                value={updatedBy}
                onChange={(e) => setUpdatedBy(e.target.value)}
                placeholder="Name / Designation"
                fullWidth
                size="small"
              />
            </Box>

            {/* Revised target date (if needed) */}
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Revised target date (if needed)
              </Typography>
              <TextField
                type="date"
                value={revisedTargetDate}
                onChange={(e) => setRevisedTargetDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>

          {/* Row: Actual closure date | Reporting Week */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1.4fr" },
              gap: 2,
            }}
          >
            {/* Actual closure date */}
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Actual closure date
              </Typography>
              <TextField
                type="date"
                value={actualClosureDate}
                onChange={(e) => setActualClosureDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            {/* Reporting Week */}
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Reporting Week
              </Typography>
              <TextField
                value={reportingWeek}
                onChange={(e) => setReportingWeek(e.target.value)}
                placeholder="e.g. 2026-W42"
                required
                fullWidth
                size="small"
              />
            </Box>
          </Box>

          {/* Action taken / progress achieved */}
          <Box>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
              Action taken / progress achieved
            </Typography>
            <TextField
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
              placeholder="What action has been taken and what progress has been achieved?"
              multiline
              rows={3}
              required
              fullWidth
              size="small"
            />
          </Box>

          {/* Next step / commitment (what, who, by when) */}
          <Box>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
              Next step / commitment (what, who, by when)
            </Typography>
            <TextField
              value={nextWeekPlan}
              onChange={(e) => setNextWeekPlan(e.target.value)}
              placeholder="What remains to be done, by whom, and by when?"
              multiline
              rows={2}
              fullWidth
              size="small"
            />
          </Box>

          {/* Closure evidence */}
          <Box>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
              Closure evidence
            </Typography>
            <TextField
              value={closureEvidence}
              onChange={(e) => setClosureEvidence(e.target.value)}
              placeholder="Mail ref, document link, approval no...."
              fullWidth
              size="small"
            />
          </Box>

          {/* Optional Preserved Fields: Achievements & Blockers */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Key Achievements & Deliverables (Optional)
              </Typography>
              <TextField
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="Key deliverables met, inspections passed, approvals acquired..."
                multiline
                rows={2}
                fullWidth
                size="small"
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: colorTokens.text.secondary, mb: 0.75 }}>
                Challenges, Blockers or Delay Reasons (Optional)
              </Typography>
              <TextField
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Identify dependency blockers, supplier delays, weather..."
                multiline
                rows={2}
                fullWidth
                size="small"
              />
            </Box>
          </Box>

          {/* Multiple updates governance notice */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1.25,
              borderRadius: radiusTokens.sm,
              backgroundColor: `${colorTokens.primary.main}0A`,
              border: `1px solid ${colorTokens.primary.main}20`,
            }}
          >
            <Typography sx={{ color: colorTokens.text.secondary, fontSize: "0.82rem" }}>
              <strong>Multi-Update Support:</strong> Multiple weekly updates are permitted. Each update is permanently preserved as a separate entry in the Governance audit trail.
            </Typography>
          </Box>

          {/* Action Buttons & Target Info */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "wrap",
              pt: 1,
            }}
          >
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              sx={{
                backgroundColor: colorTokens.primary.main,
                "&:hover": { backgroundColor: colorTokens.primary.dark },
                borderRadius: radiusTokens.sm,
                px: 2.8,
                py: 0.85,
                fontWeight: 600,
                fontSize: "0.86rem",
                textTransform: "none",
                boxShadow: "none",
              }}
            >
              {isLoading ? "Saving..." : "Save update"}
            </Button>
            <Button
              onClick={onClose}
              variant="outlined"
              disabled={isLoading}
              sx={{
                color: colorTokens.text.secondary,
                borderColor: colorTokens.workspace.border,
                "&:hover": {
                  backgroundColor: colorTokens.secondary.lighter,
                  borderColor: colorTokens.workspace.border,
                },
                borderRadius: radiusTokens.sm,
                px: 2.4,
                py: 0.85,
                fontWeight: 600,
                fontSize: "0.86rem",
                textTransform: "none",
              }}
            >
              Cancel
            </Button>
            <Typography sx={{ color: colorTokens.text.muted, fontSize: "0.82rem", ml: { sm: 1 } }}>
              Original target {originalTargetStr} · revisions {revisionsCount}
            </Typography>
          </Box>

          {/* Update History Section */}
          <Box sx={{ pt: 2, borderTop: `1px solid ${colorTokens.workspace.divider}`, mt: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: colorTokens.text.primary, mb: 1.5 }}>
              Update history ({history.length})
            </Typography>
            {history.length === 0 ? (
              <Typography sx={{ color: colorTokens.text.muted, fontSize: "0.85rem" }}>
                No updates recorded yet.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  maxHeight: 280,
                  overflowY: "auto",
                  pr: 0.5,
                }}
              >
                {[...history].reverse().map((upd, idx) => (
                  <Box
                    key={upd.id}
                    sx={{
                      p: 1.75,
                      borderRadius: radiusTokens.sm,
                      backgroundColor: idx === 0 ? "#FFFFFF" : colorTokens.workspace.background,
                      border: `1px solid ${idx === 0 ? colorTokens.primary.main : colorTokens.workspace.border}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 0.75,
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: colorTokens.primary.main }}>
                          {upd.reporting_week}
                        </Typography>
                        {idx === 0 && (
                          <Chip
                            label="LATEST"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: "0.62rem",
                              fontWeight: 800,
                              backgroundColor: `${colorTokens.primary.main}18`,
                              color: colorTokens.primary.main,
                            }}
                          />
                        )}
                        {upd.revision_number > 1 && (
                          <Chip
                            label={`Week Entry #${upd.revision_number}`}
                            size="small"
                            sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, backgroundColor: "#EEF2F6" }}
                          />
                        )}
                        <Typography sx={{ fontSize: "0.75rem", color: colorTokens.text.muted }}>
                          · {new Date(upd.submitted_at || upd.updated_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {upd.previous_progress_percent !== undefined && upd.previous_progress_percent !== null && upd.previous_progress_percent !== upd.progress_percent ? (
                          <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: colorTokens.primary.main }}>
                            {upd.previous_progress_percent}% → {upd.progress_percent}%
                          </Typography>
                        ) : (
                          <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: colorTokens.text.primary }}>
                            {upd.progress_percent}%
                          </Typography>
                        )}
                        <Chip
                          label={upd.previous_status && upd.previous_status !== upd.status ? `${upd.previous_status} → ${upd.status}` : upd.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            backgroundColor:
                              upd.status === "Closed"
                                ? `${colorTokens.status.success.main}18`
                                : `${colorTokens.primary.main}18`,
                            color:
                              upd.status === "Closed"
                                ? colorTokens.status.success.main
                                : colorTokens.primary.main,
                          }}
                        />
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: "0.82rem", color: colorTokens.text.primary, mb: 0.5 }}>
                      {upd.work_completed}
                    </Typography>
                    {upd.next_week_plan && (
                      <Typography sx={{ fontSize: "0.76rem", color: colorTokens.text.secondary }}>
                        Next: {upd.next_week_plan}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ display: "block", color: colorTokens.text.muted, fontSize: "0.72rem", mt: 0.5 }}>
                      Updated by {upd.submitted_by?.full_name || upd.submitted_by?.username || action.owner?.full_name || "Owner"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
      </form>
    </Dialog>
  );
};
