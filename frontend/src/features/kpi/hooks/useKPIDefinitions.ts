import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kpiService } from "../api/kpiService";
import { CreateKPIDefinitionPayload } from "../types/kpi";

export function useKPIDefinitions(filters?: {
  search?: string;
  is_active?: boolean;
  domain_id?: number;
  hierarchy_level?: string;
}) {
  const queryClient = useQueryClient();

  const definitionsQuery = useQuery({
    queryKey: ["kpi-definitions", filters],
    queryFn: () => kpiService.fetchDefinitions(filters),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateKPIDefinitionPayload) => kpiService.createDefinition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-dashboard-cards"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateKPIDefinitionPayload> }) =>
      kpiService.updateDefinition(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-dashboard-cards"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => kpiService.deleteDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-dashboard-cards"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => kpiService.duplicateDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
    },
  });

  return {
    ...definitionsQuery,
    createDefinition: createMutation.mutateAsync,
    updateDefinition: updateMutation.mutateAsync,
    deleteDefinition: deleteMutation.mutateAsync,
    duplicateDefinition: duplicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
