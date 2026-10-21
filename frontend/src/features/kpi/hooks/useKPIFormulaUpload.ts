import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kpiService } from "../api/kpiService";
import { KPIFormulaParseResponse, KPIConfigVersion } from "../types/kpi";

export function useKPIFormulaUpload() {
  const queryClient = useQueryClient();

  const [parseResult, setParseResult] = useState<KPIFormulaParseResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({});
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  // Parse & Preview Mutation
  const parseMutation = useMutation({
    mutationFn: async ({
      file,
      mapping,
      sheet,
    }: {
      file: File;
      mapping?: Record<string, string>;
      sheet?: string;
    }) => {
      const res = await kpiService.parseFormulaConfiguration(file, mapping, sheet);
      return res as KPIFormulaParseResponse;
    },
    onSuccess: (data) => {
      setParseResult(data);
      if (data.selected_sheet) {
        setSelectedSheet(data.selected_sheet);
      }
      if (data.detected_mapping) {
        setCustomMapping(data.detected_mapping);
      }
    },
  });

  // Activate Mutation
  const activateMutation = useMutation({
    mutationFn: async (payload: {
      approved_kpis: any[];
      scope_type: "ENTERPRISE" | "COMPANY" | "PROJECT" | "CIRCLE";
      company_id?: number | null;
      project_id?: number | null;
      circle_id?: number | null;
      hierarchy_level?: string | null;
      hierarchy_id?: number | null;
      is_inheritance_allowed?: boolean;
      changelog?: string;
    }) => {
      return await kpiService.activateConfiguration({
        file: selectedFile || undefined,
        file_hash: parseResult?.file_hash,
        original_filename: parseResult?.original_filename,
        ...payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-cards"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-config-versions"] });
    },
  });

  // Sync Canonical Standard KPIs Mutation
  const syncCanonicalMutation = useMutation({
    mutationFn: async () => {
      return await kpiService.syncCanonicalKPIs();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-cards"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-config-versions"] });
    },
  });

  // Download Starter Excel Template
  const downloadTemplate = async () => {
    try {
      const blob = await kpiService.downloadFormulaTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "MAPAR_Universal_KPI_Formula_Template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Template download failed:", err);
      throw err;
    }
  };

  const resetUploadState = () => {
    setParseResult(null);
    setSelectedFile(null);
    setCustomMapping({});
    setSelectedSheet("");
  };

  return {
    selectedFile,
    setSelectedFile,
    parseResult,
    customMapping,
    setCustomMapping,
    selectedSheet,
    setSelectedSheet,
    parseMutation,
    activateMutation,
    syncCanonicalMutation,
    downloadTemplate,
    resetUploadState,
    isParsing: parseMutation.isPending,
    isActivating: activateMutation.isPending,
    isSyncing: syncCanonicalMutation.isPending,
  };
}

export function useKPIConfigVersions(scopeType?: string, companyId?: number, projectId?: number) {
  return useQuery<KPIConfigVersion[]>({
    queryKey: ["kpi-config-versions", scopeType, companyId, projectId],
    queryFn: async () => {
      const res = await kpiService.fetchConfigurationVersions({
        scope_type: scopeType,
        company_id: companyId,
        project_id: projectId,
      });
      return res.versions || [];
    },
  });
}
