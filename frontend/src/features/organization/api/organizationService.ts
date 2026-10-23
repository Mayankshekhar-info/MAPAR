import { api } from "../../../services/api";
import {
  HierarchyNode,
  HierarchySummary,
  NodeDetail,
  CreateNodePayload,
  UpdateNodePayload,
  CascadingOption,
  HierarchySearchResult,
  HierarchyLevel,
} from "../types/organization.types";

export const organizationService = {
  async getTree(): Promise<HierarchyNode[]> {
    const res = await api.get<{ success: boolean; tree: HierarchyNode[] }>("/organization/tree/");
    return res.data.tree;
  },

  async getSummary(): Promise<HierarchySummary> {
    const res = await api.get<{ success: boolean; counts: HierarchySummary }>("/organization/summary/");
    return res.data.counts;
  },

  async getOptions(
    level: HierarchyLevel,
    parentId?: number | null,
    filters?: {
      companyId?: number | null;
      subCompanyId?: number | null;
      projectId?: number | null;
      parentLevel?: string | null;
    }
  ): Promise<CascadingOption[]> {
    const params = new URLSearchParams();
    params.set("level", level);
    if (parentId) {
      params.set("parent_id", String(parentId));
    }
    if (filters?.companyId) {
      params.set("company_id", String(filters.companyId));
    }
    if (filters?.subCompanyId) {
      params.set("sub_company_id", String(filters.subCompanyId));
    }
    if (filters?.projectId) {
      params.set("project_id", String(filters.projectId));
    }
    if (filters?.parentLevel) {
      params.set("parent_level", filters.parentLevel);
    }
    const res = await api.get<{ success: boolean; options: CascadingOption[] }>(
      `/organization/options/?${params.toString()}`
    );
    return res.data.options;
  },

  async getNodeDetail(level: HierarchyLevel, nodeId: number): Promise<NodeDetail> {
    const res = await api.get<{ success: boolean; data: NodeDetail }>(
      `/organization/nodes/${level}/${nodeId}/`
    );
    return res.data.data;
  },

  async createNode(payload: CreateNodePayload): Promise<any> {
    const res = await api.post<{ success: boolean; node: any }>("/organization/nodes/", payload);
    return res.data.node;
  },

  async updateNode(level: HierarchyLevel, nodeId: number, payload: UpdateNodePayload): Promise<any> {
    const res = await api.put<{ success: boolean; node: any }>(
      `/organization/nodes/${level}/${nodeId}/update/`,
      payload
    );
    return res.data.node;
  },

  async deleteNode(level: HierarchyLevel, nodeId: number): Promise<{ success: boolean; message: string }> {
    const res = await api.delete<{ success: boolean; message: string }>(
      `/organization/nodes/${level}/${nodeId}/delete/`
    );
    return res.data;
  },

  async search(query: string): Promise<HierarchySearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    const res = await api.get<{ success: boolean; results: HierarchySearchResult[] }>(
      `/organization/search/?q=${encodeURIComponent(query.trim())}`
    );
    return res.data.results;
  },
};
