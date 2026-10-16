import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService, UsersFilterParams } from "../api/usersService";
import { CreateUserPayload, UpdateUserPayload } from "../types/users.types";

export const USER_KEYS = {
  all: ["users"] as const,
  list: (params: UsersFilterParams) => ["users", "list", params] as const,
  detail: (id: number) => ["users", "detail", id] as const,
};

export function useUsersList(params: UsersFilterParams = {}) {
  return useQuery({
    queryKey: USER_KEYS.list(params),
    queryFn: () => usersService.getUsers(params),
  });
}

export function useUserDetail(userId?: number) {
  return useQuery({
    queryKey: USER_KEYS.detail(userId!),
    queryFn: () => usersService.getUserDetail(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UpdateUserPayload }) =>
      usersService.updateUser(userId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
      queryClient.invalidateQueries({ queryKey: USER_KEYS.detail(vars.userId) });
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => usersService.toggleUserStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
    },
  });
}
