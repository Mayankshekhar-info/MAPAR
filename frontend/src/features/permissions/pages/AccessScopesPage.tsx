import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import RefreshIcon from "@mui/icons-material/Refresh";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import PublicIcon from "@mui/icons-material/Public";
import ApartmentIcon from "@mui/icons-material/Apartment";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { useAccessScopesList, useDeleteScope } from "../hooks/useScopes";
import { AccessScopeListItem } from "../types/scopes.types";
import { AccessScopesTable } from "../components/AccessScopesTable";
import { AssignScopeModal } from "../components/AssignScopeModal";

export const AccessScopesPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scopeToDelete, setScopeToDelete] = useState<AccessScopeListItem | null>(null);

  const { data: scopes = [], isLoading, refetch } = useAccessScopesList();
  const deleteScopeMutation = useDeleteScope();

  const handleOpenAssign = () => {
    setModalOpen(true);
  };

  const handleOpenDelete = (scope: AccessScopeListItem) => {
    setScopeToDelete(scope);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (scopeToDelete) {
      deleteScopeMutation.mutate(scopeToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setScopeToDelete(null);
        },
      });
    }
  };

  const globalCount = scopes.filter((s) => s.scope_type === "GLOBAL" || s.scope_type === "CORPORATE").length;
  const circleCount = scopes.filter((s) => s.scope_type === "CIRCLE").length;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto" }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.02em" }}>
            Access Scopes
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Manage where enterprise users are authorized to view and operate on data across the organization hierarchy.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
            sx={{ borderRadius: radiusTokens.sm, borderColor: colorTokens.workspace.border }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<VpnKeyOutlinedIcon />}
            onClick={handleOpenAssign}
            sx={{
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
              fontWeight: 700,
            }}
          >
            Assign Scope
          </Button>
        </Box>
      </Box>

      {/* KPI Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: colorTokens.primary.lighter, color: colorTokens.primary.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VpnKeyOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{scopes.length}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Total Assigned Scopes</Typography>
          </Box>
        </Card>

        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PublicIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{globalCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Unrestricted / Corporate</Typography>
          </Box>
        </Card>

        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#F0F9FF", color: colorTokens.primary.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ApartmentIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{circleCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Circle Restricted</Typography>
          </Box>
        </Card>
      </Box>

      {/* Main Table Card */}
      <Card sx={{ borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, overflow: "hidden", bgcolor: "#FFFFFF" }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : scopes.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <VpnKeyOutlinedIcon sx={{ fontSize: 48, color: colorTokens.text.muted, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
              No Access Scopes Assigned
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 2.5 }}>
              Assign hierarchy boundaries to restrict what operational plants, projects, and circles users can query.
            </Typography>
            <Button variant="contained" startIcon={<VpnKeyOutlinedIcon />} onClick={handleOpenAssign} sx={{ bgcolor: colorTokens.primary.main }}>
              Assign First Scope
            </Button>
          </Box>
        ) : (
          <AccessScopesTable
            scopes={scopes}
            onDeleteScope={handleOpenDelete}
          />
        )}
      </Card>

      {/* Assign Scope Modal */}
      <AssignScopeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {/* Delete Scope Confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Revoke Access Scope</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to revoke the access scope for <strong>{scopeToDelete?.full_name} (@{scopeToDelete?.username})</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 1 }}>
            This will remove organization circle restrictions for this user.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteScopeMutation.isPending}
          >
            {deleteScopeMutation.isPending ? "Revoking..." : "Revoke Scope"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
