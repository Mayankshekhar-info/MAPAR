import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { ScheduleOverview } from "../types/notifications.types";
import { EditWeeklyScheduleDialog, formatTime12h } from "./EditWeeklyScheduleDialog";

interface Props {
  overview: ScheduleOverview | undefined;
  isLoading: boolean;
  onTriggerNow: (params?: { slot?: string; force?: boolean; dry_run?: boolean }) => Promise<any>;
  isTriggering: boolean;
  onUpdateSchedule?: (schedule: Record<string, string[]>) => Promise<any>;
}

const ORDERED_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const ScheduleStatusCard: React.FC<Props> = ({
  overview,
  isLoading,
  onTriggerNow,
  isTriggering,
  onUpdateSchedule,
}) => {
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [scheduleUpdateFeedback, setScheduleUpdateFeedback] = useState<string | null>(null);

  const handleRunNow = async (force: boolean) => {
    setTriggerResult(null);
    try {
      const res = await onTriggerNow({ force });
      setTriggerResult(res?.result || res);
    } catch (err: any) {
      setTriggerResult({
        success: false,
        reason: err?.response?.data?.message || err?.message || "Execution failed",
      });
    }
  };

  const handleSaveSchedule = async (newSchedule: Record<string, string[]>) => {
    if (onUpdateSchedule) {
      const res = await onUpdateSchedule(newSchedule);
      setScheduleUpdateFeedback(res?.message || "Weekly reminder schedule updated successfully.");
      return res;
    }
  };

  if (isLoading) {
    return (
      <Card sx={{ p: 4, display: "flex", justifyContent: "center", borderRadius: radiusTokens.md }}>
        <CircularProgress size={32} />
      </Card>
    );
  }

  // Derive schedule matrix dynamically from overview
  const scheduleMatrix = overview?.schedule_matrix || {};

  // Find all days with at least 1 slot configured, keeping calendar order
  const activeDaysWithSlots = ORDERED_DAYS.filter(
    (day) => scheduleMatrix[day] && Array.isArray(scheduleMatrix[day]) && scheduleMatrix[day].length > 0
  );

  // If no days with slots configured, fallback to Friday, Saturday, Sunday
  const displayDays = activeDaysWithSlots.length > 0
    ? activeDaysWithSlots
    : ["Friday", "Saturday", "Sunday"];

  // Total weekly reminders calculated dynamically
  const totalWeeklyReminders = Object.values(scheduleMatrix).reduce(
    (acc, slots) => acc + (Array.isArray(slots) ? slots.length : 0),
    0
  );

  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: shadowTokens.subtle,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
            Recurring Reminder Schedule (Asia/Kolkata)
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Automated recurring reminders repeat weekly for all unclosed action points until approved closure.
          </Typography>
        </Box>
        <Chip
          icon={<AccessTimeIcon />}
          label={overview?.current_ist_time || "Asia/Kolkata"}
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      {/* KPI Stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: radiusTokens.sm, border: `1px solid ${colorTokens.workspace.border}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
              ELIGIBLE UNCLOSED TASKS
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#1e40af", mt: 0.5 }}>
              {overview?.eligible_unclosed_tasks ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Active tasks with verified email
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: radiusTokens.sm, border: `1px solid ${colorTokens.workspace.border}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
              OVERDUE TASKS
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#dc2626", mt: 0.5 }}>
              {overview?.overdue_tasks ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: "#dc2626" }}>
              Highlighted as OVERDUE
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: radiusTokens.sm, border: `1px solid ${colorTokens.workspace.border}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
              7-DAY EMAILS SENT
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#16a34a", mt: 0.5 }}>
              {overview?.past_7_days_sent ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: "#16a34a" }}>
              Delivered successfully
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: radiusTokens.sm, border: `1px solid ${colorTokens.workspace.border}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
              PERMITTED WINDOW
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.text.primary, mt: 0.5 }}>
              08:00 - 20:00 IST
            </Typography>
            <Typography variant="caption" sx={{ color: overview?.is_within_permitted_window ? "#16a34a" : "#ea580c" }}>
              {overview?.is_within_permitted_window ? "● Currently in window" : "○ Outside sending window"}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Reminder Matrix Visual */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
          Weekly Scheduled Matrix ({totalWeeklyReminders} Reminder{totalWeeklyReminders === 1 ? "" : "s"} / Week)
        </Typography>
      </Box>

      {/* Schedule Update Feedback Alert */}
      {scheduleUpdateFeedback && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setScheduleUpdateFeedback(null)}
        >
          {scheduleUpdateFeedback}
        </Alert>
      )}

      {/* Dynamically Rendered Matrix Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {displayDays.map((day) => {
          const slots = scheduleMatrix[day] || [];
          const isToday = overview?.current_day === day;
          const count = slots.length;

          return (
            <Grid key={day} size={{ xs: 12, sm: 6, md: 12 / Math.min(Math.max(displayDays.length, 1), 4) }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: radiusTokens.sm,
                  border: `1.5px solid ${isToday ? "#2563eb" : colorTokens.workspace.border}`,
                  bgcolor: isToday ? "#eff6ff" : "#ffffff",
                  height: "100%",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                    {day} {isToday && <span style={{ color: "#2563eb", fontSize: "0.75rem" }}>(Today)</span>}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${count} Reminder${count === 1 ? "" : "s"}`}
                    color={count > 2 ? "secondary" : (count > 0 ? "primary" : "default")}
                    sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 1.5, fontSize: "0.8rem" }}>
                  {count === 0 ? "No reminder cycles scheduled" : "Scheduled cycle timings:"}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {count > 0 ? (
                    slots.map((slot) => (
                      <Chip
                        key={slot}
                        label={`${formatTime12h(slot)} IST`}
                        size="small"
                        variant="outlined"
                        color={overview?.matching_slot === `${day}:${slot}` ? "success" : "default"}
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          borderWidth: "1.5px",
                        }}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: "#94a3b8", fontStyle: "italic" }}>
                      Disabled
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* Manual Trigger Result Alert */}
      {triggerResult && (
        <Alert
          severity={triggerResult.success ? "success" : "info"}
          sx={{ mb: 2.5 }}
          onClose={() => setTriggerResult(null)}
        >
          {triggerResult.success ? (
            <>
              <strong>Reminder Cycle Completed:</strong> Slot: <code>{triggerResult.slot}</code> &bull;{" "}
              {triggerResult.sent_count} sent, {triggerResult.skipped_count} skipped,{" "}
              {triggerResult.failed_count} failed.
            </>
          ) : (
            triggerResult.reason || "Cycle completed."
          )}
        </Alert>
      )}

      {/* Controls */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, borderTop: `1px solid ${colorTokens.workspace.border}` }}>
        <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
          {overview?.matching_slot ? (
            <span style={{ color: "#16a34a", fontWeight: 600 }}>
              ● Current slot active: {overview.matching_slot}
            </span>
          ) : (
            "No scheduled slot active at this exact hour."
          )}
        </Typography>

        <Stack direction="row" spacing={1.5}>
          {/* Edit Weekly Schedule Action Button */}
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<EditCalendarIcon />}
            onClick={() => setIsEditModalOpen(true)}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: radiusTokens.sm,
            }}
          >
            Edit Weekly Schedule
          </Button>

          {/* Force Run Action Button */}
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={isTriggering ? <CircularProgress size={14} /> : <PlayArrowIcon />}
            onClick={() => handleRunNow(true)}
            disabled={isTriggering}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: radiusTokens.sm,
            }}
          >
            Force Run Reminder Cycle Now
          </Button>
        </Stack>
      </Box>

      {/* Edit Weekly Schedule Dialog */}
      <EditWeeklyScheduleDialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentSchedule={overview?.schedule_matrix}
        onSave={handleSaveSchedule}
      />
    </Card>
  );
};
