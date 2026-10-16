import React from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import RefreshIcon from "@mui/icons-material/Refresh";

import { PageHeader } from "../../../components/PageHeader/PageHeader";
import { useCockpit } from "../hooks/useCockpit";
import { CockpitFilterBar } from "../components/CockpitFilterBar";
import { MasterSummaryMatrix } from "../components/MasterSummaryMatrix";
import { DetailBreakdownTable } from "../components/DetailBreakdownTable";
import { ObservationActionPanel } from "../components/ObservationActionPanel";
import { DeepRecordDrawer } from "../components/DeepRecordDrawer";

export const ManagementCockpitPage: React.FC = () => {
  const {
    filters,
    filtersData,
    isLoadingFilters,
    summaryData,
    isLoadingSummary,
    summaryError,
    refetchSummary,
    selectedRowId,
    handleSelectMasterRow,
    detailData,
    isLoadingDetail,
    selectedRecordId,
    deepRecord,
    isLoadingDeepRecord,
    isDrawerOpen,
    handleSelectDetailRecord,
    handleInspectRecord,
    handleCloseDrawer,
    handleFilterChange,
    handleResetFilters,
    handleExportCsv,
  } = useCockpit();

  const activePeriodName = summaryData?.period?.name || "ACTIVE CYCLE 2026-09";

  return (
    <Box sx={{ pb: 4 }}>
      {/* Enterprise Page Header */}
      <PageHeader
        title="Management Cockpit"
        subtitle="Operational Control View • Master-Detail Intelligence across Circles, Domains, and Universal KPIs."
        badge={activePeriodName}
        badgeColor="success"
      />

      {/* Top Filter Bar */}
      <CockpitFilterBar
        filters={filters}
        filtersData={filtersData}
        isLoading={isLoadingFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onExportCsv={handleExportCsv}
      />

      {/* Error Banner */}
      {summaryError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => refetchSummary()}>
              Retry
            </Button>
          }
        >
          <AlertTitle>Operational Data Sync Error</AlertTitle>
          Unable to retrieve operational metrics from backend. Please verify your connection or refresh.
        </Alert>
      )}

      {/* Master-Detail Split Workspace */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Left Side: Master Operational Summary Matrix with Executive Scorecard */}
        <Box sx={{ minWidth: 0 }}>
          <MasterSummaryMatrix
            rows={summaryData?.rows || []}
            totalRecords={summaryData?.total_records || 0}
            metricsSummary={summaryData?.metrics_summary}
            selectedRowId={selectedRowId}
            isLoading={isLoadingSummary}
            onSelectRow={handleSelectMasterRow}
          />
        </Box>

        {/* Right Side: Contextual Detail Breakdown & Observations */}
        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <DetailBreakdownTable
            detailData={detailData}
            isLoading={isLoadingDetail}
            onSelectRecord={handleSelectDetailRecord}
            onInspectRecord={handleInspectRecord}
          />

          {/* Contextual Intelligence (Observations & Corrective Actions) */}
          <ObservationActionPanel
            observations={detailData?.observations || []}
            actions={detailData?.actions || []}
          />
        </Box>
      </Box>

      {/* Level 3 Deep Record & Uploaded Staged Records Drawer */}
      <DeepRecordDrawer
        open={isDrawerOpen}
        record={deepRecord}
        isLoading={isLoadingDeepRecord}
        onClose={handleCloseDrawer}
      />
    </Box>
  );
};
