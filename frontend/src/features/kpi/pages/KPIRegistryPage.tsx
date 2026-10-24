import React, { useState, useEffect } from "react";
import {
  Box,
  Tabs,
  Tab,
  Button,
  Snackbar,
  Alert,
  Card,
  TextField,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import HistoryIcon from "@mui/icons-material/History";
import DownloadIcon from "@mui/icons-material/Download";
import SyncIcon from "@mui/icons-material/Sync";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import { PageHeader } from "../../../components/PageHeader/PageHeader";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { KPIDefinition, KPIDashboardCard as CardData } from "../types/kpi";
import { useKPIDefinitions } from "../hooks/useKPIDefinitions";
import { useKPIDashboard } from "../hooks/useKPIDashboard";
import { useKPIFormulaUpload } from "../hooks/useKPIFormulaUpload";
import { KPICardGrid } from "../components/KPICardGrid";
import { KPIDefinitionTable } from "../components/KPIDefinitionTable";
import { KPIBuilderModal } from "../components/KPIBuilderModal";
import { KPIDiagnosticsDrawer } from "../components/KPIDiagnosticsDrawer";
import { KPIFormulaUploadModal } from "../components/KPIFormulaUploadModal";
import { KPIConfigVersionsDrawer } from "../components/KPIConfigVersionsDrawer";
import { cockpitService } from "../../dashboard/api/cockpitService";
import { PeriodSelector } from "../../../components/PeriodSelector";

import { organizationService } from "../../organization/api/organizationService";
import { CascadingOption, HierarchyLevel } from "../../organization/types/organization.types";

export const KPIRegistryPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);

  // Hierarchy and Period Filter Options
  const [periods, setPeriods] = useState<Array<{ id: number; name: string; is_current?: boolean }>>([]);
  const [hierarchyNodes, setHierarchyNodes] = useState<CascadingOption[]>([]);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);

  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(undefined);
  const [selectedHierarchyLevel, setSelectedHierarchyLevel] = useState<string>("CIRCLE");
  const [selectedHierarchyId, setSelectedHierarchyId] = useState<number>(1);

  // Modal / Drawer state
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<KPIDefinition | null>(null);

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [kpiToDelete, setKpiToDelete] = useState<KPIDefinition | null>(null);

  const [formulaUploadOpen, setFormulaUploadOpen] = useState(false);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);

  const { downloadTemplate, syncCanonicalMutation, isSyncing } = useKPIFormulaUpload();

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<"success" | "error" | "info">("success");

  // Load Periods on mount
  useEffect(() => {
    cockpitService
      .getFilters()
      .then((res) => {
        if (res?.periods && res.periods.length > 0) {
          setPeriods(res.periods);
          const current = res.periods.find((p) => p.is_current) || res.periods[0];
          setSelectedPeriodId(current.id);
        }
      })
      .catch(() => {});
  }, []);

  // Dynamically load hierarchy nodes whenever selectedHierarchyLevel changes
  useEffect(() => {
    setIsLoadingNodes(true);
    organizationService
      .getOptions(selectedHierarchyLevel as HierarchyLevel)
      .then((nodes) => {
        setHierarchyNodes(nodes);
        if (nodes.length > 0) {
          const exists = nodes.some((n) => n.id === selectedHierarchyId);
          if (!exists) {
            setSelectedHierarchyId(nodes[0].id);
          }
        }
      })
      .catch(() => {
        setHierarchyNodes([]);
      })
      .finally(() => {
        setIsLoadingNodes(false);
      });
  }, [selectedHierarchyLevel]);

  // React Query Hooks
  const {
    data: definitions = [],
    isLoading: isLoadingDefinitions,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    duplicateDefinition,
  } = useKPIDefinitions();

  const {
    cards = [],
    isLoadingCards,
    refetchCards,
    calculateKPI,
    isCalculating,
  } = useKPIDashboard({
    period_id: selectedPeriodId,
    hierarchy_level: selectedHierarchyLevel,
    hierarchy_id: selectedHierarchyId,
  });

  const handleOpenCreate = () => {
    setEditingKPI(null);
    setBuilderModalOpen(true);
  };

  const handleOpenEdit = (kpi: KPIDefinition) => {
    setEditingKPI(kpi);
    setBuilderModalOpen(true);
  };

  const handleDuplicate = async (kpi: KPIDefinition) => {
    try {
      await duplicateDefinition(kpi.id);
      setToastMessage(`Successfully duplicated ${kpi.code}.`);
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to duplicate KPI.");
      setToastSeverity("error");
    }
  };

  const handleDeletePrompt = (kpi: KPIDefinition) => {
    setKpiToDelete(kpi);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!kpiToDelete) return;
    try {
      await deleteDefinition(kpiToDelete.id);
      setToastMessage(`KPI ${kpiToDelete.code} deleted.`);
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to delete KPI.");
      setToastSeverity("error");
    } finally {
      setDeleteConfirmOpen(false);
      setKpiToDelete(null);
    }
  };

  const handleInspectCard = (card: CardData) => {
    setSelectedResultId(card.id);
    setDiagnosticsOpen(true);
  };

  const handleRecalculateCard = async (card: CardData) => {
    try {
      await calculateKPI({
        kpiId: card.kpi_id,
        hierarchyLevel: card.hierarchy_level,
        hierarchyId: card.hierarchy_id,
        periodId: selectedPeriodId,
      });
      setToastMessage(`Recalculated ${card.kpi_code}.`);
      setToastSeverity("success");
    } catch (err: any) {
      setToastMessage(err?.message || "Recalculation failed.");
      setToastSeverity("error");
    }
  };

  const handleSaveKPI = async (payload: any) => {
    if (editingKPI) {
      await updateDefinition({ id: editingKPI.id, payload });
      setToastMessage(`Updated KPI ${payload.code}.`);
    } else {
      await createDefinition(payload);
      setToastMessage(`Created KPI ${payload.code}.`);
    }
    setToastSeverity("success");
    refetchCards();
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate();
      setToastMessage("Universal KPI formula starter template downloaded.");
      setToastSeverity("success");
    } catch {
      setToastMessage("Failed to download formula template.");
      setToastSeverity("error");
    }
  };

  const handleSyncCanonical = async () => {
    try {
      const res = await syncCanonicalMutation.mutateAsync();
      setToastMessage(res.message || `Successfully synced ${res.count} canonical KPIs.`);
      setToastSeverity("success");
      refetchCards();
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to sync canonical KPIs.");
      setToastSeverity("error");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <PageHeader
        title="Universal KPI Registry & Engine"
        subtitle="Standardized Definitions • Upload Data Lineage • Safe Mathematical AST Engine • Scoped Governance"
        badge="Enterprise Engine"
        badgeColor="info"
        actions={
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<UploadFileIcon />}
              onClick={() => setFormulaUploadOpen(true)}
              sx={{
                fontWeight: 600,
                background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)",
                boxShadow: "0 2px 8px rgba(25, 118, 210, 0.25)",
              }}
            >
              Upload Formula Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setVersionsDrawerOpen(true)}
              sx={{ fontWeight: 600 }}
            >
              Version History
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              sx={{ fontWeight: 600 }}
            >
              Template
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<SyncIcon />}
              onClick={handleSyncCanonical}
              disabled={isSyncing}
              sx={{ fontWeight: 600 }}
            >
              {isSyncing ? "Syncing..." : "Sync Standard KPIs"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{ fontWeight: 600 }}
            >
              Configure KPI
            </Button>
          </Stack>
        }
      />

      {/* Onboarding Guidance Banner when 0 KPIs exist */}
      {definitions.length === 0 && !isLoadingDefinitions && (
        <Card
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 2.5,
            border: "1.5px dashed",
            borderColor: "primary.main",
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? "rgba(25, 118, 210, 0.08)" : "rgba(25, 118, 210, 0.04)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: { md: "center" },
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <AutoAwesomeIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Initialize Universal KPI Engine
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                No KPI formula models are currently active in PostgreSQL. Upload an Excel formula workbook,
                download the starter template, or synchronize standard telecommunications and operations metrics.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => setFormulaUploadOpen(true)}
                sx={{ fontWeight: 600 }}
              >
                Upload Formula Workbook
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<SyncIcon />}
                onClick={handleSyncCanonical}
                disabled={isSyncing}
                sx={{ fontWeight: 600 }}
              >
                Sync Standard KPIs
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ fontWeight: 600 }}
              >
                Download Starter Template
              </Button>
            </Stack>
          </Box>
        </Card>
      )}

      {/* Navigation Tabs */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab
            icon={<DashboardOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label="KPI Dashboard & Cards"
            sx={{ fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<TuneIcon fontSize="small" />}
            iconPosition="start"
            label={`KPI Registry (${definitions.length})`}
            sx={{ fontWeight: 600, minHeight: 48 }}
          />
        </Tabs>

        {/* Tab 0: KPI Dashboard */}
        {currentTab === 0 && (
          <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Filter toolbar */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
                {/* Reporting Period */}
                <PeriodSelector
                  selectedPeriodId={selectedPeriodId}
                  onPeriodSelect={(p) => setSelectedPeriodId(p.id)}
                  size="small"
                />


                {/* Hierarchy Tier */}
                <TextField
                  select
                  size="small"
                  label="Hierarchy Level"
                  value={selectedHierarchyLevel}
                  onChange={(e) => setSelectedHierarchyLevel(e.target.value)}
                  sx={{ width: 170 }}
                >
                  <MenuItem value="MAIN_COMPANY">Main Company</MenuItem>
                  <MenuItem value="SUB_COMPANY">Sub Company</MenuItem>
                  <MenuItem value="PROJECT">Project</MenuItem>
                  <MenuItem value="CIRCLE">Circle</MenuItem>
                  <MenuItem value="DOMAIN">Domain</MenuItem>
                  <MenuItem value="DEPARTMENT">Department</MenuItem>
                  <MenuItem value="SUB_DEPARTMENT">Team</MenuItem>
                </TextField>

                {/* Dynamic Node Scope Selector */}
                {hierarchyNodes.length > 0 && (
                  <TextField
                    select
                    size="small"
                    label="Organization Node"
                    value={selectedHierarchyId}
                    onChange={(e) => setSelectedHierarchyId(Number(e.target.value))}
                    disabled={isLoadingNodes}
                    sx={{ minWidth: 200 }}
                  >
                    {hierarchyNodes.map((n) => (
                      <MenuItem key={n.id} value={n.id}>
                        {n.name} {n.code ? `(${n.code})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Stack>

              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => refetchCards()}
                disabled={isLoadingCards}
              >
                Refresh Metrics
              </Button>
            </Box>

            {/* Cards Grid */}
            <KPICardGrid
              cards={cards}
              onInspect={handleInspectCard}
              onRecalculate={handleRecalculateCard}
              isCalculating={isCalculating}
            />
          </Box>
        )}

        {/* Tab 1: KPI Registry */}
        {currentTab === 1 && (
          <Box sx={{ p: 2.5 }}>
            <KPIDefinitionTable
              definitions={definitions}
              isLoading={isLoadingDefinitions}
              onCreate={handleOpenCreate}
              onEdit={handleOpenEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDeletePrompt}
            />
          </Box>
        )}
      </Card>

      {/* KPI Builder Modal */}
      <KPIBuilderModal
        open={builderModalOpen}
        onClose={() => setBuilderModalOpen(false)}
        onSave={handleSaveKPI}
        initialData={editingKPI}
      />

      {/* Diagnostics Drawer */}
      <KPIDiagnosticsDrawer
        open={diagnosticsOpen}
        resultId={selectedResultId}
        onClose={() => setDiagnosticsOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete KPI Definition?"
        message={`Are you sure you want to delete KPI definition "${kpiToDelete?.code}"? All associated cached calculation results will also be deleted.`}
        confirmLabel="Delete Definition"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {/* KPI Formula Excel Upload & Activation Modal */}
      <KPIFormulaUploadModal
        open={formulaUploadOpen}
        onClose={() => setFormulaUploadOpen(false)}
        onSuccess={() => {
          setToastMessage("KPI formula configuration successfully activated.");
          setToastSeverity("success");
          refetchCards();
        }}
      />

      {/* KPI Configuration Versions Audit Drawer */}
      <KPIConfigVersionsDrawer
        open={versionsDrawerOpen}
        onClose={() => setVersionsDrawerOpen(false)}
      />

      {/* Toast Feedback */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToastMessage(null)}
          severity={toastSeverity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
