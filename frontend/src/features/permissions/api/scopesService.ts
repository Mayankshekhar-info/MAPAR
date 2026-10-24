import { api } from "../../../services/api";
import { AccessScopeListItem, AssignScopePayload } from "../types/scopes.types";

export const scopesService = {
  async getScopes(userId?: number | null): Promise<AccessScopeListItem[]> {
    const q = new URLSearchParams();
    if (userId) q.set("user_id", String(userId));

    const res = await api.get<{ success: boolean; scopes: AccessScopeListItem[] }>(
      `/authorization/scopes/?${q.toString()}`
    );
    return res.data.scopes;
  },

  async assignScope(payload: AssignScopePayload): Promise<AccessScopeListItem> {
    const res = await api.post<{ success: boolean; scope: AccessScopeListItem }>(
      "/authorization/scopes/",
      payload
    );
    return res.data.scope;
  },

  async deleteScope(scopeId: number): Promise<{ success: boolean; detail: string }> {
    const res = await api.delete<{ success: boolean; detail: string }>(
      `/authorization/scopes/${scopeId}/`
    );
    return res.data;
  },
};
