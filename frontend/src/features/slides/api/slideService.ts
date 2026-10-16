import { api } from "../../../services/api";
import {
  SlideDeckResponse,
  SlideFilterState,
  SlideMasterTableResponse,
  SlideDetailData,
  SlideHierarchyRootResponse,
  SlideHierarchyNodeResponse,
} from "../types/slide.types";
import { CockpitFiltersData } from "../../dashboard/types/cockpit.types";

export const slideService = {
  async getFilters(): Promise<CockpitFiltersData> {
    const res = await api.get<{ success: boolean; filters: CockpitFiltersData }>("/dashboard/filters/");
    return res.data.filters;
  },

  async getSlideDeck(filters?: Partial<SlideFilterState>): Promise<SlideDeckResponse> {
    const params = new URLSearchParams();
    if (filters?.companyId) params.set("company_id", String(filters.companyId));
    if (filters?.projectId) params.set("project_id", String(filters.projectId));
    if (filters?.circleId) params.set("circle_id", String(filters.circleId));
    if (filters?.domainId) params.set("domain_id", String(filters.domainId));
    if (filters?.periodId) params.set("period_id", String(filters.periodId));
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search.trim());

    const res = await api.get<{ success: boolean; data: SlideDeckResponse }>(
      `/dashboard/slides/?${params.toString()}`
    );
    return res.data.data;
  },

  async getMasterTable(filters?: Partial<SlideFilterState>): Promise<SlideMasterTableResponse> {
    const params = new URLSearchParams();
    if (filters?.companyId) params.set("company_id", String(filters.companyId));
    if (filters?.projectId) params.set("project_id", String(filters.projectId));
    if (filters?.circleId) params.set("circle_id", String(filters.circleId));
    if (filters?.domainId) params.set("domain_id", String(filters.domainId));
    if (filters?.periodId) params.set("period_id", String(filters.periodId));
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search.trim());

    const res = await api.get<{ success: boolean; data: SlideMasterTableResponse }>(
      `/dashboard/slide-master/?${params.toString()}`
    );
    return res.data.data;
  },

  async getRecordDetail(recordId: number): Promise<SlideDetailData> {
    const res = await api.get<{ success: boolean; data: SlideDetailData }>(
      `/dashboard/slide-detail/${recordId}/`
    );
    return res.data.data;
  },

  async getHierarchyRoot(periodId?: number): Promise<SlideHierarchyRootResponse> {
    const params = new URLSearchParams();
    if (periodId) params.set("period_id", String(periodId));
    const res = await api.get<{ success: boolean; data: SlideHierarchyRootResponse }>(
      `/dashboard/slide-hierarchy/?${params.toString()}`
    );
    return res.data.data;
  },

  async getHierarchyNode(level: string, id: number, periodId?: number): Promise<SlideHierarchyNodeResponse> {
    const params = new URLSearchParams();
    if (periodId) params.set("period_id", String(periodId));
    const res = await api.get<{ success: boolean; data: SlideHierarchyNodeResponse }>(
      `/dashboard/slide-hierarchy/${encodeURIComponent(level.toLowerCase())}/${id}/?${params.toString()}`
    );
    return res.data.data;
  },
};
