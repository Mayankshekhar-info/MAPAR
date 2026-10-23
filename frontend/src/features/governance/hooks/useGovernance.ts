import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceService } from "../api/governanceService";
import {
  GovernanceFilterParams,
  CreateActionPayload,
  UpdateActionPayload,
  ReviseTargetPayload,
  ReviewEvidencePayload,
  SubmitWeeklyUpdatePayload,
  BulkUpdateActionsPayload,
  BulkWeeklySubmitPayload,
  BulkEvidenceReviewPayload,
  SubmitTargetRevisionRequestPayload,
  ReviewTargetRevisionRequestPayload,
} from "../types/governance.types";

export const GOVERNANCE_KEYS = {
  all: ["governance"] as const,
  list: (params: GovernanceFilterParams) => ["governance", "list", params] as const,
  detail: (id: number) => ["governance", "detail", id] as const,
  fullDetail: (id: number) => ["governance", "fullDetail", id] as const,
  metrics: (circleId?: number | null, reportingWeek?: string | null) =>
    ["governance", "metrics", circleId ?? "all", reportingWeek ?? "current"] as const,
  metadata: () => ["governance", "metadata"] as const,
  revisions: (id: number) => ["governance", "revisions", id] as const,
  weeklyUpdates: (actionId: number) => ["governance", "weeklyUpdates", actionId] as const,
  evidence: (actionId: number) => ["governance", "evidence", actionId] as const,
  myEvidence: (params: { search?: string; page?: number; page_size?: number }) => ["governance", "myEvidence", params] as const,
  hierarchyUsers: (level?: string, nodeId?: number | null) => ["governance", "hierarchyUsers", level ?? "", nodeId ?? 0] as const,
  revisionRequests: (params?: any) => ["governance", "revisionRequests", params ?? {}] as const,
  actionRevisionRequests: (actionId: number) => ["governance", "actionRevisionRequests", actionId] as const,
};

export function useGovernanceList(params: GovernanceFilterParams = {}) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.list(params),
    queryFn: () => governanceService.getActions(params),
  });
}

export function useGovernanceDetail(actionId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.detail(actionId!),
    queryFn: () => governanceService.getActionDetail(actionId!),
    enabled: Boolean(actionId),
  });
}

export function useTaskFullDetail(actionId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.fullDetail(actionId!),
    queryFn: () => governanceService.getFullDetail(actionId!),
    enabled: Boolean(actionId),
  });
}

export function useWeeklyUpdates(actionId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.weeklyUpdates(actionId!),
    queryFn: () => governanceService.getWeeklyUpdates(actionId!),
    enabled: Boolean(actionId),
  });
}

export function useHierarchyUsers(level?: string, nodeId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.hierarchyUsers(level, nodeId),
    queryFn: () => governanceService.getHierarchyUsers(level, nodeId ?? undefined),
    enabled: Boolean(level),
  });
}

export function useGovernanceMetrics(circleId?: number | null, reportingWeek?: string | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.metrics(circleId, reportingWeek),
    queryFn: () => governanceService.getMetrics(circleId, reportingWeek),
  });
}

export function useGovernanceMetadata() {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.metadata(),
    queryFn: () => governanceService.getMetadata(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGovernanceRevisions(actionId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.revisions(actionId!),
    queryFn: () => governanceService.getRevisions(actionId!),
    enabled: Boolean(actionId),
  });
}

export function useActionEvidence(actionId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.evidence(actionId!),
    queryFn: () => governanceService.getActionEvidence(actionId!),
    enabled: Boolean(actionId),
  });
}

export function useMyEvidenceList(params: { search?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.myEvidence(params),
    queryFn: () => governanceService.getMyEvidence(params),
  });
}

export function useCreateGovernanceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateActionPayload) => governanceService.createAction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useUpdateGovernanceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateActionPayload }) =>
      governanceService.updateAction(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.id) });
    },
  });
}

export function useDeleteGovernanceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => governanceService.deleteAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useReviseTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReviseTargetPayload }) =>
      governanceService.reviseTarget(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.id) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.revisions(vars.id) });
    },
  });
}

export function useSubmitWeeklyUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: { actionId: number; payload: SubmitWeeklyUpdatePayload }) =>
      governanceService.submitWeeklyUpdate(actionId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.weeklyUpdates(vars.actionId) });
    },
  });
}

export function useBulkUpdateActions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkUpdateActionsPayload) => governanceService.bulkUpdateActions(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useBulkSubmitWeekly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkWeeklySubmitPayload) => governanceService.bulkSubmitWeekly(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useBulkReviewEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkEvidenceReviewPayload) => governanceService.bulkReviewEvidence(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useUploadEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      actionId,
      file,
      title,
      description,
      reportingWeek,
    }: {
      actionId: number;
      file: File;
      title: string;
      description?: string;
      reportingWeek?: string;
    }) => governanceService.uploadEvidence(actionId, file, title, description, reportingWeek),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.evidence(vars.actionId) });
    },
  });
}

export function useReviewEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      evidenceId,
      actionId,
      payload,
    }: {
      evidenceId: number;
      actionId: number;
      payload: ReviewEvidencePayload;
    }) => governanceService.reviewEvidence(evidenceId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.evidence(vars.actionId) });
    },
  });
}

export function useUploadGovernanceExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => governanceService.uploadExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useUploadWeeklyExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, allowRevision }: { file: File; allowRevision?: boolean }) =>
      governanceService.uploadWeeklyExcel(file, allowRevision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
    },
  });
}

export function useRevisionRequests(params: { status?: string; circle_id?: number; search?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.revisionRequests(params),
    queryFn: () => governanceService.getRevisionRequests(params),
  });
}

export function useActionRevisionRequests(actionId?: number | null) {
  return useQuery({
    queryKey: GOVERNANCE_KEYS.actionRevisionRequests(actionId!),
    queryFn: () => governanceService.getActionRevisionRequests(actionId!),
    enabled: Boolean(actionId),
  });
}

export function useSubmitTargetRevisionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: { actionId: number; payload: SubmitTargetRevisionRequestPayload }) =>
      governanceService.submitTargetRevisionRequest(actionId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.actionRevisionRequests(vars.actionId) });
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.revisionRequests() });
    },
  });
}

export function useReviewTargetRevisionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, actionId, payload }: { requestId: number; actionId?: number; payload: ReviewTargetRevisionRequestPayload }) =>
      governanceService.reviewTargetRevisionRequest(requestId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.all });
      if (vars.actionId) {
        queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.detail(vars.actionId) });
        queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.fullDetail(vars.actionId) });
        queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.actionRevisionRequests(vars.actionId) });
      }
      queryClient.invalidateQueries({ queryKey: GOVERNANCE_KEYS.revisionRequests() });
    },
  });
}

