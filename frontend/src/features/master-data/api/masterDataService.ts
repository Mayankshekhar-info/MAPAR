import { api } from "../../../services/api";
import {
  MasterDataMeta,
  MasterDataRecordsResponse,
  MasterDataFilterState,
  MasterDataRecord,
  UploadMasterDataPayload,
} from "../types/masterData.types";

export const masterDataService = {
  getMeta: async (): Promise<MasterDataMeta> => {
    const res = await api.get<{ success: boolean; data: MasterDataMeta }>("/master-data/meta/");
    return res.data.data;
  },

  getRecords: async (filters: Partial<MasterDataFilterState>): Promise<MasterDataRecordsResponse> => {
    const params: Record<string, any> = {};
    if (filters.templateId) params.template_id = filters.templateId;
    if (filters.companyId) params.company_id = filters.companyId;
    if (filters.subCompanyId) params.sub_company_id = filters.subCompanyId;
    if (filters.projectId) params.project_id = filters.projectId;
    if (filters.circleId) params.circle_id = filters.circleId;
    if (filters.departmentId) params.department_id = filters.departmentId;
    if (filters.periodId) params.period_id = filters.periodId;
    if (filters.batchId) params.batch_id = filters.batchId;
    if (filters.search) params.search = filters.search;
    if (filters.isValid !== undefined && filters.isValid !== null) params.is_valid = filters.isValid;
    if (filters.page !== undefined && filters.pageSize !== undefined) {
      params.limit = filters.pageSize;
      params.offset = filters.page * filters.pageSize;
    }
    if (filters.sortBy) params.sort_by = filters.sortBy;
    if (filters.sortOrder) params.sort_order = filters.sortOrder;

    const res = await api.get<{ success: boolean; data: MasterDataRecordsResponse }>("/master-data/records/", { params });
    return res.data.data;
  },

  getRecord: async (id: number): Promise<MasterDataRecord> => {
    const res = await api.get<{ success: boolean; data: MasterDataRecord }>(`/master-data/records/${id}/`);
    return res.data.data;
  },

  updateRecord: async (id: number, rawData: Record<string, any>): Promise<any> => {
    const res = await api.patch<{ success: boolean; data: any }>(`/master-data/records/${id}/`, {
      raw_data: rawData,
    });
    return res.data.data;
  },

  uploadExcel: async (payload: UploadMasterDataPayload): Promise<any> => {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.template_id) formData.append("template_id", String(payload.template_id));
    if (payload.version_id) formData.append("version_id", String(payload.version_id));
    if (payload.company_id) formData.append("company_id", String(payload.company_id));
    if (payload.sub_company_id) formData.append("sub_company_id", String(payload.sub_company_id));
    if (payload.project_id) formData.append("project_id", String(payload.project_id));
    if (payload.circle_id) formData.append("circle_id", String(payload.circle_id));
    if (payload.department_id) formData.append("department_id", String(payload.department_id));
    if (payload.reporting_period_id) formData.append("reporting_period_id", String(payload.reporting_period_id));
    if (payload.import_mode) formData.append("import_mode", payload.import_mode);

    const res = await api.post("/master-data/upload/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  exportExcel: async (filters: Partial<MasterDataFilterState>): Promise<void> => {
    const params: Record<string, any> = {};
    if (filters.templateId) params.template_id = filters.templateId;
    if (filters.companyId) params.company_id = filters.companyId;
    if (filters.subCompanyId) params.sub_company_id = filters.subCompanyId;
    if (filters.projectId) params.project_id = filters.projectId;
    if (filters.circleId) params.circle_id = filters.circleId;
    if (filters.departmentId) params.department_id = filters.departmentId;
    if (filters.periodId) params.period_id = filters.periodId;
    if (filters.batchId) params.batch_id = filters.batchId;
    if (filters.search) params.search = filters.search;

    const res = await api.get("/master-data/export/", {
      params,
      responseType: "blob",
    });

    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `master_data_export.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
