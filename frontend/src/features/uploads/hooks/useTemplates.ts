/**
 * React Query Hooks for Templates in Uploads Module.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadsService } from "../api/uploadsService";
import { CreateTemplatePayload, CreateVersionPayload, UpdateVersionPayload } from "../types/uploads.types";

export const UPLOADS_QUERY_KEYS = {
  meta: ["uploads", "meta"] as const,
  templates: (status?: string, search?: string) => ["uploads", "templates", { status, search }] as const,
  templateDetail: (id: number) => ["uploads", "template", id] as const,
  batches: (filters?: Record<string, unknown>) => ["uploads", "batches", filters] as const,
  batchDetail: (id: string) => ["uploads", "batch", id] as const,
  batchErrors: (id: string, limit: number, offset: number) => ["uploads", "batch", id, "errors", { limit, offset }] as const,
};

export function useUploadsMeta() {
  return useQuery({
    queryKey: UPLOADS_QUERY_KEYS.meta,
    queryFn: () => uploadsService.getMeta(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTemplates(status?: string, search?: string) {
  return useQuery({
    queryKey: UPLOADS_QUERY_KEYS.templates(status, search),
    queryFn: () => uploadsService.getTemplates(status, search),
  });
}

export function useTemplateDetail(templateId: number) {
  return useQuery({
    queryKey: UPLOADS_QUERY_KEYS.templateDetail(templateId),
    queryFn: () => uploadsService.getTemplate(templateId),
    enabled: Boolean(templateId),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) => uploadsService.createTemplate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads", "templates"] });
    },
  });
}

export function useCreateTemplateVersion(templateId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVersionPayload) => uploadsService.createTemplateVersion(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UPLOADS_QUERY_KEYS.templateDetail(templateId) });
      queryClient.invalidateQueries({ queryKey: ["uploads", "templates"] });
    },
  });
}

export function useUpdateTemplateVersion(templateId: number, versionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateVersionPayload) =>
      uploadsService.updateTemplateVersion(templateId, versionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UPLOADS_QUERY_KEYS.templateDetail(templateId) });
      queryClient.invalidateQueries({ queryKey: ["uploads", "templates"] });
    },
  });
}

export function useDeleteTemplateVersion(templateId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => uploadsService.deleteTemplateVersion(templateId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UPLOADS_QUERY_KEYS.templateDetail(templateId) });
      queryClient.invalidateQueries({ queryKey: ["uploads", "templates"] });
      queryClient.invalidateQueries({ queryKey: ["uploads", "batches"] });
    },
  });
}

