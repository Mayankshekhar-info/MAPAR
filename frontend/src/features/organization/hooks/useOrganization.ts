import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationService } from "../api/organizationService";
import {
  HierarchyLevel,
  CreateNodePayload,
  UpdateNodePayload,
} from "../types/organization.types";

export const orgKeys = {
  all: ["organization"] as const,
  tree: () => [...orgKeys.all, "tree"] as const,
  summary: () => [...orgKeys.all, "summary"] as const,
  node: (level: HierarchyLevel | null, id: number | null) =>
    [...orgKeys.all, "node", level, id] as const,
  options: (level: HierarchyLevel, parentId?: number | null) =>
    [...orgKeys.all, "options", level, parentId] as const,
  search: (q: string) => [...orgKeys.all, "search", q] as const,
};

export function useOrganizationTree() {
  return useQuery({
    queryKey: orgKeys.tree(),
    queryFn: () => organizationService.getTree(),
  });
}

export function useOrganizationSummary() {
  return useQuery({
    queryKey: orgKeys.summary(),
    queryFn: () => organizationService.getSummary(),
  });
}

export function useOrganizationNode(level: HierarchyLevel | null, id: number | null) {
  return useQuery({
    queryKey: orgKeys.node(level, id),
    queryFn: () => {
      if (!level || !id) return null;
      return organizationService.getNodeDetail(level, id);
    },
    enabled: Boolean(level && id),
  });
}

export function useCascadingOptions(level: HierarchyLevel, parentId?: number | null) {
  return useQuery({
    queryKey: orgKeys.options(level, parentId),
    queryFn: () => organizationService.getOptions(level, parentId),
    enabled: Boolean(level),
  });
}

export function useOrganizationMutations() {
  const queryClient = useQueryClient();

  const createNode = useMutation({
    mutationFn: (payload: CreateNodePayload) => organizationService.createNode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
  });

  const updateNode = useMutation({
    mutationFn: ({
      level,
      id,
      payload,
    }: {
      level: HierarchyLevel;
      id: number;
      payload: UpdateNodePayload;
    }) => organizationService.updateNode(level, id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
      queryClient.invalidateQueries({ queryKey: orgKeys.node(variables.level, variables.id) });
    },
  });

  const deleteNode = useMutation({
    mutationFn: ({ level, id }: { level: HierarchyLevel; id: number }) =>
      organizationService.deleteNode(level, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
  });

  return {
    createNode,
    updateNode,
    deleteNode,
  };
}
