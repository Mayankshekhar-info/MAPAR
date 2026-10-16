import { api } from "../../../services/api";
import {
  UsersListResponse,
  UserDetail,
  CreateUserPayload,
  UpdateUserPayload,
} from "../types/users.types";

export interface UsersFilterParams {
  search?: string;
  role?: string;
  status?: string;
  circle_id?: number | null;
  page?: number;
  page_size?: number;
}

export const usersService = {
  async getUsers(params: UsersFilterParams = {}): Promise<UsersListResponse> {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    if (params.status) q.set("status", params.status);
    if (params.circle_id) q.set("circle_id", String(params.circle_id));
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));

    const res = await api.get<UsersListResponse>(`/users/?${q.toString()}`);
    return res.data;
  },

  async getUserDetail(userId: number): Promise<UserDetail> {
    const res = await api.get<{ success: boolean; user: UserDetail }>(`/users/${userId}/`);
    return res.data.user;
  },

  async createUser(payload: CreateUserPayload): Promise<UserDetail> {
    const res = await api.post<{ success: boolean; user: UserDetail }>("/users/", payload);
    return res.data.user;
  },

  async updateUser(userId: number, payload: UpdateUserPayload): Promise<UserDetail> {
    const res = await api.patch<{ success: boolean; user: UserDetail }>(`/users/${userId}/`, payload);
    return res.data.user;
  },

  async toggleUserStatus(userId: number): Promise<{ success: boolean; is_active: boolean; status: string }> {
    const res = await api.post<{ success: boolean; is_active: boolean; status: string }>(
      `/users/${userId}/toggle-status/`
    );
    return res.data;
  },

  async getUserScopes(userId: number): Promise<any[]> {
    const res = await api.get<{ success: boolean; scopes: any[] }>(`/authorization/scopes/?user_id=${userId}`);
    return res.data.scopes;
  },

  async assignScope(scopeData: any): Promise<any> {
    const res = await api.post<{ success: boolean; scope: any }>("/authorization/scopes/", scopeData);
    return res.data.scope;
  },

  async updateScope(scopeId: number, scopeData: any): Promise<any> {
    const res = await api.patch<{ success: boolean; scope: any }>(`/authorization/scopes/${scopeId}/`, scopeData);
    return res.data.scope;
  },

  async deleteScope(scopeId: number): Promise<void> {
    await api.delete(`/authorization/scopes/${scopeId}/`);
  },

  async getEffectiveAccess(userId: number): Promise<any> {
    const res = await api.get<{ success: boolean; effective_access: any }>(
      `/authorization/users/${userId}/effective-access/`
    );
    return res.data.effective_access;
  },
};
