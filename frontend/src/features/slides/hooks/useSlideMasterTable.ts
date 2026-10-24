import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { slideService } from "../api/slideService";
import { SlideFilterState, SlideMasterRowData } from "../types/slide.types";

export const SLIDE_MASTER_QUERY_KEYS = {
  filters: ["slides", "master-filters"] as const,
  table: (filters: Partial<SlideFilterState>) => ["slides", "master-table", filters] as const,
};

export function useSlideMasterTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Initialize filters from URL search params to preserve state on back navigation
  const initialFilters: SlideFilterState = useMemo(() => {
    return {
      companyId: searchParams.get("companyId") ? Number(searchParams.get("companyId")) : undefined,
      projectId: searchParams.get("projectId") ? Number(searchParams.get("projectId")) : undefined,
      circleId: searchParams.get("circleId") ? Number(searchParams.get("circleId")) : undefined,
      domainId: searchParams.get("domainId") ? Number(searchParams.get("domainId")) : undefined,
      periodId: searchParams.get("periodId") ? Number(searchParams.get("periodId")) : undefined,
      status: searchParams.get("status") || "ALL",
      search: searchParams.get("search") || "",
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<SlideFilterState>(initialFilters);

  // Sync state to URL params
  const updateUrlParams = useCallback((newFilters: SlideFilterState) => {
    const params = new URLSearchParams();
    if (newFilters.companyId) params.set("companyId", String(newFilters.companyId));
    if (newFilters.projectId) params.set("projectId", String(newFilters.projectId));
    if (newFilters.circleId) params.set("circleId", String(newFilters.circleId));
    if (newFilters.domainId) params.set("domainId", String(newFilters.domainId));
    if (newFilters.periodId) params.set("periodId", String(newFilters.periodId));
    if (newFilters.status && newFilters.status !== "ALL") params.set("status", newFilters.status);
    if (newFilters.search) params.set("search", newFilters.search.trim());
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // 1. Fetch live filter options
  const {
    data: filtersData,
    isLoading: isLoadingFilters,
    error: filtersError,
  } = useQuery({
    queryKey: SLIDE_MASTER_QUERY_KEYS.filters,
    queryFn: slideService.getFilters,
    staleTime: 5 * 60 * 1000,
  });

  // Set default current period if none in URL
  useEffect(() => {
    if (filtersData?.periods && filters.periodId === undefined) {
      const current = filtersData.periods.find((p) => p.is_current) || filtersData.periods[0];
      if (current) {
        setFilters((prev) => {
          const updated = { ...prev, periodId: current.id };
          updateUrlParams(updated);
          return updated;
        });
      }
    }
  }, [filtersData, filters.periodId, updateUrlParams]);

  // 2. Fetch Master Operational Matrix
  const {
    data: tableData,
    isLoading: isLoadingTable,
    isFetching: isFetchingTable,
    error: tableError,
    refetch: refetchTable,
  } = useQuery({
    queryKey: SLIDE_MASTER_QUERY_KEYS.table(filters),
    queryFn: () => slideService.getMasterTable(filters),
    staleTime: 60 * 1000,
  });

  // Row Click navigation to Detail Page
  const handleRowClick = useCallback(
    (row: SlideMasterRowData) => {
      if (!row.is_clickable || typeof row.id !== "number") return;
      // Pass existing query params in URL so detail page can preserve them on back navigation
      navigate(`/slides/detail/${row.id}?${searchParams.toString()}`);
    },
    [navigate, searchParams]
  );

  // Cascading Filter updates
  const setCompanyFilter = useCallback((companyId?: number) => {
    setFilters((prev) => {
      const updated = { ...prev, companyId, projectId: undefined, circleId: undefined };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const setProjectFilter = useCallback((projectId?: number) => {
    setFilters((prev) => {
      const updated = { ...prev, projectId, circleId: undefined };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const setCircleFilter = useCallback((circleId?: number) => {
    setFilters((prev) => {
      const updated = { ...prev, circleId };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const setDomainFilter = useCallback((domainId?: number) => {
    setFilters((prev) => {
      const updated = { ...prev, domainId };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const setPeriodFilter = useCallback((periodId?: number) => {
    setFilters((prev) => {
      const updated = { ...prev, periodId };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const setStatusFilter = useCallback((status: string) => {
    setFilters((prev) => {
      const updated = { ...prev, status };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const setSearchFilter = useCallback((search: string) => {
    setFilters((prev) => {
      const updated = { ...prev, search };
      updateUrlParams(updated);
      return updated;
    });
  }, [updateUrlParams]);

  const resetFilters = useCallback(() => {
    const defaultPeriodId =
      filtersData?.periods?.find((p) => p.is_current)?.id || filtersData?.periods?.[0]?.id;
    const resetState: SlideFilterState = {
      companyId: undefined,
      projectId: undefined,
      circleId: undefined,
      domainId: undefined,
      periodId: defaultPeriodId,
      status: "ALL",
      search: "",
    };
    setFilters(resetState);
    updateUrlParams(resetState);
  }, [filtersData, updateUrlParams]);

  return {
    filters,
    filtersData,
    isLoadingFilters,
    filtersError,
    tableData,
    isLoadingTable,
    isFetchingTable,
    tableError,
    refetchTable,
    handleRowClick,

    setCompanyFilter,
    setProjectFilter,
    setCircleFilter,
    setDomainFilter,
    setPeriodFilter,
    setStatusFilter,
    setSearchFilter,
    resetFilters,
  };
}
