import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import ClearAllIcon from "@mui/icons-material/ClearAll";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceFilterParams, GovernanceMetadata } from "../types/governance.types";

interface GovernanceActiveFiltersBarProps {
  filters: GovernanceFilterParams;
  metadata?: GovernanceMetadata;
  onFilterChange: (newFilters: Partial<GovernanceFilterParams>) => void;
  onClearAll: () => void;
}

export const GovernanceActiveFiltersBar: React.FC<GovernanceActiveFiltersBarProps> = ({
  filters,
  metadata,
  onFilterChange,
  onClearAll,
}) => {
  const activeChips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  // Circle
  if (filters.circle_id) {
    const c = metadata?.circles?.find((circle) => circle.id === filters.circle_id);
    const circleLabel = c ? `${c.name} (${c.code})` : `Circle #${filters.circle_id}`;
    activeChips.push({
      id: "circle",
      label: `Circle: ${circleLabel}`,
      onRemove: () => onFilterChange({ circle_id: undefined }),
    });
  }

  // Owner
  if (filters.owner_id) {
    const u = metadata?.users?.find((user) => user.id === filters.owner_id);
    const ownerLabel = u ? `${u.full_name || u.username}` : `Owner #${filters.owner_id}`;
    activeChips.push({
      id: "owner",
      label: `Owner: ${ownerLabel}`,
      onRemove: () => onFilterChange({ owner_id: undefined }),
    });
  }

  // Status
  if (filters.status && filters.status !== "ALL") {
    activeChips.push({
      id: "status",
      label: `Status: ${filters.status}`,
      onRemove: () => onFilterChange({ status: undefined }),
    });
  }

  // Overdue
  if (filters.is_overdue) {
    activeChips.push({
      id: "overdue",
      label: "Overdue Actions Only",
      onRemove: () => onFilterChange({ is_overdue: undefined }),
    });
  }

  // Due Soon
  if (filters.is_due_soon) {
    activeChips.push({
      id: "due_soon",
      label: "Due in Next 7 Days",
      onRemove: () => onFilterChange({ is_due_soon: undefined }),
    });
  }

  // Evidence Status
  if (filters.evidence_status && filters.evidence_status !== "ALL") {
    activeChips.push({
      id: "evidence_status",
      label: `Evidence: ${filters.evidence_status}`,
      onRemove: () => onFilterChange({ evidence_status: undefined }),
    });
  }

  // Priority
  if (filters.priority && filters.priority !== "ALL") {
    activeChips.push({
      id: "priority",
      label: `Priority: ${filters.priority}`,
      onRemove: () => onFilterChange({ priority: undefined }),
    });
  }

  // Ageing Bucket
  if (filters.ageing_bucket && filters.ageing_bucket !== "ALL") {
    activeChips.push({
      id: "bucket",
      label: `Ageing: ${filters.ageing_bucket}`,
      onRemove: () => onFilterChange({ ageing_bucket: undefined }),
    });
  }

  // Reporting Week
  if (filters.reporting_week && filters.reporting_week !== "ALL") {
    activeChips.push({
      id: "week",
      label: `Week: ${filters.reporting_week}`,
      onRemove: () => onFilterChange({ reporting_week: undefined }),
    });
  }

  // Search
  if (filters.search) {
    activeChips.push({
      id: "search",
      label: `Search: "${filters.search}"`,
      onRemove: () => onFilterChange({ search: "" }),
    });
  }

  if (activeChips.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
        p: 1.25,
        mb: 2.5,
        borderRadius: radiusTokens.md,
        border: "1px solid #BAE6FD",
        backgroundColor: "#F0F9FF",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 0.5 }}>
        <FilterAltOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
        <Typography variant="caption" sx={{ fontWeight: 800, color: colorTokens.primary.dark, fontSize: "0.75rem" }}>
          Active Filters ({activeChips.length}):
        </Typography>
      </Box>

      {activeChips.map((chip) => (
        <Chip
          key={chip.id}
          label={chip.label}
          size="small"
          onDelete={chip.onRemove}
          sx={{
            height: 24,
            fontSize: "0.72rem",
            fontWeight: 700,
            backgroundColor: "#FFFFFF",
            color: colorTokens.text.primary,
            border: "1px solid #BAE6FD",
            "& .MuiChip-deleteIcon": {
              color: colorTokens.text.secondary,
              fontSize: 16,
              "&:hover": { color: colorTokens.status.error.main },
            },
          }}
        />
      ))}

      <Button
        size="small"
        startIcon={<ClearAllIcon sx={{ fontSize: "14px !important" }} />}
        onClick={onClearAll}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          fontSize: "0.72rem",
          color: colorTokens.status.error.main,
          py: 0.2,
          px: 1,
          ml: "auto",
          minWidth: "auto",
          "&:hover": { backgroundColor: "#FEE2E2" },
        }}
      >
        Clear All Filters
      </Button>
    </Box>
  );
};
