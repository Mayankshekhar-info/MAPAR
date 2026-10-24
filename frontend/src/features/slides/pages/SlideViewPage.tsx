import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Skeleton from "@mui/material/Skeleton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import RefreshIcon from "@mui/icons-material/Refresh";
import SlideshowIcon from "@mui/icons-material/Slideshow";

import { useSlideHierarchyRoot } from "../hooks/useSlideHierarchy";
import { SlideChildrenGrid } from "../components/SlideChildrenGrid";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { PeriodSelector } from "../../../components/PeriodSelector";

export const SlideViewPage: React.FC = () => {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    selectedPeriodId,
    handlePeriodChange,
    handleSelectNode,
  } = useSlideHierarchyRoot();

  if (isLoading) {
    return (
      <Box sx={{ pb: 6 }}>
        <Skeleton variant="rectangular" width="100%" height={100} sx={{ mb: 3, borderRadius: radiusTokens.lg }} />
        <Skeleton variant="rectangular" width="100%" height={80} sx={{ mb: 3, borderRadius: radiusTokens.md }} />
        <Skeleton variant="rectangular" width="100%" height={320} sx={{ borderRadius: radiusTokens.lg }} />
      </Box>
    );
  }

  if (error || !data) {
    const errorMsg =
      (error as any)?.response?.data?.detail ||
      (error as any)?.response?.data?.error ||
      "Failed to load authorized Main Companies. Please verify server connection and permissions.";

    return (
      <Box sx={{ pb: 6 }}>
        <Alert
          severity="error"
          sx={{ borderRadius: radiusTokens.md, mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 800 }}>Slide View Access Error</AlertTitle>
          {errorMsg}
        </Alert>
      </Box>
    );
  }

  const { nodes, summary, period, periods } = data;

  return (
    <Box sx={{ pb: 6 }}>
      {/* 1. Slide View Executive Header */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 2,
          pb: 2.5,
          borderBottom: `1px solid ${colorTokens.workspace.border}`,
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: radiusTokens.md,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
            }}
          >
            <SlideshowIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  color: colorTokens.text.primary,
                  fontSize: { xs: "1.35rem", md: "1.65rem" },
                  letterSpacing: "-0.02em",
                }}
              >
                Slide View
              </Typography>
              <Chip
                label="Executive Drill-Down"
                size="small"
                sx={{
                  bgcolor: colorTokens.primary.lighter,
                  color: colorTokens.primary.darker,
                  fontWeight: 800,
                  fontSize: "0.72rem",
                  borderRadius: radiusTokens.xs,
                }}
              />
              <Chip
                label={`${summary.total_companies} Companies`}
                size="small"
                sx={{
                  bgcolor: colorTokens.workspace.background,
                  border: `1px solid ${colorTokens.workspace.border}`,
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: colorTokens.text.secondary,
                  borderRadius: radiusTokens.xs,
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.25 }}>
              Hierarchical operational review. Select an authorized Main Company below to begin the deep organization drill-down.
            </Typography>
          </Box>
        </Box>

        {/* Right side controls: Period selector + Refresh button */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <PeriodSelector
            selectedPeriodId={selectedPeriodId}
            onPeriodSelect={(period) => handlePeriodChange(period.id)}
            size="small"
          />

          <Button
            variant="outlined"
            size="small"
            onClick={() => refetch()}
            disabled={isFetching}
            startIcon={<RefreshIcon sx={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />}
            sx={{
              borderRadius: radiusTokens.md,
              fontWeight: 700,
              fontSize: "0.82rem",
              textTransform: "none",
              bgcolor: "#FFFFFF",
              color: colorTokens.text.primary,
              borderColor: colorTokens.workspace.border,
              "&:hover": { borderColor: colorTokens.primary.main, bgcolor: colorTokens.workspace.borderSubtle },
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* 2. Executive Scope Summary Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2.5,
          flexWrap: "wrap",
          p: 2,
          bgcolor: colorTokens.workspace.background,
          border: `1px solid ${colorTokens.workspace.border}`,
          borderRadius: radiusTokens.lg,
          mb: 3.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
            Authorized Main Companies:
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontWeight: 800 }}>
            {summary.total_companies}
          </Typography>
        </Box>

        <Box sx={{ width: "1px", height: 20, bgcolor: colorTokens.workspace.border }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
            Total Operational Records:
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontWeight: 800 }}>
            {summary.total_records}
          </Typography>
        </Box>

        {summary.total_records > 0 && (
          <>
            <Box sx={{ width: "1px", height: 20, bgcolor: colorTokens.workspace.border }} />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
                Enterprise RAG Status:
              </Typography>
              <Chip
                label={`${summary.green_count} Optimal`}
                size="small"
                sx={{
                  bgcolor: colorTokens.status.success.light,
                  color: colorTokens.status.success.text,
                  fontWeight: 800,
                  fontSize: "0.72rem",
                }}
              />
              <Chip
                label={`${summary.amber_count} Warning`}
                size="small"
                sx={{
                  bgcolor: colorTokens.status.warning.light,
                  color: colorTokens.status.warning.text,
                  fontWeight: 800,
                  fontSize: "0.72rem",
                }}
              />
              <Chip
                label={`${summary.red_count} Critical`}
                size="small"
                sx={{
                  bgcolor: colorTokens.status.error.light,
                  color: colorTokens.status.error.text,
                  fontWeight: 800,
                  fontSize: "0.72rem",
                }}
              />
            </Box>
          </>
        )}
      </Box>

      {/* 3. Level 1: Main Companies Cards / Grid */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "1.1rem" }}>
            LEVEL 1 — Main Companies
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
            Click any company to open its dedicated page and view its Sub Companies
          </Typography>
        </Box>

        <SlideChildrenGrid
          childrenNodes={nodes}
          childLevelName="MAIN_COMPANY"
          onChildClick={(level, id) => handleSelectNode(level, id)}
        />
      </Box>
    </Box>
  );
};
