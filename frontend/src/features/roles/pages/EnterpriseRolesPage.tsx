import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import SearchIcon from "@mui/icons-material/Search";
import AddSecurityIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { useRolesList, useDeleteRole } from "../hooks/useRoles";
import { RoleListItem } from "../types/roles.types";
import { RolesTable } from "../components/RolesTable";
import { RoleModal } from "../components/RoleModal";

export const EnterpriseRolesPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<RoleListItem | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleListItem | null>(null);

  const { data: roles = [], isLoading, refetch } = useRolesList({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
  });

  const deleteRoleMutation = useDeleteRole();

  const handleOpenCreate = () => {
    setRoleToEdit(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (role: RoleListItem) => {
    setRoleToEdit(role);
    setModalOpen(true);
  };

  const handleOpenDelete = (role: RoleListItem) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (roleToDelete) {
      deleteRoleMutation.mutate(roleToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setRoleToDelete(null);
        },
      });
    }
  };

  const systemCount = roles.filter((r) => r.role_type === "SYSTEM").length;
  const customCount = roles.filter((r) => r.role_type === "CUSTOM").length;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto" }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.02em" }}>
            Enterprise Roles
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Define roles, configure risk classifications, and bind granular capabilities across application modules.
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
            startIcon={<AddSecurityIcon />}
            onClick={handleOpenCreate}
            sx={{
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
              fontWeight: 700,
            }}
          >
            Create Role
          </Button>
        </Box>
      </Box>

      {/* KPI Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: colorTokens.primary.lighter, color: colorTokens.primary.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{roles.length}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Total Enterprise Roles</Typography>
          </Box>
        </Card>

        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{systemCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>System Defined</Typography>
          </Box>
        </Card>

        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#F0FDF4", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SecurityOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{customCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Custom Configured</Typography>
          </Box>
        </Card>
      </Box>

      {/* Main Table Card */}
      <Card sx={{ borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, overflow: "hidden", bgcolor: "#FFFFFF" }}>
        {/* Filter bar */}
        <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", borderBottom: `1px solid ${colorTokens.workspace.border}`, bgcolor: colorTokens.workspace.background }}>
          <TextField
            size="small"
            placeholder="Search by role name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 260, bgcolor: "#FFFFFF" }}
          />

          <TextField
            select
            size="small"
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 160, bgcolor: "#FFFFFF" }}
          >
            <MenuItem value="">
              <em>All Statuses</em>
            </MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
        </Box>

        {/* Content */}
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : roles.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <ShieldOutlinedIcon sx={{ fontSize: 48, color: colorTokens.text.muted, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
              No Enterprise Roles Found
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 2.5 }}>
              {search || statusFilter ? "No roles matched your search criteria." : "No custom enterprise roles have been created yet."}
            </Typography>
            <Button variant="contained" startIcon={<AddSecurityIcon />} onClick={handleOpenCreate} sx={{ bgcolor: colorTokens.primary.main }}>
              Create First Role
            </Button>
          </Box>
        ) : (
          <RolesTable
            roles={roles}
            onEditRole={handleOpenEdit}
            onDeleteRole={handleOpenDelete}
          />
        )}
      </Card>

      {/* Role Create / Edit Modal */}
      <RoleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        roleToEdit={roleToEdit}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm Role Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to permanently delete custom role <strong>{roleToDelete?.name} ({roleToDelete?.code})</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block", mt: 1 }}>
            This action will remove all permission bindings for this role.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteRoleMutation.isPending}
          >
            {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
