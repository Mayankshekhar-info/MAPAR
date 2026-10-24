import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportingPeriodService } from "../services/reportingPeriodService";
import { ReportingFrequency, ReportingPeriod } from "../types/period.types";

export function useReportingPeriod(frequency?: ReportingFrequency | "ALL") {
  const queryClient = useQueryClient();

  const periodsQuery = useQuery({
    queryKey: ["reporting-periods", frequency],
    queryFn: () => reportingPeriodService.fetchPeriods(frequency),
    staleTime: 60000,
  });

  const resolveMutation = useMutation({
    mutationFn: (params: {
      period_id?: number;
      period_type?: string;
      start_date?: string;
      end_date?: string;
      period_name?: string;
    }) => reportingPeriodService.resolvePeriod(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reporting-periods"] });
    },
  });

  return {
    periods: periodsQuery.data?.periods || [],
    currentPeriod: periodsQuery.data?.current_period || null,
    supportedFrequencies: periodsQuery.data?.supported_frequencies || [],
    isLoading: periodsQuery.isLoading,
    refetch: periodsQuery.refetch,
    resolvePeriod: resolveMutation.mutateAsync,
    isResolving: resolveMutation.isPending,
  };
}
