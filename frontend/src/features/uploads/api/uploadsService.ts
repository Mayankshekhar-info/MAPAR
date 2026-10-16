/**
 * Uploads Module API Service.
 * Communicates with backend endpoints using centralized Axios instance.
 */

import { api } from "../../../services/api";
import {
  UploadsMeta,
  UploadTemplate,
  UploadTemplateVersion,
  ImportBatch,
  ImportValidationError,
  CreateTemplatePayload,
  CreateVersionPayload,
  UpdateVersionPayload,
  CompatibleKPI,
} from "../types/uploads.types";

export const uploadsService = {
  /**
   * Fetches metadata (hierarchy levels, data types, reporting periods)
   */
  async getMeta(): Promise<UploadsMeta> {
    const response = await api.get<UploadsMeta>("/uploads/meta/");
    return response.data;
  },

  /**
   * Lists templates with optional status and search filter
   */
  async getTemplates(status?: string, search?: string): Promise<UploadTemplate[]> {
    const params = new URLSearchParams();
    if (status && status !== "ALL") params.append("status", status);
    if (search && search.trim()) params.append("search", search.trim());

    const response = await api.get<{ success: boolean; templates: UploadTemplate[] }>(
      `/uploads/templates/?${params.toString()}`
    );
    return response.data.templates;
  },

  /**
   * Retrieves single template detail with versions and columns
   */
  async getTemplate(templateId: number): Promise<UploadTemplate> {
    const response = await api.get<{ success: boolean; template: UploadTemplate }>(
      `/uploads/templates/${templateId}/`
    );
    return response.data.template;
  },

  /**
   * Creates new user-defined template with v1 column schema
   */
  async createTemplate(payload: CreateTemplatePayload): Promise<UploadTemplate> {
    const response = await api.post<{ success: boolean; template: UploadTemplate }>(
      "/uploads/templates/",
      payload
    );
    return response.data.template;
  },

  /**
   * Creates a new version (v2, v3, etc.) for a template
   */
  async createTemplateVersion(templateId: number, payload: CreateVersionPayload): Promise<void> {
    await api.post(`/uploads/templates/${templateId}/version/`, payload);
  },

  /**
   * Updates an existing template version in-place without creating a new version
   */
  async updateTemplateVersion(
    templateId: number,
    versionId: number,
    payload: UpdateVersionPayload
  ): Promise<UploadTemplateVersion> {
    const response = await api.put<{ success: boolean; version: UploadTemplateVersion }>(
      `/uploads/templates/${templateId}/versions/${versionId}/`,
      payload
    );
    return response.data.version;
  },

  /**
   * Deletes an old or selected uploaded template version
   */
  async deleteTemplateVersion(
    templateId: number,
    versionId: number
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/uploads/templates/${templateId}/versions/${versionId}/`
    );
    return response.data;
  },

  /**
   * Dynamically generates and downloads the .xlsx template
   */
  async downloadTemplateExcel(templateId: number, versionId?: number, filename?: string): Promise<void> {
    const params = versionId ? `?version_id=${versionId}` : "";
    const response = await api.get(`/uploads/templates/${templateId}/download/${params}`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", filename || `template_${templateId}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Uploads an Excel file against a template version and triggers validation
   */
  async uploadBatchFile(
    file: File,
    templateId: number,
    versionId?: number,
    reportingPeriodId?: number | null,
    hierarchyScope?: {
      companyId?: number | null;
      subCompanyId?: number | null;
      projectId?: number | null;
      circleId?: number | null;
      departmentId?: number | null;
    },
    periodConfig?: {
      periodType?: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM" | null;
      reportingDate?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    },
    kpiId?: number | null
  ): Promise<ImportBatch> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("template_id", String(templateId));
    if (versionId) formData.append("version_id", String(versionId));
    if (reportingPeriodId) formData.append("reporting_period_id", String(reportingPeriodId));
    if (hierarchyScope?.companyId) formData.append("company_id", String(hierarchyScope.companyId));
    if (hierarchyScope?.subCompanyId) formData.append("sub_company_id", String(hierarchyScope.subCompanyId));
    if (hierarchyScope?.projectId) formData.append("project_id", String(hierarchyScope.projectId));
    if (hierarchyScope?.circleId) formData.append("circle_id", String(hierarchyScope.circleId));
    if (hierarchyScope?.departmentId) formData.append("department_id", String(hierarchyScope.departmentId));

    if (periodConfig?.periodType) formData.append("reporting_period_type", periodConfig.periodType);
    if (periodConfig?.reportingDate) formData.append("reporting_date", periodConfig.reportingDate);
    if (periodConfig?.startDate) formData.append("start_date", periodConfig.startDate);
    if (periodConfig?.endDate) formData.append("end_date", periodConfig.endDate);
    if (kpiId) formData.append("kpi_id", String(kpiId));

    const response = await api.post<{ success: boolean; batch: ImportBatch }>(
      "/uploads/batches/upload/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data.batch;
  },

  /**
   * Retrieves compatible KPIs evaluated against a template's schema
   */
  async getCompatibleKPIs(templateId: number): Promise<CompatibleKPI[]> {
    const response = await api.get<{ success: boolean; kpis: CompatibleKPI[] }>(
      `/uploads/templates/${templateId}/compatible-kpis/`
    );
    return response.data.kpis;
  },

  /**
   * Evaluates or recalculates a KPI on a specific uploaded batch
   */
  async processBatchKPI(
    batchIdentifier: string,
    kpiId: number
  ): Promise<{ success: boolean; batch: ImportBatch; result?: unknown }> {
    const response = await api.post<{
      success: boolean;
      batch: ImportBatch;
      result?: unknown;
    }>(`/uploads/batches/${batchIdentifier}/process-kpi/`, {
      kpi_id: kpiId,
    });
    return response.data;
  },


  /**
   * Lists import batches / history with filters
   */
  async getBatches(filters?: {
    templateId?: number;
    status?: string;
    reportingPeriodId?: number;
    search?: string;
  }): Promise<ImportBatch[]> {
    const params = new URLSearchParams();
    if (filters?.templateId) params.append("template_id", String(filters.templateId));
    if (filters?.status && filters.status !== "ALL") params.append("status", filters.status);
    if (filters?.reportingPeriodId) params.append("reporting_period_id", String(filters.reportingPeriodId));
    if (filters?.search && filters.search.trim()) params.append("search", filters.search.trim());

    const response = await api.get<{ success: boolean; batches: ImportBatch[] }>(
      `/uploads/batches/?${params.toString()}`
    );
    return response.data.batches;
  },

  /**
   * Retrieves single batch details and lineage
   */
  async getBatch(identifier: string): Promise<ImportBatch> {
    const response = await api.get<{ success: boolean; batch: ImportBatch }>(
      `/uploads/batches/${identifier}/`
    );
    return response.data.batch;
  },

  /**
   * Retrieves paginated validation errors for a batch
   */
  async getBatchErrors(
    identifier: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ total: number; errors: ImportValidationError[] }> {
    const response = await api.get<{
      success: boolean;
      total: number;
      limit: number;
      offset: number;
      errors: ImportValidationError[];
    }>(`/uploads/batches/${identifier}/errors/?limit=${limit}&offset=${offset}`);
    return { total: response.data.total, errors: response.data.errors };
  },

  /**
   * Downloads error report workbook as Excel
   */
  async downloadBatchErrorReport(identifier: string): Promise<void> {
    const response = await api.get(`/uploads/batches/${identifier}/errors/export/`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", `${identifier}_error_report.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Commits valid records of the batch into MAPAR database
   */
  async commitBatch(identifier: string): Promise<{ success: boolean; committed_rows: number }> {
    const response = await api.post<{ success: boolean; committed_rows: number }>(
      `/uploads/batches/${identifier}/commit/`
    );
    return response.data;
  },
};
