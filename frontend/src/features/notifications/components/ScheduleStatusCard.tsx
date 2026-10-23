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

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { ScheduleOverview } from "../types/notifications.types";

interface Props {
  overview: ScheduleOverview | undefined;
  isLoading: boolean;
  onTriggerNow: (params?: { slot?: string; force?: boolean; dry_run?: boolean }) => Promise<any>;
  isTriggering: boolean;
}

export const ScheduleStatusCard: React.FC<Props> = ({
  overview,
  isLoading,
  onTriggerNow,
  isTriggering,
}) => {
  const [triggerResult, setTriggerResult] = useState<any>(null);

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

  if (isLoading) {
    return (
      <Card sx={{ p: 4, display: "flex", justifyContent: "center", borderRadius: radiusTokens.md }}>
        <CircularProgress size={32} />
      </Card>
    );
  }

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
            Automated weekend reminders repeat weekly for all unclosed action points until approved closure.
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
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: colorTokens.text.primary }}>
        Weekly Scheduled Matrix (8 Reminders / Week)
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Friday */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: radiusTokens.sm,
              border: `1px solid ${overview?.current_day === "Friday" ? "#2563eb" : colorTokens.workspace.border}`,
              bgcolor: overview?.current_day === "Friday" ? "#eff6ff" : "#ffffff",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Friday
              </Typography>
              <Chip size="small" label="1 Reminder" color="primary" sx={{ height: 20, fontSize: 11 }} />
            </Box>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 1 }}>
              Weekly planning reminder
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label="10:00 AM IST" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
          </Box>
        </Grid>

        {/* Saturday */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: radiusTokens.sm,
              border: `1px solid ${overview?.current_day === "Saturday" ? "#2563eb" : colorTokens.workspace.border}`,
              bgcolor: overview?.current_day === "Saturday" ? "#eff6ff" : "#ffffff",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Saturday
              </Typography>
              <Chip size="small" label="3 Reminders" color="secondary" sx={{ height: 20, fontSize: 11 }} />
            </Box>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 1 }}>
              Morning, afternoon, evening
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label="09:00 AM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label="01:00 PM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label="05:00 PM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
          </Box>
        </Grid>

        {/* Sunday */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: radiusTokens.sm,
              border: `1px solid ${overview?.current_day === "Sunday" ? "#2563eb" : colorTokens.workspace.border}`,
              bgcolor: overview?.current_day === "Sunday" ? "#eff6ff" : "#ffffff",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Sunday
              </Typography>
              <Chip size="small" label="4 Reminders" color="warning" sx={{ height: 20, fontSize: 11 }} />
            </Box>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 1 }}>
              Closure deadline reminders
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              <Chip label="09:00 AM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label="12:00 PM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label="03:00 PM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label="06:00 PM" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
          </Box>
        </Grid>
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
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={isTriggering ? <CircularProgress size={14} /> : <PlayArrowIcon />}
            onClick={() => handleRunNow(true)}
            disabled={isTriggering}
          >
            Force Run Reminder Cycle Now
          </Button>
        </Stack>
      </Box>
    </Card>
  );
};
