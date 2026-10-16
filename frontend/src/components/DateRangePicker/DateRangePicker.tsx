import React, { useState, useMemo, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs, { Dayjs } from "dayjs";
import { colorTokens, radiusTokens } from "../../app/theme/tokens";

export interface DateRangePickerProps {
  startDate?: string | null;
  endDate?: string | null;
  onChange?: (range: { startDate: string | null; endDate: string | null }) => void;
  label?: string;
  size?: "small" | "medium";
  disabled?: boolean;
  inline?: boolean;
  autoApply?: boolean;
}

const PRESETS: Array<{ label: string; getRange: () => [Dayjs, Dayjs] }> = [
  { label: "Today", getRange: () => [dayjs(), dayjs()] },
  { label: "Yesterday", getRange: () => [dayjs().subtract(1, "day"), dayjs().subtract(1, "day")] },
  { label: "Last 7 Days", getRange: () => [dayjs().subtract(6, "day"), dayjs()] },
  { label: "This Month", getRange: () => [dayjs().startOf("month"), dayjs().endOf("month")] },
  {
    label: "Last Month",
    getRange: () => [
      dayjs().subtract(1, "month").startOf("month"),
      dayjs().subtract(1, "month").endOf("month"),
    ],
  },
  {
    label: "This Quarter",
    getRange: () => {
      const q = Math.floor(dayjs().month() / 3);
      const start = dayjs().month(q * 3).startOf("month");
      const end = dayjs().month(q * 3 + 2).endOf("month");
      return [start, end];
    },
  },
  { label: "This Year", getRange: () => [dayjs().startOf("year"), dayjs().endOf("year")] },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  label = "Date Range",
  size = "small",
  disabled = false,
  inline = false,
  autoApply = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [currentViewMonth, setCurrentViewMonth] = useState<Dayjs>(() =>
    startDate ? dayjs(startDate) : dayjs()
  );

  // Temporary selection state
  const [tempStart, setTempStart] = useState<Dayjs | null>(() =>
    startDate ? dayjs(startDate) : null
  );
  const [tempEnd, setTempEnd] = useState<Dayjs | null>(() =>
    endDate ? dayjs(endDate) : null
  );
  const [selectingEnd, setSelectingEnd] = useState<boolean>(false);

  // Keep internal selection synchronized with incoming props
  useEffect(() => {
    if (startDate) {
      setTempStart(dayjs(startDate));
      setCurrentViewMonth(dayjs(startDate));
    } else {
      setTempStart(null);
    }
    if (endDate) {
      setTempEnd(dayjs(endDate));
    } else {
      setTempEnd(null);
    }
    setSelectingEnd(false);
  }, [startDate, endDate]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setTempStart(startDate ? dayjs(startDate) : null);
    setTempEnd(endDate ? dayjs(endDate) : null);
    setSelectingEnd(false);
    setCurrentViewMonth(startDate ? dayjs(startDate) : dayjs());
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handlePrevMonth = () => {
    setCurrentViewMonth((prev) => prev.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setCurrentViewMonth((prev) => prev.add(1, "month"));
  };

  const handleDateClick = (clickedDate: Dayjs) => {
    // If user clicked a date from an adjacent month, navigate to that month
    if (!clickedDate.isSame(currentViewMonth, "month")) {
      setCurrentViewMonth(clickedDate.startOf("month"));
    }

    if (!selectingEnd || !tempStart) {
      // Pick start date
      setTempStart(clickedDate);
      setTempEnd(null);
      setSelectingEnd(true);

      if (autoApply && onChange) {
        onChange({
          startDate: clickedDate.format("YYYY-MM-DD"),
          endDate: clickedDate.format("YYYY-MM-DD"),
        });
      }
    } else {
      // Pick end date
      let finalStart = tempStart;
      let finalEnd = clickedDate;

      if (clickedDate.isBefore(tempStart, "day")) {
        finalStart = clickedDate;
        finalEnd = tempStart;
      }

      setTempStart(finalStart);
      setTempEnd(finalEnd);
      setSelectingEnd(false);

      if (onChange) {
        onChange({
          startDate: finalStart.format("YYYY-MM-DD"),
          endDate: finalEnd.format("YYYY-MM-DD"),
        });
      }

      if (!inline) {
        handleClose();
      }
    }
  };

  const handleApply = () => {
    if (onChange && tempStart) {
      const finalEnd = tempEnd || tempStart;
      onChange({
        startDate: tempStart.format("YYYY-MM-DD"),
        endDate: finalEnd.format("YYYY-MM-DD"),
      });
    }
    if (!inline) {
      handleClose();
    }
  };

  const handleClear = () => {
    setTempStart(null);
    setTempEnd(null);
    setSelectingEnd(false);
    if (onChange) {
      onChange({ startDate: null, endDate: null });
    }
    if (!inline) {
      handleClose();
    }
  };

  const handlePresetClick = (getRange: () => [Dayjs, Dayjs]) => {
    const [start, end] = getRange();
    setTempStart(start);
    setTempEnd(end);
    setSelectingEnd(false);
    setCurrentViewMonth(start);
    if (onChange) {
      onChange({
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
      });
    }
    if (!inline) {
      handleClose();
    }
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const startOfMonth = currentViewMonth.startOf("month");
    const endOfMonth = currentViewMonth.endOf("month");
    const daysInMonth = currentViewMonth.daysInMonth();

    // Monday as day 0 in ISO week
    let firstDayOfWeek = startOfMonth.day() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6;

    const days: Array<{ dayNumber: number; date: Dayjs; isCurrentMonth: boolean }> = [];

    // Leading padding from prev month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = startOfMonth.subtract(i + 1, "day");
      days.push({ dayNumber: prevDate.date(), date: prevDate, isCurrentMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = currentViewMonth.date(i);
      days.push({ dayNumber: i, date, isCurrentMonth: true });
    }

    // Trailing padding to fill complete grid of 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = endOfMonth.add(i, "day");
      days.push({ dayNumber: nextDate.date(), date: nextDate, isCurrentMonth: false });
    }

    return days;
  }, [currentViewMonth]);

  // Formatted trigger label
  const displayLabel = useMemo(() => {
    if (startDate && endDate) {
      const s = dayjs(startDate);
      const e = dayjs(endDate);
      if (startDate === endDate) {
        return s.format("DD MMM YYYY");
      }
      return `${s.format("DD MMM YYYY")} – ${e.format("DD MMM YYYY")}`;
    }
    if (startDate) {
      return `From ${dayjs(startDate).format("DD MMM YYYY")}`;
    }
    return label;
  }, [startDate, endDate, label]);

  // Main Calendar Body View
  const calendarContent = (
    <Box sx={{ display: "flex", gap: 2, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
      {/* Quick Presets Panel */}
      <Box sx={{ width: 130, borderRight: "1px solid", borderColor: "divider", pr: 2 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", mb: 1, display: "block" }}>
          QUICK PRESETS
        </Typography>
        <Stack spacing={0.6}>
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="small"
              variant="text"
              onClick={() => handlePresetClick(p.getRange)}
              sx={{
                justifyContent: "flex-start",
                fontSize: "0.78rem",
                fontWeight: 500,
                textTransform: "none",
                py: 0.4,
                px: 1,
                borderRadius: radiusTokens.sm,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {p.label}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* Calendar Month View */}
      <Box sx={{ flexGrow: 1, minWidth: 260 }}>
        {/* Month Header and Navigation */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <IconButton size="small" onClick={handlePrevMonth} title="Previous Month">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {currentViewMonth.format("MMMM YYYY")}
          </Typography>
          <IconButton size="small" onClick={handleNextMonth} title="Next Month">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Days of Week Header */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", mb: 1 }}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <Typography key={d} variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
              {d}
            </Typography>
          ))}
        </Box>

        {/* Calendar Days Grid */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
          {calendarDays.map(({ dayNumber, date, isCurrentMonth }, idx) => {
            const isSelectedStart = tempStart && date.isSame(tempStart, "day");
            const isSelectedEnd = tempEnd && date.isSame(tempEnd, "day");
            const isInRange =
              tempStart && tempEnd && date.isAfter(tempStart, "day") && date.isBefore(tempEnd, "day");

            let bgColor = "transparent";
            let textColor: string = isCurrentMonth ? colorTokens.text.primary : colorTokens.text.muted;
            let borderRadius = radiusTokens.sm;

            if (isSelectedStart || isSelectedEnd) {
              bgColor = colorTokens.primary.main;
              textColor = colorTokens.text.inverse;
            } else if (isInRange) {
              bgColor = "rgba(2, 132, 199, 0.12)";
              textColor = colorTokens.primary.darker;
            }

            return (
              <Box
                key={idx}
                onClick={() => handleDateClick(date)}
                sx={{
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  bgcolor: bgColor,
                  color: textColor,
                  borderRadius: borderRadius,
                  fontWeight: isSelectedStart || isSelectedEnd ? 700 : isCurrentMonth ? 500 : 400,
                  fontSize: "0.82rem",
                  transition: "all 0.1s ease",
                  userSelect: "none",
                  "&:hover": {
                    bgcolor: isSelectedStart || isSelectedEnd ? colorTokens.primary.main : "action.hover",
                    outline: !isSelectedStart && !isSelectedEnd ? `1px solid ${colorTokens.primary.light}` : "none",
                  },
                }}
              >
                {dayNumber}
              </Box>
            );
          })}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Selected Range Display and Action Buttons */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Box>
            {tempStart ? (
              <Chip
                size="small"
                variant="outlined"
                label={
                  tempEnd
                    ? `${tempStart.format("DD MMM YYYY")} – ${tempEnd.format("DD MMM YYYY")}`
                    : `Start: ${tempStart.format("DD MMM YYYY")}`
                }
                sx={{ fontSize: "0.75rem", fontWeight: 600, color: colorTokens.primary.main }}
              />
            ) : (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Click a date to select
              </Typography>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" color="inherit" onClick={handleClear} sx={{ textTransform: "none" }}>
              Clear
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleApply}
              disabled={!tempStart}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Apply
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  // If inline, render content directly
  if (inline) {
    return (
      <Box
        sx={{
          p: 1.5,
          borderRadius: radiusTokens.md,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#FFFFFF",
        }}
      >
        {calendarContent}
      </Box>
    );
  }

  // Otherwise render trigger button with popover
  return (
    <>
      <Button
        variant="outlined"
        size={size}
        disabled={disabled}
        onClick={handleClick}
        startIcon={<CalendarTodayIcon fontSize="small" />}
        sx={{
          borderRadius: radiusTokens.md,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.82rem",
          borderColor: colorTokens.workspace.border,
          color: colorTokens.text.primary,
          bgcolor: "#FFFFFF",
          "&:hover": {
            bgcolor: "action.hover",
            borderColor: "primary.main",
          },
        }}
      >
        {displayLabel}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            p: 2,
            borderRadius: radiusTokens.md,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: 460,
          },
        }}
      >
        {calendarContent}
      </Popover>
    </>
  );
};
