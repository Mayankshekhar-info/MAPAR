import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kpiService } from "../api/kpiService";

export function useKPIDashboard(filters?: {
  period_id?: number;
  hierarchy_level?: string;
  hierarchy_id?: number;
}) {
  const queryClient = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: ["kpi-dashboard-cards", filters],
    queryFn: () => kpiService.fetchDashboardCards(filters),
    staleTime: 10000,
  });

  const calculateMutation = useMutation({
    mutationFn: ({
      kpiId,
      hierarchyLevel,
      hierarchyId,
      periodId,
    }: {
      kpiId: number;
      hierarchyLevel: string;
      hierarchyId: number;
      periodId?: number;
    }) =>
      kpiService.calculateKPI(kpiId, {
        hierarchy_level: hierarchyLevel,
        hierarchy_id: hierarchyId,
        period_id: periodId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-dashboard-cards"] });
    },
  });

  return {
    cards: cardsQuery.data || [],
    isLoadingCards: cardsQuery.isLoading,
    isRefetchingCards: cardsQuery.isRefetching,
    refetchCards: cardsQuery.refetch,
    calculateKPI: calculateMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
  };
}
