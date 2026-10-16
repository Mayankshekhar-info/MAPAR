import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { BatchDetailView } from "../components/BatchDetailView";
import { useBatchDetail, useBatchErrors, useCommitBatch } from "../hooks/useImportBatches";
import { useUploadPermissions } from "../hooks/useUploadPermissions";
import { uploadsService } from "../api/uploadsService";
import { LoadingState } from "../../../components/LoadingState";
import { EmptyState } from "../../../components/EmptyState";

export const BatchDetailPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<"success" | "error" | "info">("success");

  const { data: batch, isLoading: isLoadingBatch, error: batchError } = useBatchDetail(batchId || "");
  const { data: errorData, isLoading: isLoadingErrors } = useBatchErrors(batchId || "", 100, 0);

  const commitMutation = useCommitBatch();
  const { canManage } = useUploadPermissions();

  const handleCommit = async () => {
    if (!batchId) return;
    try {
      const res = await commitMutation.mutateAsync(batchId);
      setToastMessage(`Batch ${batchId} committed successfully! Imported ${res.committed_rows} records.`);
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage(err?.response?.data?.message || err.message || "Failed to commit batch.");
      setToastSeverity("error");
    }
  };

  const handleDownloadErrorReport = async () => {
    if (!batchId) return;
    try {
      await uploadsService.downloadBatchErrorReport(batchId);
      setToastMessage(`Downloaded error diagnostic report for ${batchId}.`);
      setToastSeverity("info");
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to download error report.");
      setToastSeverity("error");
    }
  };

  if (isLoadingBatch || isLoadingErrors) {
    return <LoadingState message="Loading import batch inspection records..." />;
  }

  if (batchError || !batch) {
    return (
      <Box sx={{ p: 4 }}>
        <EmptyState
          title="Import Batch Not Found"
          description={`Could not find an import batch with identifier '${batchId}'.`}
          action={
            <Button variant="outlined" onClick={() => navigate("/uploads")} sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}>
              Back to Uploads
            </Button>
          }
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <BatchDetailView
        batch={batch}
        errors={errorData?.errors || []}
        totalErrors={errorData?.total || 0}
        isCommitting={commitMutation.isPending}
        canManage={canManage}
        onCommit={handleCommit}
        onDownloadErrorReport={handleDownloadErrorReport}
        onBack={() => navigate("/uploads")}
      />

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
