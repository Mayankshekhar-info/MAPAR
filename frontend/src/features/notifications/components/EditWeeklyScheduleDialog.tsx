import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

export interface EditWeeklyScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  currentSchedule: Record<string, string[]> | undefined;
  onSave: (schedule: Record<string, string[]>) => Promise<any>;
}

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// Common business hour slots (08:00 to 20:00 IST)
const STANDARD_TIME_OPTIONS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

export const formatTime12h = (time24: string): string => {
  if (!time24 || !time24.includes(":")) return time24;
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${mStr || "00"} ${ampm}`;
};

export const EditWeeklyScheduleDialog: React.FC<EditWeeklyScheduleDialogProps> = ({
  open,
  onClose,
  currentSchedule = {},
  onSave,
}) => {
  // Local state representing the working copy of the schedule: day -> string[]
  const [scheduleState, setScheduleState] = useState<Record<string, string[]>>({});
  // Selected new slot time per day for the "Add Slot" input
  const [selectedTimePerDay, setSelectedTimePerDay] = useState<Record<string, string>>({});
  // Validation error / feedback message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize or reset schedule state whenever modal opens or currentSchedule changes
  useEffect(() => {
    if (open) {
      const initial: Record<string, string[]> = {};
      ALL_DAYS.forEach((day) => {
        const slots = currentSchedule[day] || [];
        // Sort chronologically
        initial[day] = [...slots].sort();
      });
      setScheduleState(initial);
      setErrorMessage(null);
      setSaveSuccess(false);

      // Default selected time inputs
      const defaultTimes: Record<string, string> = {};
      ALL_DAYS.forEach((day) => {
        defaultTimes[day] = "09:00";
      });
      setSelectedTimePerDay(defaultTimes);
    }
  }, [open, currentSchedule]);

  // Toggle enabling/disabling a day
  const handleToggleDay = (day: string) => {
    setErrorMessage(null);
    setScheduleState((prev) => {
      const currentSlots = prev[day] || [];
      if (currentSlots.length > 0) {
        // Disable by clearing slots
        return { ...prev, [day]: [] };
      } else {
        // Enable with a default slot (e.g. 10:00 AM)
        return { ...prev, [day]: ["10:00"] };
      }
    });
  };

  // Remove a specific time slot from a day
  const handleRemoveSlot = (day: string, slotToRemove: string) => {
    setErrorMessage(null);
    setScheduleState((prev) => {
      const currentSlots = prev[day] || [];
      const updated = currentSlots.filter((s) => s !== slotToRemove);
      return { ...prev, [day]: updated };
    });
  };

  // Add a new time slot to a day
  const handleAddSlot = (day: string) => {
    setErrorMessage(null);
    const timeToAdd = (selectedTimePerDay[day] || "09:00").trim();

    // Validate format HH:MM
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeToAdd)) {
      setErrorMessage(`Invalid time format '${timeToAdd}' for ${day}. Expected HH:MM in 24-hour format.`);
      return;
    }

    const currentSlots = scheduleState[day] || [];
    if (currentSlots.includes(timeToAdd)) {
      setErrorMessage(`Time slot '${formatTime12h(timeToAdd)}' already exists for ${day}. Duplicate timings are not allowed.`);
      return;
    }

    const updated = [...currentSlots, timeToAdd].sort();
    setScheduleState((prev) => ({
      ...prev,
      [day]: updated,
    }));
  };

  // Calculate total reminders
  const totalWeeklyReminders = Object.values(scheduleState).reduce(
    (acc, slots) => acc + (Array.isArray(slots) ? slots.length : 0),
    0
  );

  // Handle Save
  const handleSave = async () => {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      // Build clean payload: omit days with 0 slots or send empty array
      const cleanedPayload: Record<string, string[]> = {};
      ALL_DAYS.forEach((day) => {
        const slots = scheduleState[day] || [];
        if (slots.length > 0) {
          cleanedPayload[day] = [...slots].sort();
        }
      });

      await onSave(cleanedPayload);
      setSaveSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setIsSaving(false);
      const msg =
        err?.response?.data?.errors?.schedule ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update weekly reminder schedule. Please try again.";
      setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: radiusTokens.lg,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pb: 1 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <EditCalendarIcon sx={{ color: colorTokens.primary.main, fontSize: 26 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              Edit Weekly Recurring Reminder Schedule
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.5 }}>
            Customize reminder days, frequency, and time slots (Asia/Kolkata timezone). Automated reminders repeat weekly until task closure.
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={isSaving} size="small" aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2, pb: 2 }}>
        {/* Error Feedback */}
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {/* Success Feedback */}
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Weekly reminder schedule successfully saved and applied!
          </Alert>
        )}

        {/* Schedule Summary Banner */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 1.5,
            mb: 2.5,
            bgcolor: "#F8FAFC",
            borderRadius: radiusTokens.sm,
            border: "1px solid #E2E8F0",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTimeIcon sx={{ color: colorTokens.primary.main, fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#1E293B" }}>
              Timezone: Asia/Kolkata (IST) &bull; Permitted Sending Window: 08:00 AM - 08:00 PM
            </Typography>
          </Stack>
          <Chip
            label={`${totalWeeklyReminders} Total Reminders / Week`}
            color={totalWeeklyReminders > 0 ? "primary" : "default"}
            sx={{ fontWeight: 700 }}
          />
        </Box>

        {/* Days List */}
        <Stack spacing={2}>
          {ALL_DAYS.map((day) => {
            const slots = scheduleState[day] || [];
            const isEnabled = slots.length > 0;
            const selectedTime = selectedTimePerDay[day] || "09:00";

            return (
              <Box
                key={day}
                sx={{
                  p: 2,
                  borderRadius: radiusTokens.sm,
                  border: `1.5px solid ${isEnabled ? "#CBD5E1" : "#F1F5F9"}`,
                  bgcolor: isEnabled ? "#FFFFFF" : "#F8FAFC",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                {/* Day Header Row */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                    mb: isEnabled ? 1.5 : 0,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isEnabled}
                        onChange={() => handleToggleDay(day)}
                        color="primary"
                      />
                    }
                    label={
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          color: isEnabled ? "#0F172A" : "#64748B",
                        }}
                      >
                        {day}
                      </Typography>
                    }
                  />

                  <Chip
                    size="small"
                    label={isEnabled ? `${slots.length} Reminder${slots.length === 1 ? "" : "s"}` : "Disabled"}
                    color={isEnabled ? (slots.length > 2 ? "secondary" : "primary") : "default"}
                    variant={isEnabled ? "filled" : "outlined"}
                    sx={{ fontWeight: 600, fontSize: "0.75rem" }}
                  />
                </Box>

                {/* Slots & Add Controls (when enabled) */}
                {isEnabled && (
                  <Box sx={{ pl: { xs: 0, sm: 4.5 } }}>
                    {/* Active Slots Chips */}
                    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                      <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, mr: 0.5 }}>
                        Scheduled Timings:
                      </Typography>
                      {slots.map((slot) => (
                        <Chip
                          key={slot}
                          label={`${formatTime12h(slot)} IST`}
                          size="small"
                          onDelete={() => handleRemoveSlot(day, slot)}
                          color="primary"
                          variant="outlined"
                          sx={{
                            fontWeight: 600,
                            borderRadius: radiusTokens.sm,
                            borderWidth: "1.5px",
                          }}
                        />
                      ))}
                    </Box>

                    {/* Add Slot Controls */}
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                      <TextField
                        select
                        size="small"
                        label="Select Time Slot"
                        value={selectedTime}
                        onChange={(e) =>
                          setSelectedTimePerDay((prev) => ({
                            ...prev,
                            [day]: e.target.value,
                          }))
                        }
                        sx={{ minWidth: 160 }}
                      >
                        {STANDARD_TIME_OPTIONS.map((timeOption) => (
                          <MenuItem key={timeOption} value={timeOption}>
                            {formatTime12h(timeOption)} ({timeOption} IST)
                          </MenuItem>
                        ))}
                      </TextField>

                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => handleAddSlot(day)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: radiusTokens.sm,
                        }}
                      >
                        Add Time Slot
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
          {totalWeeklyReminders === 0
            ? "Warning: No reminders scheduled. Automated cycles will be paused."
            : `${totalWeeklyReminders} total reminder cycle${totalWeeklyReminders === 1 ? "" : "s"} configured.`}
        </Typography>

        <Stack direction="row" spacing={1.5}>
          <Button
            onClick={onClose}
            disabled={isSaving}
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: radiusTokens.sm,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
              textTransform: "none",
              fontWeight: 700,
              borderRadius: radiusTokens.sm,
              px: 3,
            }}
          >
            {isSaving ? "Saving Schedule..." : "Save Schedule"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

