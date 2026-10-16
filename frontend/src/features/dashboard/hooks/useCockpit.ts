import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cockpitService } from "../api/cockpitService";
import { CockpitFilterState, MasterSummaryRow } from "../types/cockpit.types";

export const COCKPIT_QUERY_KEYS = {
  filters: ["cockpit", "filters"] as const,
  summary: (filters: Partial<CockpitFilterState>) => ["cockpit", "summary", filters] as const,
  detail: (circleId: number | null, domainId: number | null, periodId?: number, status?: string, search?: string) =>
    ["cockpit", "detail", circleId, domainId, periodId, status, search] as const,
  record: (recordId: number | null) => ["cockpit", "record", recordId] as const,
};

export function useCockpit() {
  // Filter state
  const [filters, setFilters] = useState<CockpitFilterState>({
    companyId: undefined,
    projectId: undefined,
    circleId: undefined,
    domainId: undefined,
    periodId: undefined,
    status: "ALL",
    search: "",
  });

  // Selected master row state
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<number | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);

  // Selected detail record (for deep record drawer)
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 1. Fetch Filters
  const {
    data: filtersData,
    isLoading: isLoadingFilters,
    error: filtersError,
  } = useQuery({
    queryKey: COCKPIT_QUERY_KEYS.filters,
    queryFn: cockpitService.getFilters,
    staleTime: 5 * 60 * 1000,
  });

  // Set default active period once filters load
  useEffect(() => {
    if (filtersData?.periods && filters.periodId === undefined) {
      const current = filtersData.periods.find((p) => p.is_current) || filtersData.periods[0];
      if (current) {
        setFilters((prev) => ({ ...prev, periodId: current.id }));
      }
    }
  }, [filtersData, filters.periodId]);

  // 2. Fetch Master Summary Matrix
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    isFetching: isFetchingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: COCKPIT_QUERY_KEYS.summary(filters),
    queryFn: () => cockpitService.getMasterSummary(filters),
    staleTime: 60 * 1000,
  });

  // Auto-select first non-subtotal row if none selected
  useEffect(() => {
    if (summaryData?.rows && summaryData.rows.length > 0) {
      const nonSubtotals = summaryData.rows.filter((r) => !r.is_subtotal && !r.is_grand_total);
      if (nonSubtotals.length > 0) {
        const currentMatch = nonSubtotals.find((r) => r.id === selectedRowId);
        if (!currentMatch) {
          const first = nonSubtotals[0];
          setSelectedRowId(first.id);
          setSelectedCircleId(first.circle_id);
          setSelectedDomainId(first.domain_id);
        }
      }
    }
  }, [summaryData, selectedRowId]);

  // 3. Fetch Contextual Detail Breakdown
  const {
    data: detailData,
    isLoading: isLoadingDetail,
    isFetching: isFetchingDetail,
    error: detailError,
  } = useQuery({
    queryKey: COCKPIT_QUERY_KEYS.detail(
      selectedCircleId,
      selectedDomainId,
      filters.periodId,
      filters.status,
      filters.search
    ),
    queryFn: () => {
      if (selectedCircleId === null) return Promise.resolve(null);
      return cockpitService.getDetailBreakdown(
        selectedCircleId,
        selectedDomainId,
        filters.periodId,
        filters.status,
        filters.search
      );
    },
    enabled: selectedCircleId !== null,
    staleTime: 60 * 1000,
  });

  // 4. Fetch Deep Record Detail
  const {
    data: deepRecord,
    isLoading: isLoadingDeepRecord,
    error: deepRecordError,
  } = useQuery({
    queryKey: COCKPIT_QUERY_KEYS.record(selectedRecordId),
    queryFn: () => {
      if (!selectedRecordId) return Promise.resolve(null);
      return cockpitService.getRecordDetail(selectedRecordId);
    },
    enabled: Boolean(selectedRecordId && isDrawerOpen),
    staleTime: 60 * 1000,
  });

  // Master row click handler
  const handleSelectMasterRow = useCallback((row: MasterSummaryRow) => {
    if (row.is_grand_total) return; // Grand total row is an aggregate summary
    setSelectedRowId(row.id);
    setSelectedCircleId(row.circle_id);
    setSelectedDomainId(row.domain_id);
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Detail row click handler: Navigates to dedicated full-page detail route
  const handleSelectDetailRecord = useCallback(
    (recordId: number) => {
      setSelectedRecordId(recordId);
      const params = new URLSearchParams(searchParams);
      params.set("from", "cockpit");
      if (filters.companyId) params.set("companyId", String(filters.companyId));
      if (filters.projectId) params.set("projectId", String(filters.projectId));
      if (filters.circleId) params.set("circleId", String(filters.circleId));
      if (filters.domainId) params.set("domainId", String(filters.domainId));
      if (filters.periodId) params.set("periodId", String(filters.periodId));
      if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      navigate(`/management-cockpit/detail/${recordId}?${params.toString()}`);
    },
    [navigate, searchParams, filters]
  );

  const handleInspectRecord = useCallback((recordId: number) => {
    setSelectedRecordId(recordId);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  // Filter change handlers
  const handleFilterChange = useCallback((key: keyof CockpitFilterState, value: any) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Cascading logic: reset children if parent changes
      if (key === "companyId") {
        next.projectId = undefined;
        next.circleId = undefined;
      } else if (key === "projectId") {
        next.circleId = undefined;
      }
      return next;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    const currentPeriod = filtersData?.periods.find((p) => p.is_current) || filtersData?.periods[0];
    setFilters({
      companyId: undefined,
      projectId: undefined,
      circleId: undefined,
      domainId: undefined,
      periodId: currentPeriod?.id,
      status: "ALL",
      search: "",
    });
  }, [filtersData]);

  // Export CSV handler
  const handleExportCsv = useCallback(async () => {
    try {
      const blob = await cockpitService.exportCsv(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MAPAR_Cockpit_Export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [filters]);

  return {
    filters,
    filtersData,
    isLoadingFilters,
    filtersError,
    summaryData,
    isLoadingSummary,
    isFetchingSummary,
    summaryError,
    refetchSummary,
    selectedRowId,
    selectedCircleId,
    selectedDomainId,
    handleSelectMasterRow,
    detailData,
    isLoadingDetail,
    isFetchingDetail,
    detailError,
    selectedRecordId,
    deepRecord,
    isLoadingDeepRecord,
    deepRecordError,
    isDrawerOpen,
    handleSelectDetailRecord,
    handleInspectRecord,
    handleCloseDrawer,
    handleFilterChange,
    handleResetFilters,
    handleExportCsv,
  };
}
