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

  parseFormulaConfiguration: async (
    file: File,
    customMapping?: Record<string, string>,
    targetSheet?: string
  ): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    if (customMapping && Object.keys(customMapping).length > 0) {
      formData.append("custom_mapping", JSON.stringify(customMapping));
    }
    if (targetSheet) {
      formData.append("target_sheet", targetSheet);
    }
    const res = await api.post("/kpi/configuration/parse/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  activateConfiguration: async (payload: {
    file?: File;
    file_hash?: string;
    original_filename?: string;
    approved_kpis: any[];
    scope_type: "ENTERPRISE" | "COMPANY" | "PROJECT" | "CIRCLE";
    company_id?: number | null;
    project_id?: number | null;
    circle_id?: number | null;
    hierarchy_level?: string | null;
    hierarchy_id?: number | null;
    is_inheritance_allowed?: boolean;
    changelog?: string;
  }): Promise<{ success: boolean; message: string; version_number: number; activated_count: number }> => {
    const formData = new FormData();
    if (payload.file) {
      formData.append("file", payload.file);
    }
    if (payload.file_hash) formData.append("file_hash", payload.file_hash);
    if (payload.original_filename) formData.append("original_filename", payload.original_filename);
    formData.append("approved_kpis", JSON.stringify(payload.approved_kpis));
    formData.append("scope_type", payload.scope_type);
    if (payload.company_id) formData.append("company_id", String(payload.company_id));
    if (payload.project_id) formData.append("project_id", String(payload.project_id));
    if (payload.circle_id) formData.append("circle_id", String(payload.circle_id));
    if (payload.hierarchy_level) formData.append("hierarchy_level", payload.hierarchy_level);
    if (payload.hierarchy_id) formData.append("hierarchy_id", String(payload.hierarchy_id));
    if (payload.is_inheritance_allowed !== undefined) {
      formData.append("is_inheritance_allowed", String(payload.is_inheritance_allowed));
    }
    if (payload.changelog) formData.append("changelog", payload.changelog);

    const res = await api.post("/kpi/configuration/activate/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  fetchConfigurationVersions: async (params?: {
    scope_type?: string;
    company_id?: number;
    project_id?: number;
    circle_id?: number;
  }): Promise<{ success: boolean; versions: any[] }> => {
    const res = await api.get("/kpi/configuration/versions/", { params });
    return res.data;
  },

  downloadFormulaTemplate: async (): Promise<Blob> => {
    const res = await api.get("/kpi/configuration/template/", {
      responseType: "blob",
    });
    return res.data;
  },

  syncCanonicalKPIs: async (): Promise<{ success: boolean; message: string; count: number }> => {
    const res = await api.post("/kpi/sync-canonical/");
    return res.data;
  },
};

