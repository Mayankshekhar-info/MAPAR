import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useQueryClient } from "@tanstack/react-query";
import {
  HierarchyNode,
  HierarchyLevel,
  CreateNodePayload,
  UpdateNodePayload,
} from "../types/organization.types";
import {
  useOrganizationTree,
  useOrganizationSummary,
  useOrganizationNode,
  useOrganizationMutations,
} from "../hooks/useOrganization";
import { getNextChildLevel, getAddChildButtonLabel } from "../utils/hierarchy";
import { OrganizationHeader } from "../components/OrganizationHeader";
import { OrganizationSummary } from "../components/OrganizationSummary";
import { OrganizationTree } from "../components/OrganizationTree";
import { OrganizationDetails } from "../components/OrganizationDetails";
import { OrganizationSearch } from "../components/OrganizationSearch";
import { CreateOrganizationModal } from "../components/CreateOrganizationModal";
import { EditOrganizationModal } from "../components/EditOrganizationModal";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";

export const OrganizationPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Data queries
  const { data: tree = [], isLoading: isLoadingTree } = useOrganizationTree();
  const { data: summary, isLoading: isLoadingSummary } = useOrganizationSummary();

  // 2. Selection state
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    level: HierarchyLevel;
    raw_id: number;
    name: string;
    code: string;
  } | null>(null);

  // 3. Node details query
  const {
    data: selectedNodeDetail,
    isLoading: isLoadingDetail,
  } = useOrganizationNode(
    selectedNode ? selectedNode.level : null,
    selectedNode ? selectedNode.raw_id : null
  );

  // 4. Search state
  const [searchQuery, setSearchQuery] = useState("");

  // 5. Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTargetLevel, setCreateTargetLevel] = useState<HierarchyLevel>("MAIN_COMPANY");

  const [createParent, setCreateParent] = useState<{
    id: number;
    name: string;
    code: string;
    level: HierarchyLevel;
  } | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 6. Notifications
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const showToast = (message: string, severity: "success" | "error" | "info" = "success") => {
    setToast({ open: true, message, severity });
  };

  // 7. Mutations
  const { createNode, updateNode, deleteNode } = useOrganizationMutations();

  // Select node handler
  const handleSelectNode = (node: HierarchyNode) => {
    setSelectedNode({
      id: node.id,
      level: node.level,
      raw_id: node.raw_id,
      name: node.name,
      code: node.code,
    });
  };

  // Open Create Main Company
  const handleOpenAddCompany = () => {
    setCreateTargetLevel("MAIN_COMPANY");
    setCreateParent(null);
    setCreateModalOpen(true);
  };

  // Open Create Child Node (dynamically determined by selected node level)
  const handleOpenAddChild = (specificLevel?: HierarchyLevel) => {
    if (!selectedNode) {
      handleOpenAddCompany();
      return;
    }
    const nextLevel =
      specificLevel ||
      selectedNodeDetail?.allowed_child_level ||
      getNextChildLevel(selectedNode.level);
    if (!nextLevel) {
      showToast("Cannot add child: this is the lowest hierarchy level.", "error");
      return;
    }
    if (nextLevel === "USER") {
      navigate("/users/create", {
        state: {
          initialHierarchy:
            selectedNodeDetail?.hierarchy_context ||
            (selectedNode.level === "SUB_DEPARTMENT" || selectedNode.level === "TEAM"
              ? { team_id: selectedNode.raw_id, sub_department_id: selectedNode.raw_id }
              : null),
        },
      });
      return;
    }
    setCreateTargetLevel(nextLevel);

    setCreateParent({
      id: selectedNode.raw_id,
      name: selectedNode.name,
      code: selectedNode.code,
      level: selectedNode.level,
    });
    setCreateModalOpen(true);
  };


  // Submit Create
  const handleCreateSubmit = async (payload: CreateNodePayload) => {
    try {
      const created = await createNode.mutateAsync(payload);
      showToast(`Created ${created.name} (${created.code}) successfully!`);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.errors?.name?.[0] ||
        err?.message ||
        "Failed to create organization node.";
      showToast(errorMsg, "error");
      throw err;
    }
  };

  // Submit Update
  const handleUpdateSubmit = async (payload: UpdateNodePayload) => {
    if (!selectedNode) return;
    try {
      const updated = await updateNode.mutateAsync({
        level: selectedNode.level,
        id: selectedNode.raw_id,
        payload,
      });
      setSelectedNode((prev) =>
        prev
          ? {
              ...prev,
              name: updated.name,
              code: updated.code,
            }
          : null
      );
      showToast(`Updated ${updated.name} successfully!`);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.errors?.name?.[0] ||
        err?.message ||
        "Failed to update organization node.";
      showToast(errorMsg, "error");
      throw err;
    }
  };

  // Submit Delete
  const handleDeleteConfirm = async () => {
    if (!selectedNode) return;
    try {
      await deleteNode.mutateAsync({
        level: selectedNode.level,
        id: selectedNode.raw_id,
      });
      showToast(`Deleted ${selectedNode.name} successfully.`);
      setSelectedNode(null);
      setDeleteDialogOpen(false);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error || err?.message || "Failed to delete node.";
      showToast(errorMsg, "error");
    }
  };

  const nextChildLevel = selectedNode ? getNextChildLevel(selectedNode.level) : null;
  const addChildLabel = selectedNode ? getAddChildButtonLabel(selectedNode.level) : null;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto", spaceY: 3.5 }}>
      {/* 1. Page Header */}
      <OrganizationHeader
        onAddCompany={handleOpenAddCompany}
        onAddChild={nextChildLevel ? () => handleOpenAddChild() : undefined}
        onAddCircle={
          selectedNode?.level === "MAIN_COMPANY"
            ? () => handleOpenAddChild("CIRCLE")
            : undefined
        }
        selectedNodeLabel={selectedNode?.name}
        addChildLabel={addChildLabel}
      />

      {/* 2. Hierarchy Summary Cards */}
      <Box sx={{ mt: 3 }}>
        <OrganizationSummary summary={summary} isLoading={isLoadingSummary} />
      </Box>

      {/* 3. Search & Quick Filters Bar */}
      <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <OrganizationSearch value={searchQuery} onChange={setSearchQuery} />
      </Box>

      {/* 4. Tree Explorer & Master/Detail Grid */}
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* Left Column: Organization Tree */}
          <Grid size={{ xs: 12, md: 7, lg: 7.5 }}>
            <OrganizationTree
              tree={tree}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectNode}
              searchFilter={searchQuery}
              onAddCompany={handleOpenAddCompany}
            />
          </Grid>

          {/* Right Column: Node Details Inspector */}
          <Grid size={{ xs: 12, md: 5, lg: 4.5 }}>
            <OrganizationDetails
              nodeDetail={selectedNodeDetail}
              isLoading={isLoadingDetail}
              onEdit={() => setEditModalOpen(true)}
              onAddChild={handleOpenAddChild}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </Grid>
        </Grid>
      </Box>

      {/* 5. Modals & Dialogs */}
      <CreateOrganizationModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        targetLevel={createTargetLevel}
        parent={createParent}
        onSubmit={handleCreateSubmit}
        isSubmitting={createNode.isPending}
      />

      {selectedNodeDetail && (


        <>
          <EditOrganizationModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            nodeDetail={selectedNodeDetail}
            onSubmit={handleUpdateSubmit}
            isSubmitting={updateNode.isPending}
          />

          <DeleteConfirmDialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            nodeDetail={selectedNodeDetail}
            onConfirm={handleDeleteConfirm}
            isDeleting={deleteNode.isPending}
          />
        </>
      )}

      {/* 6. Notifications Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ borderRadius: "10px", fontWeight: 600 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
