import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { UploadsHeader } from "../components/UploadsHeader";
import { TemplateListTable } from "../components/TemplateListTable";
import { ImportHistoryTable } from "../components/ImportHistoryTable";
import { UploadDropzoneModal } from "../components/UploadDropzoneModal";
import { TemplateViewModal } from "../components/TemplateViewModal";

import { useTemplates, useUploadsMeta } from "../hooks/useTemplates";
import { useImportBatches, useUploadBatchFile, useCommitBatch } from "../hooks/useImportBatches";
import { useUploadPermissions } from "../hooks/useUploadPermissions";
import { uploadsService } from "../api/uploadsService";
import { UploadTemplate, ImportBatch } from "../types/uploads.types";

export const UploadsPage: React.FC = () => {
  const navigate = useNavigate();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedTemplateForUpload, setSelectedTemplateForUpload] = useState<UploadTemplate | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTemplateForView, setSelectedTemplateForView] = useState<UploadTemplate | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<"success" | "error" | "info">("success");

  // Dynamic authorization
  const { canManage, isViewOnly } = useUploadPermissions();

  // React Query Hooks
  const { data: meta } = useUploadsMeta();
  const { data: templates = [], isLoading: isLoadingTemplates } = useTemplates();
  const { data: batches = [], isLoading: isLoadingBatches } = useImportBatches();

  const uploadMutation = useUploadBatchFile();
  const commitMutation = useCommitBatch();

  // Metrics
  const totalTemplates = templates.length;
  const totalBatches = batches.length;
  const completedBatches = batches.filter((b) => b.status === "COMPLETED").length;

  const handleDownloadTemplate = async (template: UploadTemplate) => {
    try {
      await uploadsService.downloadTemplateExcel(
        template.id,
        undefined,
        `${template.code}_v${template.latest_version_number}_template.xlsx`
      );
      setToastMessage(`Excel template for '${template.name}' downloaded successfully.`);
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to download template Excel file.");
      setToastSeverity("error");
    }
  };

  const handleOpenUpload = (template?: UploadTemplate) => {
    setSelectedTemplateForUpload(template || null);
    setUploadModalOpen(true);
  };

  const handleUploadSubmit = async (
    file: File,
    templateId: number,
    reportingPeriodId?: number | null,
    periodConfig?: {
      periodType?: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM" | null;
      reportingDate?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    },
    kpiId?: number | null
  ) => {
    const batch = await uploadMutation.mutateAsync({
      file,
      templateId,
      reportingPeriodId,
      periodConfig,
      kpiId,
    });
    setToastMessage(`File uploaded and validated. Created Batch: ${batch.batch_id}`);
    setToastSeverity("success");
    // Navigate to batch detail to inspect validation results
    navigate(`/uploads/batches/${batch.batch_id}`);
  };

  const handleDownloadErrorReport = async (batch: ImportBatch) => {
    try {
      await uploadsService.downloadBatchErrorReport(batch.batch_id);
      setToastMessage(`Error report for batch '${batch.batch_id}' downloaded successfully.`);
      setToastSeverity("info");
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to download error report.");
      setToastSeverity("error");
    }
  };

  const handleCommitBatch = async (batch: ImportBatch) => {
    try {
      const res = await commitMutation.mutateAsync(batch.batch_id);
      setToastMessage(`Successfully imported ${res.committed_rows} records from batch ${batch.batch_id}.`);
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage(err?.response?.data?.message || err.message || "Failed to commit batch records.");
      setToastSeverity("error");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* View-Only Informational Banner */}
      {isViewOnly && (
        <Alert
          severity="info"
          sx={{
            borderRadius: "10px",
            border: "1px solid #BAE6FD",
            bgcolor: "#F0F9FF",
            color: "#0369A1",
            "& .MuiAlert-icon": { color: "#0284C7" },
          }}
        >
          <strong>View-Only Mode Enabled:</strong> You have read-only access to the Uploads module. You can inspect configured schemas, live Excel previews, validation rules, batch history, and download Excel templates or error logs. Creating schemas or uploading files is restricted.
        </Alert>
      )}

      {/* Page Header */}
      <UploadsHeader
        totalTemplates={totalTemplates}
        totalBatches={totalBatches}
        completedBatches={completedBatches}
        canManage={canManage}
        onCreateTemplate={() => navigate("/uploads/templates/create")}
        onUploadExcel={() => handleOpenUpload()}
      />

      {/* Area 1: Configured Data Templates Table */}
      <TemplateListTable
        templates={templates}
        isLoading={isLoadingTemplates}
        canManage={canManage}
        onViewTemplate={(tpl) => {
          setSelectedTemplateForView(tpl);
          setViewModalOpen(true);
        }}
        onDownload={handleDownloadTemplate}
        onUpload={(tpl) => handleOpenUpload(tpl)}
        onNewVersion={(tpl) => navigate(`/uploads/templates/create?cloneId=${tpl.id}`)}
        onEditVersion={(tpl) => navigate(`/uploads/templates/create?templateId=${tpl.id}&editVersionId=${tpl.latest_version_id}`)}
        onCreateTemplate={() => navigate("/uploads/templates/create")}
      />

      {/* Area 2: Upload Batches & Import History Table */}
      <ImportHistoryTable
        batches={batches}
        isLoading={isLoadingBatches}
        canManage={canManage}
        onViewBatch={(batch) => navigate(`/uploads/batches/${batch.batch_id}`)}
        onDownloadErrors={handleDownloadErrorReport}
        onCommitBatch={handleCommitBatch}
        onUploadExcel={() => handleOpenUpload()}
      />

      {/* Template Schema View Modal */}
      <TemplateViewModal
        open={viewModalOpen}
        template={selectedTemplateForView}
        onClose={() => setViewModalOpen(false)}
        onDownloadExcel={handleDownloadTemplate}
      />

      {/* Upload Dropzone Modal */}
      <UploadDropzoneModal
        open={uploadModalOpen}
        templates={templates}
        reportingPeriods={meta?.reporting_periods || []}
        preselectedTemplate={selectedTemplateForUpload}
        isUploading={uploadMutation.isPending}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUploadSubmit}
      />

      {/* Notification Toast */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={5000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToastMessage(null)}
          severity={toastSeverity}
          sx={{ width: "100%", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
