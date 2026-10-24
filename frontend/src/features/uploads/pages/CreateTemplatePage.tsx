import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { TemplateBuilder } from "../components/TemplateBuilder";
import { useTemplateBuilder } from "../hooks/useTemplateBuilder";
import {
  useCreateTemplate,
  useCreateTemplateVersion,
  useUpdateTemplateVersion,
  useUploadsMeta,
  useTemplateDetail,
} from "../hooks/useTemplates";
import { useUploadPermissions } from "../hooks/useUploadPermissions";
import { uploadsService } from "../api/uploadsService";
import { LoadingState } from "../../../components/LoadingState";

export const CreateTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get("cloneId");
  const editVersionId = searchParams.get("editVersionId");
  const templateIdParam = searchParams.get("templateId") || cloneId;
  const effectiveTemplateId = templateIdParam ? Number(templateIdParam) : 0;
  const effectiveVersionId = editVersionId ? Number(editVersionId) : 0;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");

  // Post-save modal state for immediate Excel download action
  const [savedTemplateInfo, setSavedTemplateInfo] = useState<{
    templateId: number;
    versionId?: number;
    templateName: string;
    versionNumber: number;
    columnsCount: number;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: meta, isLoading: isLoadingMeta } = useUploadsMeta();
  const { data: templateData, isLoading: isLoadingTemplate } = useTemplateDetail(effectiveTemplateId);

  const builder = useTemplateBuilder();
  const createMutation = useCreateTemplate();
  const createVersionMutation = useCreateTemplateVersion(effectiveTemplateId);
  const updateVersionMutation = useUpdateTemplateVersion(effectiveTemplateId, effectiveVersionId);
  const { canManage } = useUploadPermissions();

  const targetVersion = useMemo(() => {
    if (!templateData?.versions) return null;
    if (editVersionId) {
      return templateData.versions.find((v) => v.id === effectiveVersionId) || null;
    }
    return templateData.versions[0] || null;
  }, [templateData, editVersionId, effectiveVersionId]);

  // If cloning/versioning or editing, populate builder state
  useEffect(() => {
    if (templateData && targetVersion) {
      builder.setName(templateData.name);
      builder.setCode(templateData.code);
      builder.setDescription(templateData.description || "");
      builder.setDataLevel(templateData.data_level || "CIRCLE");
      builder.setTargetEntity(templateData.target_entity || "KPI_VALUES");

      if (targetVersion.columns && targetVersion.columns.length > 0) {
        builder.setColumns(
          targetVersion.columns.map((c, idx) => ({
            ...c,
            column_order: idx,
          }))
        );
      }
    }
  }, [templateData, targetVersion]);

  const handleSave = async () => {
    if (builder.validationError) return;

    try {
      const payload = builder.getPayload();

      if (editVersionId) {
        // Edit existing version in-place without creating a new version
        await updateVersionMutation.mutateAsync({
          name: builder.name,
          description: builder.description,
          data_level: builder.dataLevel,
          changelog: targetVersion?.changelog || `Updated schema for version ${targetVersion?.version_number || ""}.`,
          columns: payload.columns,
        });
        setToastMessage(`Version v${targetVersion?.version_number || ""} updated successfully.`);
        setToastSeverity("success");
        setSavedTemplateInfo({
          templateId: effectiveTemplateId,
          versionId: effectiveVersionId,
          templateName: builder.name,
          versionNumber: targetVersion?.version_number || 1,
          columnsCount: payload.columns.length,
        });
      } else if (cloneId) {
        // Create new version
        await createVersionMutation.mutateAsync({
          changelog: `Updated schema version for ${builder.name}.`,
          columns: payload.columns,
        });
        setToastMessage(`New version created successfully for '${builder.name}'.`);
        setToastSeverity("success");
        setSavedTemplateInfo({
          templateId: Number(cloneId),
          templateName: builder.name,
          versionNumber: (templateData?.versions?.length || 1) + 1,
          columnsCount: payload.columns.length,
        });
      } else {
        // Create new template
        const result = await createMutation.mutateAsync(payload);
        const verId = result.versions && result.versions.length > 0 ? result.versions[0].id : undefined;
        const verNum = result.versions && result.versions.length > 0 ? result.versions[0].version_number : 1;

        setToastMessage(`Template '${builder.name}' created successfully with Version 1.`);
        setToastSeverity("success");
        setSavedTemplateInfo({
          templateId: result.id,
          versionId: verId,
          templateName: result.name,
          versionNumber: verNum,
          columnsCount: payload.columns.length,
        });
      }
    } catch (err: any) {
      setToastMessage(err?.response?.data?.message || err.message || "Failed to save template.");
      setToastSeverity("error");
    }
  };

  const handleDownloadExcel = async () => {
    if (!savedTemplateInfo) return;
    setIsDownloading(true);
    try {
      await uploadsService.downloadTemplateExcel(
        savedTemplateInfo.templateId,
        savedTemplateInfo.versionId,
        `${savedTemplateInfo.templateName.replace(/\s+/g, "_")}_v${savedTemplateInfo.versionNumber}_template.xlsx`
      );
      setToastMessage("Excel template generated and downloaded successfully.");
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage("Failed to download Excel template.");
      setToastSeverity("error");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoadingMeta || (effectiveTemplateId && isLoadingTemplate)) {
    return <LoadingState message="Loading template configuration workspace..." />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <TemplateBuilder
        builder={builder}
        hierarchyLevels={meta?.hierarchy_levels || []}
        dataTypes={meta?.data_types || []}
        isSaving={createMutation.isPending || createVersionMutation.isPending || updateVersionMutation.isPending}
        canManage={canManage}
        title={
          editVersionId
            ? `Edit Uploaded Version (v${targetVersion?.version_number || ""})`
            : cloneId
            ? "Create New Schema Version"
            : "Create Data Template"
        }
        subtitle={
          editVersionId
            ? `Updating version v${targetVersion?.version_number || ""} directly in-place without creating a new version.`
            : cloneId
            ? "Configure a new version while preserving previous historical versions."
            : "Configure custom columns, hierarchy validation rules, and Excel layout"
        }
        saveButtonLabel={editVersionId ? "Update Version" : cloneId ? "Create Version" : "Save Template"}
        onSave={handleSave}
        onCancel={() => navigate("/uploads")}
      />

      {/* Immediate Download & Success Modal */}
      <Dialog
        open={Boolean(savedTemplateInfo)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",
            p: 1.5,
            border: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <CheckCircleOutlineIcon sx={{ color: "success.main", fontSize: "2rem" }} />
          <Typography variant="h6" fontWeight={700}>
            Template Saved Successfully
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ py: 1.5 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Template <strong>{savedTemplateInfo?.templateName}</strong> (Version {savedTemplateInfo?.versionNumber}) has been persisted with <strong>{savedTemplateInfo?.columnsCount} configured dynamic columns</strong>.
          </Typography>

          <Box
            sx={{
              p: 2,
              borderRadius: "12px",
              bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "grey.50",
              border: "1px solid",
              borderColor: "divider",
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Chip label={`Version ${savedTemplateInfo?.versionNumber}`} size="small" color="primary" variant="outlined" />
              <Chip label={`${savedTemplateInfo?.columnsCount} Columns`} size="small" variant="outlined" />
              <Chip label="Ready for Excel Generation" size="small" color="success" sx={{ fontSize: "0.75rem" }} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              The backend has dynamically built the Excel template corresponding exactly to your configured headers, ordering, and data type validation rules.
            </Typography>
          </Box>

          <Typography variant="body2" fontWeight={600} gutterBottom>
            Next Step:
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Download the empty Excel template to distribute to organizational contributors or to fill in and upload immediately.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
          <Button
            variant="outlined"
            onClick={() => navigate("/uploads")}
            startIcon={<ArrowForwardIcon />}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600 }}
          >
            Go to Uploads Dashboard
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            startIcon={<DownloadIcon />}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(46, 125, 50, 0.3)",
            }}
          >
            {isDownloading ? "Generating..." : "Download Excel Template"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setToastMessage(null)} severity={toastSeverity} sx={{ borderRadius: "10px" }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
