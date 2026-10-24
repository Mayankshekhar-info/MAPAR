import React, { useState, useMemo, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import DateRangeIcon from "@mui/icons-material/DateRange";
import dayjs, { Dayjs } from "dayjs";

import { colorTokens, radiusTokens } from "../../app/theme/tokens";
import { ReportingFrequency, ReportingPeriod } from "../../types/period.types";
import { useReportingPeriod } from "../../hooks/useReportingPeriod";

export interface PeriodSelectorProps {
  selectedPeriodId?: number | null;
  onPeriodSelect?: (period: ReportingPeriod) => void;
  onRangeChange?: (range: { startDate: string | null; endDate: string | null }) => void;
  size?: "small" | "medium";
  disabled?: boolean;
  label?: string;
  fullWidth?: boolean;
}

const FREQUENCY_TABS: Array<{ label: string; value: ReportingFrequency }> = [
  { label: "Monthly", value: "MONTHLY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Quarterly", value: "QUARTERLY" },
  { label: "Yearly", value: "YEARLY" },
  { label: "Custom Range", value: "CUSTOM" },
];

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

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriodId,
  onPeriodSelect,
  onRangeChange,
  size = "small",
  disabled = false,
  label = "Reporting Period",
  fullWidth = false,
}) => {
  const { periods, currentPeriod, isLoading, resolvePeriod, isResolving } = useReportingPeriod();

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [activeFrequency, setActiveFrequency] = useState<ReportingFrequency>("MONTHLY");

  // Determine the active period object
  const activePeriod = useMemo(() => {
    if (selectedPeriodId) {
      const found = periods.find((p) => p.id === selectedPeriodId);
      if (found) return found;
    }
    return currentPeriod || (periods.length > 0 ? periods[0] : null);
  }, [selectedPeriodId, periods, currentPeriod]);

  // Calendar month view state
  const [currentViewMonth, setCurrentViewMonth] = useState<Dayjs>(() =>
    activePeriod?.start_date ? dayjs(activePeriod.start_date) : dayjs()
  );

  // Temporary selection state for custom picking
  const [tempStart, setTempStart] = useState<Dayjs | null>(() =>
    activePeriod?.start_date ? dayjs(activePeriod.start_date) : null
  );
  const [tempEnd, setTempEnd] = useState<Dayjs | null>(() =>
    activePeriod?.end_date ? dayjs(activePeriod.end_date) : null
  );
  const [selectingEnd, setSelectingEnd] = useState<boolean>(false);

  // Sync active frequency with active period type on load
  useEffect(() => {
    if (activePeriod && activePeriod.period_type) {
      const pType = activePeriod.period_type.toUpperCase() as ReportingFrequency;
      if (FREQUENCY_TABS.some((t) => t.value === pType)) {
        setActiveFrequency(pType);
      }
    }
    if (activePeriod?.start_date) {
      setCurrentViewMonth(dayjs(activePeriod.start_date));
      setTempStart(dayjs(activePeriod.start_date));
      setTempEnd(dayjs(activePeriod.end_date));
    }
  }, [activePeriod]);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (activePeriod?.start_date) {
      setTempStart(dayjs(activePeriod.start_date));
      setTempEnd(dayjs(activePeriod.end_date));
      setCurrentViewMonth(dayjs(activePeriod.start_date));
    } else {
      setTempStart(null);
      setTempEnd(null);
      setCurrentViewMonth(dayjs());
    }
    setSelectingEnd(false);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const isOpen = Boolean(anchorEl);

  // Filter periods by the currently selected frequency tab
  const filteredPeriods = useMemo(() => {
    if (activeFrequency === "CUSTOM") {
      return periods.filter((p) => p.period_type === "CUSTOM");
    }
    return periods.filter((p) => p.period_type === activeFrequency);
  }, [periods, activeFrequency]);

  // Find index of active period within current frequency group
  const activeIndex = useMemo(() => {
    if (!activePeriod) return -1;
    return filteredPeriods.findIndex((p) => p.id === activePeriod.id);
  }, [filteredPeriods, activePeriod]);

  // Handle cycle navigation (< and >)
  const handlePrevPeriod = () => {
    if (activeIndex > 0 && onPeriodSelect) {
      const prev = filteredPeriods[activeIndex - 1];
      onPeriodSelect(prev);
      if (onRangeChange) {
        onRangeChange({ startDate: prev.start_date, endDate: prev.end_date });
      }
    }
  };

  const handleNextPeriod = () => {
    if (activeIndex >= 0 && activeIndex < filteredPeriods.length - 1 && onPeriodSelect) {
      const next = filteredPeriods[activeIndex + 1];
      onPeriodSelect(next);
      if (onRangeChange) {
        onRangeChange({ startDate: next.start_date, endDate: next.end_date });
      }
    }
  };

  // Select standard period
  const handleSelectPeriod = (period: ReportingPeriod) => {
    if (onPeriodSelect) {
      onPeriodSelect(period);
    }
    if (onRangeChange) {
      onRangeChange({ startDate: period.start_date, endDate: period.end_date });
    }
    setTempStart(dayjs(period.start_date));
    setTempEnd(dayjs(period.end_date));
    setCurrentViewMonth(dayjs(period.start_date));
    handleClose();
  };

  // Handle custom date range submission
  const handleCustomRangeApply = async (range: { startDate: string | null; endDate: string | null }) => {
    if (!range.startDate) return;
    const end = range.endDate || range.startDate;

    try {
      const resolved = await resolvePeriod({
        period_type: "CUSTOM",
        start_date: range.startDate,
        end_date: end,
      });

      if (resolved && onPeriodSelect) {
        onPeriodSelect(resolved);
      }
      if (onRangeChange) {
        onRangeChange({ startDate: range.startDate, endDate: end });
      }
      handleClose();
    } catch (err) {
      console.error("Failed to resolve custom reporting period:", err);
    }
  };

  // Calendar navigation
  const handlePrevMonth = () => {
    setCurrentViewMonth((prev) => prev.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setCurrentViewMonth((prev) => prev.add(1, "month"));
  };

  // Select the full month currently viewed
  const handleSelectCurrentMonth = async () => {
    const sStr = currentViewMonth.startOf("month").format("YYYY-MM-DD");
    const eStr = currentViewMonth.endOf("month").format("YYYY-MM-DD");

    const existing = periods.find(
      (p) => p.start_date === sStr && p.end_date === eStr
    );
    if (existing) {
      handleSelectPeriod(existing);
    } else {
      await handleCustomRangeApply({ startDate: sStr, endDate: eStr });
    }
  };

  // Calendar date click handler
  const handleDateClick = async (clickedDate: Dayjs) => {
    if (!clickedDate.isSame(currentViewMonth, "month")) {
      setCurrentViewMonth(clickedDate.startOf("month"));
    }

    if (!selectingEnd || !tempStart) {
      setTempStart(clickedDate);
      setTempEnd(null);
      setSelectingEnd(true);
    } else {
      let finalStart = tempStart;
      let finalEnd = clickedDate;

      if (clickedDate.isBefore(tempStart, "day")) {
        finalStart = clickedDate;
        finalEnd = tempStart;
      }

      setTempStart(finalStart);
      setTempEnd(finalEnd);
      setSelectingEnd(false);

      const sStr = finalStart.format("YYYY-MM-DD");
      const eStr = finalEnd.format("YYYY-MM-DD");

      const existing = periods.find(
        (p) => p.start_date === sStr && p.end_date === eStr
      );
      if (existing) {
        handleSelectPeriod(existing);
      } else {
        await handleCustomRangeApply({ startDate: sStr, endDate: eStr });
      }
    }
  };

  // Preset click handler
  const handlePresetClick = async (getRange: () => [Dayjs, Dayjs]) => {
    const [start, end] = getRange();
    setTempStart(start);
    setTempEnd(end);
    setSelectingEnd(false);
    setCurrentViewMonth(start);

    const sStr = start.format("YYYY-MM-DD");
    const eStr = end.format("YYYY-MM-DD");

    const existing = periods.find(
      (p) => p.start_date === sStr && p.end_date === eStr
    );
    if (existing) {
      handleSelectPeriod(existing);
    } else {
      await handleCustomRangeApply({ startDate: sStr, endDate: eStr });
    }
  };

  // Calendar days grid computation
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

  // Display text on main trigger button
  const triggerLabel = useMemo(() => {
    if (isLoading) return "Loading periods...";
    if (activePeriod) {
      const s = dayjs(activePeriod.start_date).format("DD MMM YYYY");
      const e = dayjs(activePeriod.end_date).format("DD MMM YYYY");
      if (activePeriod.period_type === "CUSTOM") {
        return `${s} – ${e}`;
      }
      return activePeriod.name;
    }
    return label;
  }, [isLoading, activePeriod, label]);

  // Determine active highlights for calendar cells
  const activeStart = tempStart || (activePeriod?.start_date ? dayjs(activePeriod.start_date) : null);
  const activeEnd = tempEnd || (activePeriod?.end_date ? dayjs(activePeriod.end_date) : null);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, width: fullWidth ? "100%" : "auto" }}>
      {/* Quick Step Previous Cycle */}
      {filteredPeriods.length > 1 && (
        <IconButton
          size="small"
          onClick={handlePrevPeriod}
          disabled={disabled || activeIndex <= 0}
          title="Previous Period"
          sx={{
            border: `1px solid ${colorTokens.workspace.border}`,
            borderRadius: radiusTokens.md,
            bgcolor: "#FFFFFF",
            p: 0.5,
            width: 32,
            height: 40,
            flexShrink: 0,
            "&:hover": { bgcolor: "action.hover" },
            "&.Mui-disabled": { opacity: 0.4 },
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      )}

      {/* Main Trigger Button */}
      <Button
        variant="outlined"
        size={size}
        disabled={disabled || isLoading}
        onClick={handleOpen}
        startIcon={<CalendarMonthIcon fontSize="small" sx={{ color: colorTokens.primary.main, flexShrink: 0 }} />}
        endIcon={<KeyboardArrowDownIcon fontSize="small" sx={{ color: colorTokens.text.secondary, flexShrink: 0 }} />}
        sx={{
          borderRadius: radiusTokens.md,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.82rem",
          borderColor: colorTokens.workspace.border,
          color: colorTokens.text.primary,
          bgcolor: "#FFFFFF",
          height: 40,
          px: 1.25,
          py: 0,
          justifyContent: "space-between",
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          "&:hover": {
            bgcolor: "action.hover",
            borderColor: "primary.main",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: 600,
              fontSize: "0.82rem",
              color: colorTokens.text.primary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {triggerLabel}
          </Typography>
          {activePeriod?.is_current && (
            <Chip
              label="Current"
              size="small"
              sx={{
                height: 18,
                fontSize: "0.65rem",
                fontWeight: 700,
                bgcolor: "rgba(16, 185, 129, 0.12)",
                color: "#059669",
                borderRadius: radiusTokens.xs,
                flexShrink: 0,
              }}
            />
          )}
        </Box>
      </Button>

      {/* Quick Step Next Cycle */}
      {filteredPeriods.length > 1 && (
        <IconButton
          size="small"
          onClick={handleNextPeriod}
          disabled={disabled || activeIndex === -1 || activeIndex >= filteredPeriods.length - 1}
          title="Next Period"
          sx={{
            border: `1px solid ${colorTokens.workspace.border}`,
            borderRadius: radiusTokens.md,
            bgcolor: "#FFFFFF",
            p: 0.5,
            width: 32,
            height: 40,
            flexShrink: 0,
            "&:hover": { bgcolor: "action.hover" },
            "&.Mui-disabled": { opacity: 0.4 },
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      )}

      {/* Period Selection Popover with Simple Calendar View */}
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            p: 2,
            borderRadius: radiusTokens.md,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            width: { xs: 340, sm: 640 },
            maxWidth: "95vw",
          },
        }}
      >
        {/* Frequency Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs
            value={activeFrequency}
            onChange={(_, val) => setActiveFrequency(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              "& .MuiTab-root": {
                minHeight: 36,
                py: 0.5,
                px: 1.5,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.82rem",
              },
            }}
          >
            {FREQUENCY_TABS.map((tab) => (
              <Tab key={tab.value} label={tab.label} value={tab.value} />
            ))}
          </Tabs>
        </Box>

        {/* Dual-Panel Layout: Presets/Periods on Left, Simple Calendar on Right */}
        <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", sm: "row" } }}>
          {/* Left Panel: Available Periods or Quick Presets */}
          <Box
            sx={{
              width: { xs: "100%", sm: 220 },
              flexShrink: 0,
              borderRight: { sm: "1px solid" },
              borderColor: "divider",
              pr: { sm: 2 },
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                {activeFrequency === "CUSTOM" ? "QUICK PRESETS" : `AVAILABLE ${activeFrequency} PERIODS`}
              </Typography>
              {activeFrequency !== "CUSTOM" && (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {filteredPeriods.length}
                </Typography>
              )}
            </Box>

            {activeFrequency === "CUSTOM" ? (
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
                      py: 0.5,
                      px: 1,
                      borderRadius: radiusTokens.sm,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </Stack>
            ) : filteredPeriods.length === 0 ? (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <DateRangeIcon sx={{ fontSize: 28, color: "text.disabled", mb: 0.5 }} />
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  No pre-configured {activeFrequency.toLowerCase()} periods.
                </Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>
                  Use the calendar to pick dates.
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  maxHeight: 270,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                }}
              >
                {filteredPeriods.map((period) => {
                  const isSelected = activePeriod?.id === period.id;
                  const s = dayjs(period.start_date).format("DD MMM YYYY");
                  const e = dayjs(period.end_date).format("DD MMM YYYY");

                  return (
                    <Box
                      key={period.id}
                      onClick={() => handleSelectPeriod(period)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1,
                        borderRadius: radiusTokens.sm,
                        border: `1px solid ${isSelected ? colorTokens.primary.main : colorTokens.workspace.border}`,
                        bgcolor: isSelected ? "rgba(10, 80, 160, 0.06)" : "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: colorTokens.primary.main,
                          bgcolor: isSelected ? "rgba(10, 80, 160, 0.09)" : "action.hover",
                        },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: "0.8rem",
                              color: isSelected ? colorTokens.primary.main : colorTokens.text.primary,
                            }}
                          >
                            {period.name}
                          </Typography>
                          {period.is_current && (
                            <Chip
                              label="Current"
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: "0.62rem",
                                fontWeight: 700,
                                bgcolor: "rgba(16, 185, 129, 0.12)",
                                color: "#059669",
                              }}
                            />
                          )}
                          {period.is_frozen && (
                            <Chip
                              label="Frozen"
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: "0.62rem",
                                fontWeight: 700,
                                bgcolor: "rgba(100, 116, 139, 0.12)",
                                color: "#475569",
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
                          {s} – {e}
                        </Typography>
                      </Box>

                      {isSelected && (
                        <CheckIcon fontSize="small" sx={{ color: colorTokens.primary.main, ml: 0.5, flexShrink: 0 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          {/* Right Panel: Interactive Simple Calendar Grid */}
          <Box sx={{ flex: 1, minWidth: { sm: 280 } }}>
            {/* Calendar Month Header & Navigation */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
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

              <Button
                size="small"
                variant="outlined"
                onClick={handleSelectCurrentMonth}
                sx={{
                  textTransform: "none",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  py: 0.25,
                  px: 1,
                  borderRadius: radiusTokens.sm,
                }}
              >
                Select Month
              </Button>
            </Box>

            {/* Days of Week Header */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", mb: 1 }}>
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <Typography key={d} variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.75rem" }}>
                  {d}
                </Typography>
              ))}
            </Box>

            {/* Calendar Days Matrix */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
              {calendarDays.map(({ dayNumber, date, isCurrentMonth }, idx) => {
                const isSelectedStart = activeStart && date.isSame(activeStart, "day");
                const isSelectedEnd = activeEnd && date.isSame(activeEnd, "day");
                const isInRange =
                  activeStart && activeEnd && date.isAfter(activeStart, "day") && date.isBefore(activeEnd, "day");
                const isToday = date.isSame(dayjs(), "day");

                let bgColor = "transparent";
                let textColor: string = isCurrentMonth ? colorTokens.text.primary : colorTokens.text.muted;
                let borderRadius = radiusTokens.sm;

                if (isSelectedStart || isSelectedEnd) {
                  bgColor = colorTokens.primary.main;
                  textColor = "#FFFFFF";
                } else if (isInRange) {
                  bgColor = "rgba(10, 80, 160, 0.12)";
                  textColor = colorTokens.primary.darker;
                }

                return (
                  <Box
                    key={idx}
                    onClick={() => handleDateClick(date)}
                    sx={{
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      bgcolor: bgColor,
                      color: textColor,
                      borderRadius: borderRadius,
                      fontWeight: isSelectedStart || isSelectedEnd ? 700 : isCurrentMonth ? 500 : 400,
                      fontSize: "0.8rem",
                      border: isToday && !isSelectedStart && !isSelectedEnd ? `1px solid ${colorTokens.primary.main}` : "none",
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

            {/* Resolving indicator */}
            {isResolving && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                <CircularProgress size={12} />
                <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600 }}>
                  Resolving period...
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Footer info showing current selection details */}
        {activePeriod && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Active: <strong>{activePeriod.name}</strong> ({dayjs(activePeriod.start_date).format("YYYY-MM-DD")} to {dayjs(activePeriod.end_date).format("YYYY-MM-DD")})
              </Typography>
              <Button size="small" onClick={handleClose} sx={{ textTransform: "none", fontWeight: 600 }}>
                Close
              </Button>
            </Box>
          </>
        )}
      </Popover>
    </Box>
  );
};

