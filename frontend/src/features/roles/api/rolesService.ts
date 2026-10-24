import { api } from "../../../services/api";
import {
  RoleListItem,
  RoleDetail,
  PermissionMatrixModule,
  CreateRolePayload,
  UpdateRolePayload,
} from "../types/roles.types";

export interface RolesFilterParams {
  search?: string;
  status?: string;
}

export const rolesService = {
  async getRoles(params: RolesFilterParams = {}): Promise<RoleListItem[]> {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.status) q.set("status", params.status);

    const res = await api.get<{ success: boolean; roles: RoleListItem[] }>(
      `/authorization/roles/?${q.toString()}`
    );
    return res.data.roles;
  },

  async getRoleDetail(roleId: number): Promise<RoleDetail> {
    const res = await api.get<{ success: boolean; role: RoleDetail }>(
      `/authorization/roles/${roleId}/`
    );
    return res.data.role;
  },

  async createRole(payload: CreateRolePayload): Promise<RoleDetail> {
    const res = await api.post<{ success: boolean; role: RoleDetail }>(
      "/authorization/roles/",
      payload
    );
    return res.data.role;
  },

  async updateRole(roleId: number, payload: UpdateRolePayload): Promise<RoleDetail> {
    const res = await api.patch<{ success: boolean; role: RoleDetail }>(
      `/authorization/roles/${roleId}/`,
      payload
    );
    return res.data.role;
  },

  async deleteRole(roleId: number): Promise<{ success: boolean; detail: string }> {
    const res = await api.delete<{ success: boolean; detail: string }>(
      `/authorization/roles/${roleId}/`
    );
    return res.data;
  },

  async getPermissionMatrix(): Promise<PermissionMatrixModule[]> {
    const res = await api.get<{ success: boolean; modules: PermissionMatrixModule[] }>(
      "/authorization/permissions/matrix/"
    );
    return res.data.modules;
  },
};
