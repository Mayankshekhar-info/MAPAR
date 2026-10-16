import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StarIcon from "@mui/icons-material/Star";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { SlideKPICard } from "../types/slide.types";

interface SlideMetricCardProps {
  kpi: SlideKPICard;
  onClick: (id: number) => void;
}

export const SlideMetricCard: React.FC<SlideMetricCardProps> = ({ kpi, onClick }) => {
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

  const ragStyle = getRagColors(kpi.rag_status);

  const renderTrendIcon = () => {
    if (kpi.trend === "UP") return <TrendingUpIcon sx={{ fontSize: 16, color: colorTokens.status.success.main }} />;
    if (kpi.trend === "DOWN") return <TrendingDownIcon sx={{ fontSize: 16, color: colorTokens.status.error.main }} />;
    return <TrendingFlatIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
  };

  return (
    <Card
      onClick={() => onClick(kpi.id)}
      sx={{
        p: 2.25,
        cursor: "pointer",
        borderRadius: radiusTokens.lg,
        border: `1px solid ${colorTokens.workspace.border}`,
        borderTop: `4px solid ${ragStyle.main}`,
        boxShadow: shadowTokens.subtle,
        bgcolor: "#FFFFFF",
        transition: "all 0.2s ease-in-out",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: shadowTokens.cardHover,
          borderColor: colorTokens.primary.main,
          borderTop: `4px solid ${ragStyle.main}`,
        },
      }}
    >
      {/* Top Header: Code, Name, Executive Badge */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label={kpi.code}
              size="small"
              sx={{
                bgcolor: colorTokens.workspace.background,
                color: colorTokens.text.primary,
                fontWeight: 700,
                fontSize: "0.72rem",
                borderRadius: radiusTokens.xs,
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            />
            {kpi.is_executive && (
              <Tooltip title="Executive Tier KPI">
                <StarIcon sx={{ fontSize: 15, color: "#EAB308" }} />
              </Tooltip>
            )}
          </Box>
          <Chip
            label={kpi.rag_status}
            size="small"
            sx={{
              bgcolor: ragStyle.light,
              color: ragStyle.text,
              border: `1px solid ${ragStyle.border}`,
              fontWeight: 700,
              fontSize: "0.7rem",
              borderRadius: radiusTokens.sm,
            }}
          />
        </Box>

        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            color: colorTokens.text.primary,
            fontSize: "0.95rem",
            lineHeight: 1.35,
            mb: 0.5,
          }}
        >
          {kpi.name}
        </Typography>

        {kpi.definition && (
          <Typography
            variant="caption"
            sx={{
              color: colorTokens.text.secondary,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
              mb: 1.5,
            }}
          >
            {kpi.definition}
          </Typography>
        )}
      </Box>

      {/* Metric Numbers Grid */}
      <Box sx={{ mt: "auto" }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: radiusTokens.md,
            bgcolor: colorTokens.workspace.background,
            border: `1px solid ${colorTokens.workspace.borderSubtle}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, display: "block" }}>
              TARGET
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
              {formatNumber(kpi.target_value)} {kpi.unit}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, display: "block" }}>
              ACTUAL
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: ragStyle.text }}>
              {formatNumber(kpi.actual_value)} {kpi.unit}
            </Typography>
          </Box>
        </Box>

        {/* Achievement & Variance Footer */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {renderTrendIcon()}
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary }}>
              {kpi.achievement_percentage}% Achieved
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: kpi.variance >= 0 ? colorTokens.status.success.text : colorTokens.status.error.text,
              }}
            >
              Var: {kpi.variance > 0 ? `+${formatNumber(kpi.variance)}` : formatNumber(kpi.variance)}
            </Typography>
            <Tooltip title="Click to view full record audit & deep metadata">
              <InfoOutlinedIcon sx={{ fontSize: 14, color: colorTokens.text.muted }} />
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Card>
  );
};
