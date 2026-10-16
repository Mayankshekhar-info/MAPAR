import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { slideService } from "../api/slideService";
import {
  SlideHierarchyRootResponse,
  SlideHierarchyNodeResponse,
} from "../types/slide.types";

export const SLIDE_HIERARCHY_QUERY_KEYS = {
  root: (periodId?: number) => ["slides", "hierarchy-root", periodId] as const,
  node: (level: string, id: number, periodId?: number) =>
    ["slides", "hierarchy-node", level.toLowerCase(), id, periodId] as const,
};

export function useSlideHierarchyRoot() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const periodIdParam = searchParams.get("periodId");
  const periodId = periodIdParam ? Number(periodIdParam) : undefined;

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<SlideHierarchyRootResponse>({
    queryKey: SLIDE_HIERARCHY_QUERY_KEYS.root(periodId),
    queryFn: () => slideService.getHierarchyRoot(periodId),
    staleTime: 60 * 1000,
  });

  const handlePeriodChange = useCallback(
    (newPeriodId: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("periodId", String(newPeriodId));
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const handleSelectNode = useCallback(
    (level: string, id: number) => {
      const qs = searchParams.toString();
      const url = `/slides/${level.toLowerCase()}/${id}${qs ? `?${qs}` : ""}`;
      navigate(url);
    },
    [navigate, searchParams]
  );

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    selectedPeriodId: periodId || data?.period?.id || undefined,
    handlePeriodChange,
    handleSelectNode,
  };
}

export function useSlideHierarchyNode(level: string, id: number) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const periodIdParam = searchParams.get("periodId");
  const periodId = periodIdParam ? Number(periodIdParam) : undefined;

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<SlideHierarchyNodeResponse>({
    queryKey: SLIDE_HIERARCHY_QUERY_KEYS.node(level, id, periodId),
    queryFn: () => slideService.getHierarchyNode(level, id, periodId),
    staleTime: 60 * 1000,
    enabled: Boolean(level && id),
  });

  const handlePeriodChange = useCallback(
    (newPeriodId: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("periodId", String(newPeriodId));
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const handleSelectChild = useCallback(
    (childLevel: string, childId: number) => {
      const qs = searchParams.toString();
      const url = `/slides/${childLevel.toLowerCase()}/${childId}${qs ? `?${qs}` : ""}`;
      navigate(url);
    },
    [navigate, searchParams]
  );

  const handleBreadcrumbClick = useCallback(
    (crumbLevel: string, crumbId: number) => {
      const qs = searchParams.toString();
      if (crumbLevel === "ROOT" || crumbId === 0) {
        navigate(`/slides${qs ? `?${qs}` : ""}`);
      } else {
        navigate(`/slides/${crumbLevel.toLowerCase()}/${crumbId}${qs ? `?${qs}` : ""}`);
      }
    },
    [navigate, searchParams]
  );

  const handleBack = useCallback(() => {
    if (data?.parent) {
      const qs = searchParams.toString();
      if (data.parent.level === "ROOT" || data.parent.id === 0) {
        navigate(`/slides${qs ? `?${qs}` : ""}`);
      } else {
        navigate(`/slides/${data.parent.level.toLowerCase()}/${data.parent.id}${qs ? `?${qs}` : ""}`);
      }
    } else {
      navigate(-1);
    }
  }, [data, navigate, searchParams]);

  const handleRecordClick = useCallback(
    (recordId: number) => {
      const qs = searchParams.toString();
      navigate(`/slides/detail/${recordId}${qs ? `?${qs}` : ""}`);
    },
    [navigate, searchParams]
  );

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    selectedPeriodId: periodId || data?.period?.id || undefined,
    handlePeriodChange,
    handleSelectChild,
    handleBreadcrumbClick,
    handleBack,
    handleRecordClick,
  };
}
