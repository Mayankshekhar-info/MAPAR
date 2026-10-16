import React from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useSlideHierarchyNode } from "../hooks/useSlideHierarchy";
import { SlideBreadcrumbs } from "../components/SlideBreadcrumbs";
import { SlideChildrenGrid } from "../components/SlideChildrenGrid";
import { SlideOperationalTable } from "../components/SlideOperationalTable";
import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { PeriodSelector } from "../../../components/PeriodSelector";

export const SlideHierarchyPage: React.FC = () => {
  const { level = "", id = "" } = useParams<{ level: string; id: string }>();
  const nodeId = Number(id);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    selectedPeriodId,
    handlePeriodChange,
    handleSelectChild,
    handleBreadcrumbClick,
    handleBack,
    handleRecordClick,
  } = useSlideHierarchyNode(level, nodeId);

  if (isLoading) {
    return (
      <Box sx={{ pb: 6 }}>
        <Skeleton variant="rectangular" width={240} height={28} sx={{ mb: 2, borderRadius: radiusTokens.sm }} />
        <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 3, borderRadius: radiusTokens.lg }} />
        <Skeleton variant="rectangular" width="100%" height={260} sx={{ mb: 3, borderRadius: radiusTokens.lg }} />
        <Skeleton variant="rectangular" width="100%" height={320} sx={{ borderRadius: radiusTokens.lg }} />
      </Box>
    );
  }

  if (error || !data) {
    const errorMsg =
      (error as any)?.response?.data?.detail ||
      (error as any)?.response?.data?.error ||
      "Unable to retrieve details for this organization node. You may lack downward authorization, or the item does not exist.";

    return (
      <Box sx={{ pb: 6, maxWidth: 680, mx: "auto", mt: 6 }}>
        <Alert
          severity="error"
          sx={{ borderRadius: radiusTokens.lg, p: 3 }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 800 }}>Organization Scope Access Error</AlertTitle>
          {errorMsg}
        </Alert>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            sx={{ borderRadius: radiusTokens.md, textTransform: "none", fontWeight: 700 }}
          >
            Go Back
          </Button>
        </Box>
      </Box>
    );
  }

  const { node, breadcrumbs, children, child_level, operational_data, uploaded_batches, summary, period, periods } = data;

  return (
    <Box sx={{ pb: 6 }}>
      {/* 1. Dynamic Clickable Breadcrumbs */}
      <SlideBreadcrumbs items={breadcrumbs} onItemClick={handleBreadcrumbClick} />

      {/* 2. Full Page Header */}
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Back Navigation Button */}
          <Button
            variant="outlined"
            size="small"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
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
            Back
          </Button>

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
                {node.name}
              </Typography>

              <Chip
                label={node.code}
                size="small"
                sx={{
                  bgcolor: colorTokens.workspace.background,
                  border: `1px solid ${colorTokens.workspace.border}`,
                  fontWeight: 700,
                  fontSize: "0.76rem",
                  color: colorTokens.text.primary,
                  borderRadius: radiusTokens.xs,
                }}
              />

              <Chip
                label={node.badge}
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
                label={node.status}
                size="small"
                sx={{
                  bgcolor: node.status === "ACTIVE" ? colorTokens.status.success.light : colorTokens.status.neutral.light,
                  color: node.status === "ACTIVE" ? colorTokens.status.success.text : colorTokens.status.neutral.text,
                  fontWeight: 800,
                  fontSize: "0.7rem",
                  borderRadius: radiusTokens.xs,
                }}
              />
            </Box>

            {node.description && (
              <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.5 }}>
                {node.description}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right side controls: Period select + Refresh */}
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

      {/* 3. Summary Metrics Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
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
            Child Units:
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.primary, fontWeight: 800 }}>
            {summary.child_count}
          </Typography>
        </Box>

        <Box sx={{ width: "1px", height: 20, bgcolor: colorTokens.workspace.border }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, fontWeight: 600 }}>
            Operational Records:
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
                RAG Distribution:
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

      {/* 4. Direct Children Section */}
      {child_level && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "1.1rem" }}>
              Direct Child Organizations
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
              Click any node to navigate down the hierarchy
            </Typography>
          </Box>

          <SlideChildrenGrid
            childrenNodes={children}
            childLevelName={child_level}
            onChildClick={handleSelectChild}
          />
        </Box>
      )}

      {/* 5. Relevant Operational Data & Uploaded Records Section */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary, fontSize: "1.1rem", mb: 0.5 }}>
          Operational Data & Governance
        </Typography>
        <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>
          Real-time metrics, KPI achievements, and committed Excel upload batches belonging to this organization scope
        </Typography>

        <SlideOperationalTable
          records={operational_data}
          uploadedBatches={uploaded_batches}
          onRecordClick={handleRecordClick}
        />
      </Box>
    </Box>
  );
};
