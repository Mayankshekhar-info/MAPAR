import React, { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import CheckIcon from "@mui/icons-material/Check";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

export interface PeriodSelection {
  reporting_week?: string;
  start_date?: string;
  end_date?: string;
}

interface GovernancePeriodControlProps {
  currentReportingWeek?: string;
  asOfDate?: string;
  selectedWeek?: string;
  availableWeeks?: string[];
  onChangePeriod: (period: PeriodSelection) => void;
}

export const GovernancePeriodControl: React.FC<GovernancePeriodControlProps> = ({
  currentReportingWeek,
  asOfDate,
  selectedWeek,
  availableWeeks = [],
  onChangePeriod,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Use reporting weeks available in imported data
  const weekList = useMemo(() => {
    if (!availableWeeks || availableWeeks.length === 0) {
      if (currentReportingWeek && currentReportingWeek.trim()) {
        return [{ label: currentReportingWeek, value: currentReportingWeek }];
      }
      return [];
    }
    return availableWeeks.map((w, idx) => ({
      label: idx === 0 ? `${w} (Latest)` : w,
      value: w,
      isLatest: idx === 0,
    }));
  }, [availableWeeks, currentReportingWeek]);

  const activeWeekObj = weekList.find(
    (w) => w.value.toLowerCase() === (selectedWeek || "").toLowerCase()
  );
  const activeLabel = activeWeekObj
    ? activeWeekObj.value
    : selectedWeek
    ? selectedWeek
    : "All Periods";

  // Step prev / next week
  const handleStepWeek = (direction: -1 | 1) => {
    if (weekList.length === 0) return;

    if (!selectedWeek) {
      // Jump to latest week
      onChangePeriod({ reporting_week: weekList[0].value });
      return;
    }

    const currentIndex = weekList.findIndex(
      (w) => w.value.toLowerCase() === selectedWeek.toLowerCase()
    );
    if (currentIndex !== -1) {
      const nextIndex = currentIndex + direction; // direction: +1 is older (higher index), -1 is newer (lower index)
      if (nextIndex >= 0 && nextIndex < weekList.length) {
        onChangePeriod({ reporting_week: weekList[nextIndex].value });
      }
    } else {
      onChangePeriod({ reporting_week: weekList[0].value });
    }
  };

  const isOldestSelected =
    Boolean(selectedWeek) &&
    weekList.length > 0 &&
    weekList[weekList.length - 1].value.toLowerCase() === (selectedWeek || "").toLowerCase();
  const isNewestSelected =
    Boolean(selectedWeek) &&
    weekList.length > 0 &&
    weekList[0].value.toLowerCase() === (selectedWeek || "").toLowerCase();

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        p: 0.5,
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        backgroundColor: colorTokens.workspace.surface,
        gap: 0.5,
      }}
    >
      {/* Older Week (<) */}
      <Tooltip title="Older reporting week" arrow>
        <span>
          <IconButton
            size="small"
            onClick={() => handleStepWeek(1)}
            disabled={weekList.length === 0 || isOldestSelected}
            sx={{
              p: 0.5,
              color: colorTokens.text.secondary,
              "&:hover": { backgroundColor: "#F1F5F9" },
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* Week Selector Dropdown Button */}
      <Button
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16, color: colorTokens.primary.main }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          fontSize: "0.78rem",
          color: colorTokens.text.primary,
          py: 0.4,
          px: 1,
          borderRadius: radiusTokens.sm,
          backgroundColor: selectedWeek ? "#F0F9FF" : "transparent",
          "&:hover": { backgroundColor: "#F1F5F9" },
        }}
      >
        {activeLabel}
      </Button>

      {/* Newer Week (>) */}
      <Tooltip title="Newer reporting week" arrow>
        <span>
          <IconButton
            size="small"
            onClick={() => handleStepWeek(-1)}
            disabled={weekList.length === 0 || isNewestSelected}
            sx={{
              p: 0.5,
              color: colorTokens.text.secondary,
              "&:hover": { backgroundColor: "#F1F5F9" },
            }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* As of Date Badge */}
      <Box sx={{ pl: 0.5, borderLeft: "1px solid #E2E8F0" }}>
        <Chip
          label={`As of: ${asOfDate || "Today"}`}
          size="small"
          sx={{
            height: 22,
            fontSize: "0.7rem",
            fontWeight: 600,
            backgroundColor: "#F8FAFC",
            color: colorTokens.text.muted,
          }}
        />
      </Box>

      {/* Clear Filter Button if a specific week is active */}
      {selectedWeek && (
        <Tooltip title="Show All Periods" arrow>
          <Chip
            label="All"
            size="small"
            onClick={() => onChangePeriod({ reporting_week: undefined })}
            onDelete={() => onChangePeriod({ reporting_week: undefined })}
            sx={{
              height: 22,
              fontSize: "0.68rem",
              fontWeight: 700,
              backgroundColor: "#EFF6FF",
              color: colorTokens.primary.main,
            }}
          />
        </Tooltip>
      )}

      {/* Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 0.5,
            borderRadius: radiusTokens.md,
            border: `1px solid ${colorTokens.workspace.border}`,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
            minWidth: 220,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            onChangePeriod({ reporting_week: undefined });
            setAnchorEl(null);
          }}
          selected={!selectedWeek}
          sx={{ fontSize: "0.78rem", fontWeight: !selectedWeek ? 800 : 500 }}
        >
          <EventRepeatIcon sx={{ fontSize: 16, mr: 1, color: colorTokens.text.muted }} />
          All Periods (Full Portfolio)
          {!selectedWeek && <CheckIcon sx={{ fontSize: 16, ml: "auto", color: colorTokens.primary.main }} />}
        </MenuItem>

        {weekList.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: "0.78rem", fontStyle: "italic", color: colorTokens.text.muted }}>
            No reporting weeks in uploaded data
          </MenuItem>
        ) : (
          weekList.map((w) => {
            const isSelected =
              Boolean(selectedWeek) && selectedWeek?.toLowerCase() === w.value.toLowerCase();
            return (
              <MenuItem
                key={w.value}
                onClick={() => {
                  onChangePeriod({ reporting_week: w.value });
                  setAnchorEl(null);
                }}
                selected={isSelected}
                sx={{ fontSize: "0.78rem", fontWeight: isSelected ? 800 : 500 }}
              >
                <CalendarMonthOutlinedIcon sx={{ fontSize: 16, mr: 1, color: colorTokens.primary.main }} />
                {w.label}
                {isSelected && (
                  <CheckIcon sx={{ fontSize: 16, ml: "auto", color: colorTokens.primary.main }} />
                )}
              </MenuItem>
            );
          })
        )}
      </Menu>
    </Box>
  );
};
