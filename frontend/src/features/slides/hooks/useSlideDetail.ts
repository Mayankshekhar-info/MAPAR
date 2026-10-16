import { useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { slideService } from "../api/slideService";

export const SLIDE_DETAIL_QUERY_KEYS = {
  detail: (recordId: number | null) => ["slides", "detail", recordId] as const,
};

export function useSlideDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const recordId = id && !isNaN(Number(id)) ? Number(id) : null;
  const isFromCockpit =
    location.pathname.startsWith("/management-cockpit") || searchParams.get("from") === "cockpit";

  const {
    data: detail,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: SLIDE_DETAIL_QUERY_KEYS.detail(recordId),
    queryFn: () => {
      if (!recordId) return Promise.reject(new Error("Invalid record ID"));
      return slideService.getRecordDetail(recordId);
    },
    enabled: recordId !== null,
    staleTime: 60 * 1000,
  });

  const handleBack = useCallback(() => {
    // Preserve filters from query parameters when navigating back to origin view
    if (isFromCockpit) {
      navigate(`/?${searchParams.toString()}`);
    } else {
      navigate(`/slides?${searchParams.toString()}`);
    }
  }, [navigate, searchParams, isFromCockpit]);

  return {
    recordId,
    detail,
    isLoading,
    isFetching,
    error,
    refetch,
    isFromCockpit,
    backLabel: isFromCockpit ? "Back to Management Cockpit" : "Back to Slide View",
    handleBack,
    handleBackToSlideView: handleBack,
  };
}
