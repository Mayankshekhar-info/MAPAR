import { api } from "../../../services/api";
import {
  KPIDefinition,
  CreateKPIDefinitionPayload,
  DatasetInfo,
  DatasetField,
  KPIDashboardCard,
  KPIDiagnosticsData,
  KPIRefinedRecordsResponse,
  KPITestLogicPayload,
  KPITestLogicResult,
} from "../types/kpi";

export const kpiService = {
  fetchDefinitions: async (params?: {
    search?: string;
    is_active?: boolean;
    domain_id?: number;
    hierarchy_level?: string;
  }): Promise<KPIDefinition[]> => {
    const res = await api.get<KPIDefinition[]>("/kpi/definitions/", { params });
    return res.data;
  },

  fetchDefinitionById: async (id: number): Promise<KPIDefinition> => {
    const res = await api.get<KPIDefinition>(`/kpi/definitions/${id}/`);
    return res.data;
  },

  createDefinition: async (payload: CreateKPIDefinitionPayload): Promise<KPIDefinition> => {
    const res = await api.post<KPIDefinition>("/kpi/definitions/", payload);
    return res.data;
  },

  updateDefinition: async (
    id: number,
    payload: Partial<CreateKPIDefinitionPayload>
  ): Promise<KPIDefinition> => {
    const res = await api.put<KPIDefinition>(`/kpi/definitions/${id}/`, payload);
    return res.data;
  },

  deleteDefinition: async (id: number): Promise<void> => {
    await api.delete(`/kpi/definitions/${id}/`);
  },

  duplicateDefinition: async (id: number): Promise<KPIDefinition> => {
    const res = await api.post<KPIDefinition>(`/kpi/definitions/${id}/duplicate/`);
    return res.data;
  },

  validateFormula: async (
    formula: string,
    variables: string[]
  ): Promise<{ is_valid: boolean; error: string | null; detected_variables: string[] }> => {
    const res = await api.post("/kpi/validate-formula/", { formula, variables });
    return res.data;
  },

  testLogic: async (payload: KPITestLogicPayload): Promise<KPITestLogicResult> => {
    const res = await api.post<KPITestLogicResult>("/kpi/test-logic/", payload);
    return res.data;
  },

  fetchDatasets: async (): Promise<DatasetInfo[]> => {
    const res = await api.get<DatasetInfo[]>("/kpi/sources/datasets/");
    return res.data;
  },

  fetchDatasetFields: async (datasetId: number): Promise<DatasetField[]> => {
    const res = await api.get<DatasetField[]>(`/kpi/sources/datasets/${datasetId}/fields/`);
    return res.data;
  },

  calculateKPI: async (
    kpiId: number,
    payload: { period_id?: number; hierarchy_level: string; hierarchy_id: number }
  ): Promise<any> => {
    const res = await api.post(`/kpi/definitions/${kpiId}/calculate/`, payload);
    return res.data;
  },

  fetchDashboardCards: async (params?: {
    period_id?: number;
    hierarchy_level?: string;
    hierarchy_id?: number;
  }): Promise<KPIDashboardCard[]> => {
    const res = await api.get<KPIDashboardCard[]>("/kpi/dashboard/cards/", { params });
    return res.data;
  },

  fetchDiagnostics: async (resultId: number): Promise<KPIDiagnosticsData> => {
    const res = await api.get<KPIDiagnosticsData>(`/kpi/results/${resultId}/diagnostics/`);
    return res.data;
  },

  fetchRefinedRecords: async (
    resultId: number,
    params?: { page?: number; page_size?: number; search?: string }
  ): Promise<KPIRefinedRecordsResponse> => {
    const res = await api.get<KPIRefinedRecordsResponse>(`/kpi/results/${resultId}/records/`, { params });
    return res.data;
  },
};
