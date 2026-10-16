import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import SentimentDissatisfiedOutlinedIcon from "@mui/icons-material/SentimentDissatisfiedOutlined";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { SlideItem } from "../types/slide.types";
import { SlideMetricCard } from "./SlideMetricCard";
import { SlideObservationsActions } from "./SlideObservationsActions";

interface SlideDeckProps {
  currentSlide: SlideItem | null;
  isLoading: boolean;
  onOpenRecord: (id: number) => void;
}

export const SlideDeck: React.FC<SlideDeckProps> = ({ currentSlide, isLoading, onOpenRecord }) => {
  if (isLoading) {
    return (
      <Card
        sx={{
          p: 4,
          borderRadius: radiusTokens.xl,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#FFFFFF",
          boxShadow: shadowTokens.card,
        }}
      >
        <Skeleton variant="rectangular" width="40%" height={24} sx={{ mb: 2, borderRadius: radiusTokens.sm }} />
        <Skeleton variant="rectangular" width="70%" height={40} sx={{ mb: 3, borderRadius: radiusTokens.sm }} />
        <Grid container spacing={2.5}>
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <Grid key={k} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: radiusTokens.lg }} />
            </Grid>
          ))}
        </Grid>
      </Card>
    );
  }

  if (!currentSlide) {
    return (
      <Card
        sx={{
          p: 6,
          textAlign: "center",
          borderRadius: radiusTokens.xl,
          border: `1px solid ${colorTokens.workspace.border}`,
          bgcolor: "#FFFFFF",
          boxShadow: shadowTokens.card,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: radiusTokens.full,
            bgcolor: colorTokens.workspace.background,
            color: colorTokens.text.muted,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <SentimentDissatisfiedOutlinedIcon sx={{ fontSize: 36 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
          No Operational Slide Available
        </Typography>
        <Typography variant="body2" sx={{ color: colorTokens.text.secondary, maxWidth: 450, mx: "auto" }}>
          No operational KPI records match your current scope or filter selection. Try changing the Circle, Domain, or Status filter.
        </Typography>
      </Card>
    );
  }

  const { hierarchy, summary, kpis, issues, actions } = currentSlide;

  // Build breadcrumb segments from dynamic hierarchy
  const breadcrumbItems = [
    hierarchy.main_company,
    hierarchy.sub_company,
    hierarchy.project,
    hierarchy.circle,
    hierarchy.domain,
  ].filter(Boolean);

  const getOverallRagColor = (rag: string) => {
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

  const ragStyle = getOverallRagColor(summary.overall_rag);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(num);
  };

  return (
    <Card
      sx={{
        p: { xs: 2.5, md: 4 },
        borderRadius: radiusTokens.xl,
        border: `1px solid ${colorTokens.workspace.border}`,
        bgcolor: "#FFFFFF",
        boxShadow: shadowTokens.card,
        transition: "all 0.3s ease",
      }}
    >
      {/* 1. Context Breadcrumb Header */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1,
          mb: 2,
          p: 1.5,
          borderRadius: radiusTokens.md,
          bgcolor: colorTokens.workspace.background,
          border: `1px solid ${colorTokens.workspace.borderSubtle}`,
        }}
      >
        <AccountTreeOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary.main }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.muted, mr: 0.5 }}>
          CONTEXT:
        </Typography>
        {breadcrumbItems.map((item, idx) => (
          <React.Fragment key={idx}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: idx === breadcrumbItems.length - 1 ? 700 : 500,
                color: idx === breadcrumbItems.length - 1 ? colorTokens.primary.main : colorTokens.text.secondary,
              }}
            >
              {item}
            </Typography>
            {idx < breadcrumbItems.length - 1 && (
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                →
              </Typography>
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* 2. Slide Title & Scorecard Overview */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 2,
          mb: 3,
          pb: 2.5,
          borderBottom: `1px solid ${colorTokens.workspace.borderSubtle}`,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.75 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.01em" }}>
              {currentSlide.title}
            </Typography>
            <Chip
              label={summary.overall_rag}
              size="small"
              sx={{
                bgcolor: ragStyle.light,
                color: ragStyle.text,
                border: `1px solid ${ragStyle.border}`,
                fontWeight: 800,
                fontSize: "0.75rem",
                borderRadius: radiusTokens.sm,
              }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", color: colorTokens.text.secondary }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <LocationOnOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
              <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                Region: <span style={{ fontWeight: 600 }}>{hierarchy.region}</span>
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <PersonOutlineOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
              <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                Circle Head: <span style={{ fontWeight: 600 }}>{hierarchy.circle_head}</span>
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <LayersOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
              <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                Domain Code: <span style={{ fontWeight: 600 }}>{hierarchy.domain_code}</span>
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Scorecard Mini Summary Counters */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: radiusTokens.lg,
            bgcolor: colorTokens.workspace.background,
            border: `1px solid ${colorTokens.workspace.borderSubtle}`,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ textAlign: "center", px: 1 }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, display: "block" }}>
              KPIS
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              {summary.total_kpis}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center", px: 1, borderLeft: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.status.success.text, fontWeight: 700, display: "block" }}>
              GREEN
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.status.success.main }}>
              {summary.green_count}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center", px: 1, borderLeft: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.status.warning.text, fontWeight: 700, display: "block" }}>
              AMBER
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.status.warning.main }}>
              {summary.amber_count}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center", px: 1, borderLeft: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.status.error.text, fontWeight: 700, display: "block" }}>
              RED
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.status.error.main }}>
              {summary.red_count}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center", px: 1.5, borderLeft: `1px solid ${colorTokens.workspace.borderSubtle}` }}>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600, display: "block" }}>
              ACHIEVEMENT
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: ragStyle.text }}>
              {formatNumber(summary.achievement_percentage)}%
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 3. Operational KPI Cards Grid */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1.5 }}>
          Operational KPI Metrics ({kpis.length})
        </Typography>
        <Grid container spacing={2}>
          {kpis.map((kpi) => (
            <Grid key={kpi.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <SlideMetricCard kpi={kpi} onClick={onOpenRecord} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* 4. Observations & Actions Section */}
      <SlideObservationsActions issues={issues} actions={actions} />
    </Card>
  );
};
