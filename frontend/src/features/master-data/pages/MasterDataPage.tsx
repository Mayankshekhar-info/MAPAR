import React, { useState } from "react";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { PageHeader } from "../../../components/PageHeader/PageHeader";
import { MasterDataFilterBar } from "../components/MasterDataFilterBar";
import { MasterDataTable } from "../components/MasterDataTable";
import { MasterDataEditModal } from "../components/MasterDataEditModal";
import { MasterDataUploadModal } from "../components/MasterDataUploadModal";
import {
  useMasterDataMeta,
  useMasterDataRecords,
  useUpdateMasterDataRecord,
  useUploadMasterData,
} from "../hooks/useMasterData";
import { MasterDataFilterState, MasterDataRecord, UploadMasterDataPayload } from "../types/masterData.types";
import { masterDataService } from "../api/masterDataService";
import { useUploadPermissions } from "../../uploads/hooks/useUploadPermissions";

export const MasterDataPage: React.FC = () => {
  const [filters, setFilters] = useState<MasterDataFilterState>({
    companyId: null,
    subCompanyId: null,
    projectId: null,
    circleId: null,
    departmentId: null,
    periodId: null,
    templateId: null,
    search: "",
    isValid: null,
    page: 0,
    pageSize: 50,
  });

  const [selectedRecord, setSelectedRecord] = useState<MasterDataRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<"success" | "error" | "info">("success");

  const { data: meta } = useMasterDataMeta();
  const { data: recordsData, isLoading: isLoadingRecords, refetch } = useMasterDataRecords(filters);
  const updateMutation = useUpdateMasterDataRecord();
  const uploadMutation = useUploadMasterData();
  const { canManage } = useUploadPermissions();

  const handleFilterChange = (updates: Partial<MasterDataFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters({
      companyId: null,
      subCompanyId: null,
      projectId: null,
      circleId: null,
      departmentId: null,
      periodId: null,
      templateId: null,
      search: "",
      isValid: null,
      page: 0,
      pageSize: 50,
    });
  };

  const handleEditRecord = (record: MasterDataRecord) => {
    setSelectedRecord(record);
    setIsEditModalOpen(true);
  };

  const handleSaveRecord = async (recordId: number, updatedFields: Record<string, any>) => {
    await updateMutation.mutateAsync({ id: recordId, rawData: updatedFields });
    setToastMessage(`Record #${recordId} updated and verified in canonical database.`);
    setToastSeverity("success");
    refetch();
  };

  const handleUpload = async (payload: UploadMasterDataPayload) => {
    const res = await uploadMutation.mutateAsync(payload);
    setToastMessage(res.message || "Master Data uploaded successfully!");
    setToastSeverity("success");
    refetch();
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await masterDataService.exportExcel(filters);
      setToastMessage("Master Data exported to Excel successfully.");
      setToastSeverity("info");
    } catch (err: any) {
      setToastMessage("Failed to export Excel: " + (err.message || "Unknown error"));
      setToastSeverity("error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <PageHeader
        title="Master Data"
        subtitle="Central reference repository for operational data, Excel ingestion, record verification, and export"
      />

      <MasterDataFilterBar
        meta={meta}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <MasterDataTable
        columns={recordsData?.columns || []}
        records={recordsData?.records || []}
        total={recordsData?.total || 0}
        page={filters.page}
        pageSize={filters.pageSize}
        search={filters.search}
        isLoading={isLoadingRecords}
        onPageChange={(page) => handleFilterChange({ page })}
        onPageSizeChange={(pageSize) => handleFilterChange({ pageSize, page: 0 })}
        onSearchChange={(search) => handleFilterChange({ search, page: 0 })}
        onEditRecord={handleEditRecord}
        canEdit={canManage}
      />

      {/* Edit Modal */}
      <MasterDataEditModal
        open={isEditModalOpen}
        record={selectedRecord}
        columns={recordsData?.columns || []}
        isSaving={updateMutation.isPending}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedRecord(null);
        }}
        onSave={handleSaveRecord}
        canEdit={canManage}
      />

      {/* Upload Modal */}
      <MasterDataUploadModal
        open={isUploadModalOpen}
        meta={meta}
        currentFilters={filters}
        isUploading={uploadMutation.isPending}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
      />

      {/* Toast Notification */}
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
