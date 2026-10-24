import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesService, RolesFilterParams } from "../api/rolesService";
import { CreateRolePayload, UpdateRolePayload } from "../types/roles.types";

export const ROLE_KEYS = {
  all: ["roles"] as const,
  list: (params: RolesFilterParams) => ["roles", "list", params] as const,
  detail: (id: number) => ["roles", "detail", id] as const,
  matrix: ["roles", "matrix"] as const,
};

export function useRolesList(params: RolesFilterParams = {}) {
  return useQuery({
    queryKey: ROLE_KEYS.list(params),
    queryFn: () => rolesService.getRoles(params),
  });
}

export function useRoleDetail(roleId?: number | null) {
  return useQuery({
    queryKey: ROLE_KEYS.detail(roleId!),
    queryFn: () => rolesService.getRoleDetail(roleId!),
    enabled: Boolean(roleId),
  });
}

export function usePermissionMatrix() {
  return useQuery({
    queryKey: ROLE_KEYS.matrix,
    queryFn: () => rolesService.getPermissionMatrix(),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => rolesService.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLE_KEYS.all });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: UpdateRolePayload }) =>
      rolesService.updateRole(roleId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ROLE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ROLE_KEYS.detail(vars.roleId) });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => rolesService.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLE_KEYS.all });
    },
  });
}
