import { api } from "../../../services/api";
import {
  CockpitFiltersData,
  CockpitFilterState,
  MasterSummaryResponse,
  DetailBreakdownResponse,
  DeepRecordDetail,
} from "../types/cockpit.types";

export const cockpitService = {
  async getFilters(): Promise<CockpitFiltersData> {
    const res = await api.get<{ success: boolean; filters: CockpitFiltersData }>("/dashboard/filters/");
    return res.data.filters;
  },

  async getMasterSummary(filters?: Partial<CockpitFilterState>): Promise<MasterSummaryResponse> {
    const params = new URLSearchParams();
    if (filters?.companyId) params.set("company_id", String(filters.companyId));
    if (filters?.subCompanyId) params.set("sub_company_id", String(filters.subCompanyId));
    if (filters?.projectId) params.set("project_id", String(filters.projectId));
    if (filters?.circleId) params.set("circle_id", String(filters.circleId));
    if (filters?.domainId) params.set("domain_id", String(filters.domainId));
    if (filters?.departmentId) params.set("department_id", String(filters.departmentId));
    if (filters?.periodId) params.set("period_id", String(filters.periodId));
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search.trim());

    const res = await api.get<{ success: boolean; data: MasterSummaryResponse }>(
      `/dashboard/summary/?${params.toString()}`
    );
    return res.data.data;
  },

  async getDetailBreakdown(
    circleId: number,
    domainId?: number | null,
    periodId?: number | null,
    status?: string | null,
    search?: string | null
  ): Promise<DetailBreakdownResponse> {
    const params = new URLSearchParams();
    params.set("circle_id", String(circleId));
    if (domainId) params.set("domain_id", String(domainId));
    if (periodId) params.set("period_id", String(periodId));
    if (status && status !== "ALL") params.set("status", status);
    if (search) params.set("search", search.trim());

    const res = await api.get<{ success: boolean; data: DetailBreakdownResponse }>(
      `/dashboard/detail/?${params.toString()}`
    );
    return res.data.data;
  },

  async getRecordDetail(recordId: number): Promise<DeepRecordDetail> {
    const res = await api.get<{ success: boolean; record: DeepRecordDetail }>(
      `/dashboard/record/${recordId}/`
    );
    return res.data.record;
  },

  async exportCsv(filters?: Partial<CockpitFilterState>): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters?.circleId) params.set("circle_id", String(filters.circleId));
    if (filters?.domainId) params.set("domain_id", String(filters.domainId));
    if (filters?.periodId) params.set("period_id", String(filters.periodId));
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search.trim());

    const res = await api.get(`/dashboard/export/?${params.toString()}`, {
      responseType: "blob",
    });
    return res.data;
  },
};
