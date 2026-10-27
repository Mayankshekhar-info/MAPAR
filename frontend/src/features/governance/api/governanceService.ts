import { api } from "../../../services/api";
import {
  GovernanceActionPoint,
  GovernanceFilterParams,
  GovernanceListResponse,
  GovernanceMetadata,
  GovernanceMetrics,
  GovernanceTargetRevision,
  GovernanceEvidenceItem,
  GovernanceWeeklyUpdate,
  TaskFullDetailResponse,
  CreateActionPayload,
  UpdateActionPayload,
  ReviseTargetPayload,
  ReviewEvidencePayload,
  SubmitWeeklyUpdatePayload,
  BulkUpdateActionsPayload,
  BulkWeeklySubmitPayload,
  BulkEvidenceReviewPayload,
  BulkOperationResult,
  ExcelUploadResponse,
  MyEvidenceListResponse,
  SimpleUser,
  WeeklyExcelPreviewData,
  WeeklyExcelUploadResponse,
  GovernanceTargetRevisionRequest,
  SubmitTargetRevisionRequestPayload,
  ReviewTargetRevisionRequestPayload,
  RevisionRequestsListResponse,
  SendUrgentFollowUpResponse,
  StatusMatrixEmailPreviewResponse,
  StatusMatrixEmailSendPayload,
  StatusMatrixEmailSendResponse,
  OwnerEmailPreviewResponse,
  OwnerEmailSendPayload,
  OwnerEmailSendResponse,
  GovernanceTaskReview,
  AssignTaskReviewPayload,
  SubmitReviewPayload,
  UpdateTaskReviewPayload,
  SubmitForVerificationPayload,
  VerifyReviewPayload,
  ApproveReviewPayload,
} from "../types/governance.types";


export const governanceService = {
  async getActions(params: GovernanceFilterParams = {}): Promise<GovernanceListResponse> {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.circle_id) q.set("circle_id", String(params.circle_id));
    if (params.owner_id) q.set("owner_id", String(params.owner_id));
    if (params.owner_name) q.set("owner_name", params.owner_name);
    if (params.status && params.status !== "ALL") q.set("status", params.status);
    if (params.evidence_status && params.evidence_status !== "ALL") q.set("evidence_status", params.evidence_status);
    if (params.view_mode) q.set("view_mode", params.view_mode);
    if (params.hierarchy_level && params.hierarchy_level !== "ALL") q.set("hierarchy_level", params.hierarchy_level);
    if (params.hierarchy_node_id) q.set("hierarchy_node_id", String(params.hierarchy_node_id));
    if (params.priority && params.priority !== "ALL") q.set("priority", params.priority);
    if (params.function_area && params.function_area !== "ALL") q.set("function_area", params.function_area);
    if (params.is_escalated !== undefined) q.set("is_escalated", String(params.is_escalated));
    if (params.is_overdue !== undefined) q.set("is_overdue", String(params.is_overdue));
    if (params.is_due_soon !== undefined) q.set("is_due_soon", String(params.is_due_soon));
    if (params.reporting_week && params.reporting_week !== "ALL") q.set("reporting_week", params.reporting_week);
    if (params.start_date) q.set("start_date", params.start_date);
    if (params.end_date) q.set("end_date", params.end_date);
    if (params.ageing_bucket && params.ageing_bucket !== "ALL") q.set("ageing_bucket", params.ageing_bucket);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    if (params.ordering) q.set("ordering", params.ordering);

    const res = await api.get<GovernanceListResponse>(`/governance/actions/?${q.toString()}`);
    return res.data;
  },

  async getActionDetail(id: number): Promise<GovernanceActionPoint> {
    const res = await api.get<{ success: boolean; action: GovernanceActionPoint }>(`/governance/actions/${id}/`);
    return res.data.action;
  },

  async getFullDetail(id: number): Promise<TaskFullDetailResponse> {
    const res = await api.get<TaskFullDetailResponse>(`/governance/actions/${id}/full-detail/`);
    return res.data;
  },

  async createAction(payload: CreateActionPayload): Promise<GovernanceActionPoint> {
    const res = await api.post<{ success: boolean; action: GovernanceActionPoint }>("/governance/actions/", payload);
    return res.data.action;
  },

  async updateAction(id: number, payload: UpdateActionPayload): Promise<GovernanceActionPoint> {
    const res = await api.patch<{ success: boolean; action: GovernanceActionPoint }>(`/governance/actions/${id}/`, payload);
    return res.data.action;
  },

  async deleteAction(id: number): Promise<void> {
    await api.delete(`/governance/actions/${id}/`);
  },

  async reviseTarget(id: number, payload: ReviseTargetPayload): Promise<{ revision: GovernanceTargetRevision; action: GovernanceActionPoint }> {
    const res = await api.post<{ success: boolean; revision: GovernanceTargetRevision; action: GovernanceActionPoint }>(
      `/governance/actions/${id}/revise-target/`,
      payload
    );
    return res.data;
  },

  async getRevisions(id: number): Promise<GovernanceTargetRevision[]> {
    const res = await api.get<{ success: boolean; revisions: GovernanceTargetRevision[] }>(`/governance/actions/${id}/revisions/`);
    return res.data.revisions;
  },

  async getWeeklyUpdates(actionId: number): Promise<GovernanceWeeklyUpdate[]> {
    const res = await api.get<{ success: boolean; weekly_updates: GovernanceWeeklyUpdate[] }>(
      `/governance/actions/${actionId}/weekly-updates/`
    );
    return res.data.weekly_updates;
  },

  async submitWeeklyUpdate(actionId: number, payload: SubmitWeeklyUpdatePayload): Promise<GovernanceWeeklyUpdate> {
    const res = await api.post<{ success: boolean; weekly_update: GovernanceWeeklyUpdate }>(
      `/governance/actions/${actionId}/weekly-updates/`,
      payload
    );
    return res.data.weekly_update;
  },

  async reviseWeeklyUpdate(updateId: number, payload: Partial<SubmitWeeklyUpdatePayload>): Promise<GovernanceWeeklyUpdate> {
    const res = await api.patch<{ success: boolean; weekly_update: GovernanceWeeklyUpdate }>(
      `/governance/weekly-updates/${updateId}/`,
      payload
    );
    return res.data.weekly_update;
  },

  async bulkUpdateActions(payload: BulkUpdateActionsPayload): Promise<BulkOperationResult> {
    const res = await api.post<{ success: boolean; bulk_result: BulkOperationResult }>(
      "/governance/actions/bulk-update/",
      payload
    );
    return res.data.bulk_result;
  },

  async bulkSubmitWeekly(payload: BulkWeeklySubmitPayload): Promise<BulkOperationResult> {
    const res = await api.post<{ success: boolean; bulk_result: BulkOperationResult }>(
      "/governance/weekly-updates/bulk-submit/",
      payload
    );
    return res.data.bulk_result;
  },

  async bulkReviewEvidence(payload: BulkEvidenceReviewPayload): Promise<BulkOperationResult> {
    const res = await api.post<{ success: boolean; bulk_result: BulkOperationResult }>(
      "/governance/evidence/bulk-review/",
      payload
    );
    return res.data.bulk_result;
  },

  async getHierarchyUsers(level?: string, nodeId?: number, search?: string): Promise<SimpleUser[]> {
    const q = new URLSearchParams();
    if (level) q.set("level", level);
    if (nodeId) q.set("node_id", String(nodeId));
    if (search) q.set("search", search);
    const res = await api.get<{ success: boolean; users: SimpleUser[] }>(`/governance/hierarchy-users/?${q.toString()}`);
    return res.data.users;
  },

  async getActionEvidence(id: number): Promise<GovernanceEvidenceItem[]> {
    const res = await api.get<{ success: boolean; evidence_items: GovernanceEvidenceItem[] }>(`/governance/actions/${id}/evidence/`);
    return res.data.evidence_items;
  },

  async uploadEvidence(
    actionId: number,
    file: File,
    title: string,
    description?: string,
    reportingWeek?: string
  ): Promise<{ evidence: GovernanceEvidenceItem; message: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    if (description) formData.append("description", description);
    if (reportingWeek) formData.append("reporting_week", reportingWeek);

    const res = await api.post<{ success: boolean; evidence: GovernanceEvidenceItem; message: string }>(
      `/governance/actions/${actionId}/evidence/`,
      formData
    );
    return res.data;
  },

  async reviewEvidence(evidenceId: number, payload: ReviewEvidencePayload): Promise<{ evidence: GovernanceEvidenceItem; message: string }> {
    const res = await api.post<{ success: boolean; evidence: GovernanceEvidenceItem; message: string }>(
      `/governance/evidence/${evidenceId}/review/`,
      payload
    );
    return res.data;
  },

  async downloadEvidence(evidenceId: number, fileName: string): Promise<void> {
    const res = await api.get(`/governance/evidence/${evidenceId}/download/`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data]);
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName || `evidence_${evidenceId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  },

  async getMyEvidence(params: { search?: string; page?: number; page_size?: number } = {}): Promise<MyEvidenceListResponse> {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));

    const res = await api.get<MyEvidenceListResponse>(`/governance/my-evidence/?${q.toString()}`);
    return res.data;
  },

  async getMetrics(circleId?: number | null, reportingWeek?: string | null): Promise<GovernanceMetrics> {
    const q = new URLSearchParams();
    if (circleId) q.set("circle_id", String(circleId));
    if (reportingWeek) q.set("reporting_week", reportingWeek);
    const res = await api.get<{ success: boolean; metrics: GovernanceMetrics }>(`/governance/metrics/?${q.toString()}`);
    return res.data.metrics;
  },

  async getMetadata(): Promise<GovernanceMetadata> {
    const res = await api.get<{ success: boolean; metadata: GovernanceMetadata }>("/governance/meta/");
    return res.data.metadata;
  },

  async downloadTemplate(): Promise<void> {
    const res = await api.get("/governance/excel/template/", {
      responseType: "blob",
    });
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "Governance_Action_Tracking_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  },

  async uploadExcel(file: File): Promise<ExcelUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<ExcelUploadResponse>("/governance/excel/upload/", formData);
    return res.data;
  },

  async downloadWeeklyTemplate(): Promise<void> {
    const res = await api.get("/governance/weekly-updates/template/", {
      responseType: "blob",
    });
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "MAPAR_Weekly_Task_Update_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  },

  async previewWeeklyExcel(file: File): Promise<{ success: boolean; preview: WeeklyExcelPreviewData }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<{ success: boolean; preview: WeeklyExcelPreviewData }>(
      "/governance/weekly-updates/preview-excel/",
      formData
    );
    return res.data;
  },

  async uploadWeeklyExcel(file: File, allowRevision: boolean = false): Promise<WeeklyExcelUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (allowRevision) formData.append("allow_revision", "true");
    const res = await api.post<WeeklyExcelUploadResponse>(
      "/governance/weekly-updates/upload-excel/",
      formData
    );
    return res.data;
  },

  async exportWeeklyErrorReport(errorReport: any[]): Promise<void> {
    const res = await api.post(
      "/governance/weekly-updates/export-error-report/",
      { error_report: errorReport },
      { responseType: "blob" }
    );
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "Weekly_Update_Upload_Error_Report.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  },

  async exportGovernanceWorkbook(filters?: GovernanceFilterParams): Promise<void> {
    const q = new URLSearchParams();
    if (filters) {
      if (filters.search) q.append("search", filters.search);
      if (filters.circle_id) q.append("circle_id", String(filters.circle_id));
      if (filters.owner_id) q.append("owner_id", String(filters.owner_id));
      if (filters.status && filters.status !== "ALL") q.append("status", filters.status);
      if (filters.priority && filters.priority !== "ALL") q.append("priority", filters.priority);
      if (filters.view_mode) q.append("view_mode", filters.view_mode);
      if (filters.is_overdue !== undefined) q.append("is_overdue", String(filters.is_overdue));
      if (filters.is_escalated !== undefined) q.append("is_escalated", String(filters.is_escalated));
    }
    const res = await api.get(`/governance/excel/export/?${q.toString()}`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "Governance & Action Tracking.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  },

  async submitTargetRevisionRequest(
    actionId: number,
    payload: SubmitTargetRevisionRequestPayload
  ): Promise<{ success: boolean; revision_request: GovernanceTargetRevisionRequest; message: string }> {
    const res = await api.post<{ success: boolean; revision_request: GovernanceTargetRevisionRequest; message: string }>(
      `/governance/actions/${actionId}/revision-requests/`,
      payload
    );
    return res.data;
  },

  async getActionRevisionRequests(
    actionId: number
  ): Promise<{ success: boolean; revision_requests: GovernanceTargetRevisionRequest[] }> {
    const res = await api.get<{ success: boolean; revision_requests: GovernanceTargetRevisionRequest[] }>(
      `/governance/actions/${actionId}/revision-requests/`
    );
    return res.data;
  },

  async getRevisionRequests(
    params: { status?: string; circle_id?: number; search?: string; page?: number; page_size?: number } = {}
  ): Promise<RevisionRequestsListResponse> {
    const q = new URLSearchParams();
    if (params.status && params.status !== "ALL") q.set("status", params.status);
    if (params.circle_id) q.set("circle_id", String(params.circle_id));
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));

    const res = await api.get<RevisionRequestsListResponse>(`/governance/revision-requests/?${q.toString()}`);
    return res.data;
  },

  async reviewTargetRevisionRequest(
    requestId: number,
    payload: ReviewTargetRevisionRequestPayload
  ): Promise<{ success: boolean; revision_request: GovernanceTargetRevisionRequest; message: string }> {
    const res = await api.post<{ success: boolean; revision_request: GovernanceTargetRevisionRequest; message: string }>(
      `/governance/revision-requests/${requestId}/review/`,
      payload
    );
    return res.data;
  },

  async sendUrgentFollowUpEmail(actionId: number, recipientUserId?: number): Promise<SendUrgentFollowUpResponse> {
    const payload = recipientUserId ? { recipient_user_id: recipientUserId } : {};
    const res = await api.post<SendUrgentFollowUpResponse>(`/governance/actions/${actionId}/send-email/`, payload);
    return res.data;
  },

  async getStatusMatrixEmailPreview(params?: { reporting_week?: string; circle_id?: number | null }): Promise<StatusMatrixEmailPreviewResponse> {
    const q = new URLSearchParams();
    if (params?.reporting_week && params.reporting_week !== "ALL") q.set("reporting_week", params.reporting_week);
    if (params?.circle_id) q.set("circle_id", String(params.circle_id));
    const res = await api.get<StatusMatrixEmailPreviewResponse>(`/governance/status-matrix/email-preview/?${q.toString()}`);
    return res.data;
  },

  async sendStatusMatrixEmails(payload: StatusMatrixEmailSendPayload = {}): Promise<StatusMatrixEmailSendResponse> {
    const res = await api.post<StatusMatrixEmailSendResponse>("/governance/status-matrix/send-emails/", payload);
    return res.data;
  },

  async getOwnerEmailPreview(ownerId: number, ownerName?: string): Promise<OwnerEmailPreviewResponse> {
    const q = new URLSearchParams();
    if (ownerName) q.set("name", ownerName);
    const res = await api.get<OwnerEmailPreviewResponse>(`/governance/owners/${ownerId}/email-preview/?${q.toString()}`);
    return res.data;
  },

  async sendOwnerEmail(ownerId: number, payload: OwnerEmailSendPayload = {}): Promise<OwnerEmailSendResponse> {
    const res = await api.post<OwnerEmailSendResponse>(`/governance/owners/${ownerId}/send-email/`, payload);
    return res.data;
  },

  async assignTaskReview(
    actionId: number,
    payload: AssignTaskReviewPayload
  ): Promise<{ success: boolean; review: GovernanceTaskReview; message: string }> {
    const res = await api.post<{ success: boolean; review: GovernanceTaskReview; message: string }>(
      `/governance/actions/${actionId}/assign-review/`,
      payload
    );
    return res.data;
  },

  async updateTaskReview(
    actionId: number,
    reviewId: number,
    payload: UpdateTaskReviewPayload
  ): Promise<{ success: boolean; review: GovernanceTaskReview; message: string }> {
    const res = await api.patch<{ success: boolean; review: GovernanceTaskReview; message: string }>(
      `/governance/actions/${actionId}/reviews/${reviewId}/`,
      payload
    );
    return res.data;
  },

  async getTaskReviews(actionId: number): Promise<GovernanceTaskReview[]> {
    const res = await api.get<{ success: boolean; reviews: GovernanceTaskReview[] }>(
      `/governance/actions/${actionId}/reviews/`
    );
    return res.data.reviews;
  },

  async submitTaskForVerification(
    actionId: number,
    payload: SubmitForVerificationPayload = {}
  ): Promise<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }> {
    const res = await api.post<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }>(
      `/governance/actions/${actionId}/submit-for-review/`,
      payload
    );
    return res.data;
  },

  async submitTaskReview(
    actionId: number,
    payload: SubmitReviewPayload
  ): Promise<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }> {
    const res = await api.post<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }>(
      `/governance/actions/${actionId}/submit-review/`,
      payload
    );
    return res.data;
  },

  async verifyTaskReview(
    actionId: number,
    payload: VerifyReviewPayload
  ): Promise<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }> {
    const res = await api.post<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }>(
      `/governance/actions/${actionId}/verify-review/`,
      payload
    );
    return res.data;
  },

  async approveTaskReview(
    actionId: number,
    payload: ApproveReviewPayload
  ): Promise<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }> {
    const res = await api.post<{ success: boolean; review: GovernanceTaskReview; action: GovernanceActionPoint; message: string }>(
      `/governance/actions/${actionId}/approve-review/`,
      payload
    );
    return res.data;
  },
};



