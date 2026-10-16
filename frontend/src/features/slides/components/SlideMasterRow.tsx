import React from "react";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { SlideMasterRowData } from "../types/slide.types";

interface SlideMasterRowProps {
  row: SlideMasterRowData;
  onClick: (row: SlideMasterRowData) => void;
}

export const SlideMasterRow: React.FC<SlideMasterRowProps> = ({ row, onClick }) => {
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null || isNaN(num)) return "0.0";
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num);
  };

  const getRagColors = (rag: "GREEN" | "AMBER" | "RED") => {
    switch (rag) {
      case "GREEN":
        return colorTokens.status.success;
      case "AMBER":
        return colorTokens.status.warning;
      case "RED":
        return colorTokens.status.error;
      default:
        return colorTokens.status.neutral;
    }
  };

  const renderTrendIcon = (trend?: "UP" | "DOWN" | "FLAT") => {
    if (trend === "UP") return <TrendingUpIcon sx={{ fontSize: 16, color: colorTokens.status.success.main }} />;
    if (trend === "DOWN") return <TrendingDownIcon sx={{ fontSize: 16, color: colorTokens.status.error.main }} />;
    return <TrendingFlatIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />;
  };

  // 1. Subtotal Row Rendering
  if (row.row_type === "subtotal") {
    const ragStyle = getRagColors(row.rag_status);
    return (
      <TableRow
        sx={{
          bgcolor: "#F0F9FF",
          borderLeft: `4px solid ${colorTokens.primary.main}`,
          borderTop: `1.5px solid #BAE6FD`,
          borderBottom: `2px solid #7DD3FC`,
          transition: "background-color 0.15s ease",
          "&:hover": {
            bgcolor: "#E0F2FE",
          },
          "& td": { py: 1.5 },
        }}
      >
        <TableCell colSpan={3}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.primary.darker, letterSpacing: "0.01em" }}>
              {row.circle_name}
            </Typography>
            <Chip
              label={`${row.record_count} items`}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 800,
                bgcolor: "#E0F2FE",
                color: colorTokens.primary.darker,
                border: "1px solid #7DD3FC",
              }}
            />
          </Box>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.85rem" }}>
            {formatNumber(row.required)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "0.85rem" }}>
            {formatNumber(row.available)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              fontSize: "0.85rem",
              color: row.gap > 0 ? colorTokens.status.error.text : colorTokens.status.success.text,
            }}
          >
            {formatNumber(row.gap)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" sx={{ fontWeight: 800, color: ragStyle.text, fontSize: "0.85rem" }}>
            {formatNumber(row.achievement_percentage)}%
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={row.rag_status}
            size="small"
            sx={{
              bgcolor: ragStyle.light,
              color: ragStyle.text,
              border: `1px solid ${ragStyle.border}`,
              fontWeight: 800,
              fontSize: "0.68rem",
              borderRadius: radiusTokens.xs,
            }}
          />
        </TableCell>
        <TableCell align="center">—</TableCell>
      </TableRow>
    );
  }

  // 2. Grand Total Row Rendering
  if (row.row_type === "grand_total") {
    const ragStyle = getRagColors(row.rag_status);
    return (
      <TableRow
        sx={{
          bgcolor: colorTokens.nav.surface,
          color: "#FFFFFF",
          "& td": { py: 2, borderColor: colorTokens.nav.border },
        }}
      >
        <TableCell colSpan={3}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.03em" }}>
              {row.circle_name}
            </Typography>
            <Chip
              label={`${row.record_count} TOTAL RECORDS`}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 800,
                bgcolor: "rgba(255, 255, 255, 0.15)",
                color: "#FFFFFF",
              }}
            />
          </Box>
        </TableCell>
        <TableCell align="right">
          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#FFFFFF" }}>
            {formatNumber(row.required)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#FFFFFF" }}>
            {formatNumber(row.available)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 900,
              color: row.gap > 0 ? "#FCA5A5" : "#86EFAC",
            }}
          >
            {formatNumber(row.gap)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#38BDF8" }}>
            {formatNumber(row.achievement_percentage)}%
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={row.rag_status}
            size="small"
            sx={{
              bgcolor: ragStyle.main,
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "0.72rem",
              borderRadius: radiusTokens.xs,
            }}
          />
        </TableCell>
        <TableCell align="center">—</TableCell>
      </TableRow>
    );
  }

  // 3. Clickable Data Row Rendering
  const ragStyle = getRagColors(row.rag_status);

  return (
    <TableRow
      hover
      tabIndex={0}
      role="button"
      aria-label={`Inspect detail for ${row.resource_name} in ${row.circle_name}`}
      onClick={() => onClick(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(row);
        }
      }}
      sx={{
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          bgcolor: colorTokens.workspace.borderSubtle,
          "& .inspect-chevron": {
            color: colorTokens.primary.main,
            transform: "translateX(3px)",
          },
        },
        "&:focus-visible": {
          outline: `2px solid ${colorTokens.primary.main}`,
          bgcolor: colorTokens.primary.lighter,
        },
      }}
    >
      {/* Circle / Organizational Unit */}
      <TableCell>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            {row.circle_name}
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontSize: "0.72rem" }}>
            {row.region} Region • {row.circle_code}
          </Typography>
        </Box>
      </TableCell>

      {/* Domain */}
      <TableCell>
        <Chip
          label={row.domain_name}
          size="small"
          sx={{
            bgcolor: colorTokens.workspace.background,
            color: colorTokens.text.secondary,
            fontWeight: 600,
            fontSize: "0.73rem",
            borderRadius: radiusTokens.sm,
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        />
      </TableCell>

      {/* Resource / Operation Metric */}
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={row.resource_code}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.68rem",
              fontWeight: 700,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.darker,
              borderRadius: radiusTokens.xs,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
            {row.resource_name}
          </Typography>
        </Box>
      </TableCell>

      {/* Required (Target) */}
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
          {formatNumber(row.required)} {row.unit}
        </Typography>
      </TableCell>

      {/* Available (Actual) */}
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 700, color: ragStyle.text }}>
          {formatNumber(row.available)} {row.unit}
        </Typography>
      </TableCell>

      {/* Gap (Required - Available) */}
      <TableCell align="right">
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: row.gap > 0 ? colorTokens.status.error.text : colorTokens.status.success.text,
          }}
        >
          {formatNumber(row.gap)}
        </Typography>
      </TableCell>

      {/* Achievement % */}
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
          {formatNumber(row.achievement_percentage)}%
        </Typography>
      </TableCell>

      {/* RAG Status */}
      <TableCell align="center">
        <Chip
          label={row.rag_status}
          size="small"
          sx={{
            bgcolor: ragStyle.light,
            color: ragStyle.text,
            border: `1px solid ${ragStyle.border}`,
            fontWeight: 800,
            fontSize: "0.68rem",
            borderRadius: radiusTokens.sm,
          }}
        />
      </TableCell>

      {/* Action / Inspect Indicator */}
      <TableCell align="center">
        <Tooltip title="Click to open deep detail page">
          <Box sx={{ display: "inline-flex", alignItems: "center" }}>
            {renderTrendIcon(row.trend)}
            <ChevronRightIcon
              className="inspect-chevron"
              sx={{
                fontSize: 18,
                color: colorTokens.text.muted,
                transition: "all 0.2s ease",
                ml: 0.5,
              }}
            />
          </Box>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};
