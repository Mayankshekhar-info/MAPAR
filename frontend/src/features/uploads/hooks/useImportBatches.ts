/**
 * React Query Hooks for Import Batches, Validation & Lineage.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadsService } from "../api/uploadsService";
import { UPLOADS_QUERY_KEYS } from "./useTemplates";

export function useImportBatches(filters?: {
  templateId?: number;
  status?: string;
  reportingPeriodId?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: UPLOADS_QUERY_KEYS.batches(filters),
    queryFn: () => uploadsService.getBatches(filters),
    refetchInterval: 10000, // Background poll every 10s for active batches
  });
}

export function useBatchDetail(batchIdentifier: string) {
  return useQuery({
    queryKey: UPLOADS_QUERY_KEYS.batchDetail(batchIdentifier),
    queryFn: () => uploadsService.getBatch(batchIdentifier),
    enabled: Boolean(batchIdentifier),
  });
}

export function useBatchErrors(batchIdentifier: string, limit: number = 100, offset: number = 0) {
  return useQuery({
    queryKey: UPLOADS_QUERY_KEYS.batchErrors(batchIdentifier, limit, offset),
    queryFn: () => uploadsService.getBatchErrors(batchIdentifier, limit, offset),
    enabled: Boolean(batchIdentifier),
  });
}

export function useUploadBatchFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      templateId,
      versionId,
      reportingPeriodId,
      hierarchyScope,
      periodConfig,
      kpiId,
      duplicateHandling,
    }: {
      file: File;
      templateId: number;
      versionId?: number;
      reportingPeriodId?: number | null;
      hierarchyScope?: {
        companyId?: number | null;
        subCompanyId?: number | null;
        projectId?: number | null;
        circleId?: number | null;
        departmentId?: number | null;
      };
      periodConfig?: {
        periodType?: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM" | null;
        reportingDate?: string | null;
        startDate?: string | null;
        endDate?: string | null;
      };
      kpiId?: number | null;
      duplicateHandling?: string;
    }) =>
      uploadsService.uploadBatchFile(
        file,
        templateId,
        versionId,
        reportingPeriodId,
        hierarchyScope,
        periodConfig,
        kpiId,
        duplicateHandling
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads", "batches"] });
      queryClient.invalidateQueries({ queryKey: ["uploads", "templates"] });
    },
  });
}

export function useCompatibleKPIs(templateId?: number) {
  return useQuery({
    queryKey: ["uploads", "templates", templateId, "compatible-kpis"],
    queryFn: () => uploadsService.getCompatibleKPIs(templateId!),
    enabled: Boolean(templateId),
  });
}


export function useCommitBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchIdentifier: string) => uploadsService.commitBatch(batchIdentifier),
    onSuccess: (_, batchIdentifier) => {
      queryClient.invalidateQueries({ queryKey: UPLOADS_QUERY_KEYS.batchDetail(batchIdentifier) });
      queryClient.invalidateQueries({ queryKey: ["uploads", "batches"] });
      // Invalidate Cockpit and Slide View caches so newly committed records are immediately visible
      queryClient.invalidateQueries({ queryKey: ["cockpit"] });
      queryClient.invalidateQueries({ queryKey: ["slides"] });
    },
  });
}
