import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scopesService } from "../api/scopesService";
import { AssignScopePayload } from "../types/scopes.types";

export const SCOPE_KEYS = {
  all: ["scopes"] as const,
  list: (userId?: number | null) => ["scopes", "list", userId] as const,
};

export function useAccessScopesList(userId?: number | null) {
  return useQuery({
    queryKey: SCOPE_KEYS.list(userId),
    queryFn: () => scopesService.getScopes(userId),
  });
}

export function useAssignScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignScopePayload) => scopesService.assignScope(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCOPE_KEYS.all });
    },
  });
}

export function useDeleteScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scopeId: number) => scopesService.deleteScope(scopeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCOPE_KEYS.all });
    },
  });
}
