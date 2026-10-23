import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import RefreshIcon from "@mui/icons-material/Refresh";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import PublicIcon from "@mui/icons-material/Public";
import ApartmentIcon from "@mui/icons-material/Apartment";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { useAccessScopesList, useDeleteScope } from "../hooks/useScopes";
import { AccessScopeListItem } from "../types/scopes.types";
import { AccessScopesTable } from "../components/AccessScopesTable";
import { useUsersList, useUserDetail, useUpdateUser } from "../../users/hooks/useUsers";
import { UserListItem, OrganizationScopeItem, UpdateUserPayload } from "../../users/types/users.types";
import { OrganizationScopeCard } from "../../users/components/OrganizationScopeCard";
import { OrganizationScopeDialog } from "../../users/components/OrganizationScopeDialog";

export const AccessScopesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter for active user configuration
  const userParam = searchParams.get("user");
  const selectedUserId = userParam ? Number(userParam) : null;

  // Overview Scopes List
  const { data: scopes = [], isLoading: loadingScopes, refetch: refetchScopes } = useAccessScopesList();
  const deleteScopeMutation = useDeleteScope();

  // Users List for Selector Dropdown
  const { data: usersData, isLoading: loadingUsers } = useUsersList({ page_size: 100 });
  const users = usersData?.results || [];

  // Active User Detail (when a user is selected)
  const { data: userDetail, isLoading: loadingDetail, refetch: refetchUser } = useUserDetail(selectedUserId || undefined);
  const updateUserMutation = useUpdateUser();

  // Active User Scopes State
  const [userScopes, setUserScopes] = useState<OrganizationScopeItem[]>([]);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<OrganizationScopeItem | null>(null);
  const [editingScopeIndex, setEditingScopeIndex] = useState<number | null>(null);

  // Modal / Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scopeToDelete, setScopeToDelete] = useState<AccessScopeListItem | null>(null);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Load existing organization scopes when userDetail loads
  useEffect(() => {
    if (userDetail) {
      setUserScopes(userDetail.scopes || []);
    } else {
      setUserScopes([]);
    }
  }, [userDetail]);

  // Handle User Selection Change
  const handleSelectUser = (user: UserListItem | null) => {
    if (user) {
      setSearchParams({ user: String(user.id) });
    } else {
      setSearchParams({});
    }
  };

  // Scope Dialog Handlers
  const handleOpenAddScope = () => {
    setEditingScope(null);
    setEditingScopeIndex(null);
    setScopeDialogOpen(true);
  };

  const handleOpenEditScope = (scope: OrganizationScopeItem, index: number) => {
    setEditingScope(scope);
    setEditingScopeIndex(index);
    setScopeDialogOpen(true);
  };

  const handleRemoveScope = (index: number) => {
    setUserScopes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveScope = (
    savedScope: OrganizationScopeItem | OrganizationScopeItem[],
    editIndex: number | null
  ) => {
    if (Array.isArray(savedScope)) {
      setUserScopes((prev) => {
        const existingCircleIds = new Set(
          prev
            .filter((s) => s.circle_id && !s.domain_id && !s.department_id && !s.team_id)
            .map((s) => s.circle_id)
        );
        const toAdd = savedScope.filter((s) => !s.circle_id || !existingCircleIds.has(s.circle_id));
        return [...prev, ...toAdd];
      });
    } else if (editIndex !== null) {
      setUserScopes((prev) => prev.map((s, idx) => (idx === editIndex ? savedScope : s)));
    } else {
      setUserScopes((prev) => [...prev, savedScope]);
    }
  };

  // Save Active User Organization Scopes Configuration
  const handleSaveUserScopes = () => {
    if (!selectedUserId) return;
    setServerError(null);

    const firstScope = userScopes[0];
    const resolvedCircleId = firstScope?.circle_id || null;
    const resolvedTeamId = firstScope?.team_id || firstScope?.sub_department_id || null;

    const payload: UpdateUserPayload = {
      circle_id: resolvedCircleId,
      sub_department_id: resolvedTeamId,
      team_id: resolvedTeamId,
      scopes: userScopes,
    };

    updateUserMutation.mutate(
      { userId: selectedUserId, payload },
      {
        onSuccess: () => {
          setToastMessage(`Organization access scopes for @${userDetail?.username} saved and applied successfully.`);
          refetchScopes();
          refetchUser();
        },
        onError: (err: any) => {
          const errorData = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to save organization scope configuration.";
          if (typeof errorData === "object") {
            const firstErrKey = Object.keys(errorData)[0];
            setServerError(`${firstErrKey}: ${Array.isArray(errorData[firstErrKey]) ? errorData[firstErrKey][0] : errorData[firstErrKey]}`);
          } else {
            setServerError(String(errorData));
          }
        },
      }
    );
  };

  // Overview Table Delete Handlers
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
          refetchScopes();
        },
      });
    }
  };

  const handleConfigureFromTable = (scope: AccessScopeListItem) => {
    setSearchParams({ user: String(scope.user_id) });
  };

  const isSaving = updateUserMutation.isPending;
  const globalCount = scopes.filter((s) => s.scope_type === "GLOBAL" || s.scope_type === "CORPORATE").length;
  const circleCount = scopes.filter((s) => s.scope_type === "CIRCLE").length;
  const selectedUserItem = users.find((u) => u.id === selectedUserId) || null;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto" }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.02em" }}>
            Access Scopes
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Define exactly which organization nodes each user is authorized to access and enforce strict data boundaries.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              refetchScopes();
              if (selectedUserId) refetchUser();
            }}
            sx={{ borderRadius: radiusTokens.sm, borderColor: colorTokens.workspace.border }}
          >
            Refresh
          </Button>

          {selectedUserId && (
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<CloseIcon />}
              onClick={() => setSearchParams({})}
              sx={{ borderRadius: radiusTokens.sm }}
            >
              View All Scopes
            </Button>
          )}
        </Box>
      </Box>

      {/* User Selection Banner Card */}
      <Card
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: radiusTokens.md,
          border: `1px solid ${colorTokens.workspace.border}`,
          boxShadow: shadowTokens.subtle,
          bgcolor: "#FFFFFF",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1, minWidth: 300 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <VpnKeyOutlinedIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Select User to Configure Organization Scope
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
              Pick any registered user to inspect their assigned Enterprise Role and configure their authorized organization nodes.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ minWidth: 320, flex: 1, maxWidth: 500 }}>
          <Autocomplete
            size="small"
            options={users}
            loading={loadingUsers}
            value={selectedUserItem}
            getOptionLabel={(option) => `${option.full_name} (@${option.username}) — ${option.role_name}`}
            onChange={(_, val) => handleSelectUser(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search user by name, username, or role..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingUsers ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{option.full_name}</Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>@{option.username} • {option.email}</Typography>
                  </Box>
                  <Chip size="small" label={option.role_name} sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }} />
                </Box>
              </Box>
            )}
          />
        </Box>
      </Card>

      {/* Server Error Alert */}
      {serverError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: radiusTokens.sm }}>
          {serverError}
        </Alert>
      )}

      {/* MODE 1: Active User Scope Configuration Form */}
      {selectedUserId ? (
        loadingDetail ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
            <CircularProgress size={40} />
          </Box>
        ) : !userDetail ? (
          <Alert severity="error" sx={{ mb: 3 }}>User account not found.</Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Dynamic User Profile & Assigned Enterprise Role Card */}
            <Card
              elevation={0}
              sx={{
                p: 3,
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
                boxShadow: shadowTokens.card,
                bgcolor: "#F8FAFC",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: radiusTokens.sm,
                      bgcolor: colorTokens.primary.main,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "1.15rem",
                    }}
                  >
                    {userDetail.first_name ? userDetail.first_name[0].toUpperCase() : userDetail.username[0].toUpperCase()}
                  </Box>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary, lineHeight: 1.2 }}>
                        {userDetail.first_name} {userDetail.last_name}
                      </Typography>
                      <Chip
                        label={userDetail.status}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          bgcolor: userDetail.status === "ACTIVE" ? "#DCFCE7" : "#FEE2E2",
                          color: userDetail.status === "ACTIVE" ? "#15803D" : "#B91C1C",
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.25 }}>
                      @{userDetail.username} • {userDetail.email} {userDetail.designation ? `• ${userDetail.designation}` : ""}
                    </Typography>
                  </Box>
                </Box>

                {/* Read-Only Enterprise Role Context */}
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "#FFFFFF",
                    border: `1px solid ${colorTokens.workspace.border}`,
                    borderRadius: radiusTokens.sm,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted, display: "block" }}>
                      Assigned Enterprise Role
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.primary.main }}>
                      {userDetail.roles && userDetail.roles.length > 0 ? userDetail.roles[0].name : userDetail.role_name || "Standard User"}
                    </Typography>
                  </Box>
                  <Chip
                    label={userDetail.roles && userDetail.roles.length > 0 ? userDetail.roles[0].code : userDetail.role || "USER"}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontFamily: "monospace",
                      bgcolor: colorTokens.primary.lighter,
                      color: colorTokens.primary.darker,
                      height: 24,
                    }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <InfoOutlinedIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  The <strong>Enterprise Role</strong> defines functional capabilities. <strong>Access Scopes</strong> below govern exactly WHERE this user can view data and execute actions.
                </Typography>
              </Box>
            </Card>

            {/* Organization Access Scopes List */}
            <Card
              elevation={0}
              sx={{
                p: 3.5,
                borderRadius: radiusTokens.md,
                border: `1px solid ${colorTokens.workspace.border}`,
                boxShadow: shadowTokens.card,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: "wrap", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: radiusTokens.sm,
                      bgcolor: "rgba(14, 116, 144, 0.1)",
                      color: "#0e7490",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AccountTreeOutlinedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                      Authorized Organization Scopes ({userScopes.length})
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                      Assign one or multiple organizational boundaries. Hierarchy inheritance cascades downward strictly to descendants. Sibling branches are isolated.
                    </Typography>
                  </Box>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleOpenAddScope}
                  sx={{
                    borderRadius: radiusTokens.sm,
                    bgcolor: colorTokens.primary.main,
                    fontWeight: 700,
                    textTransform: "none",
                    "&:hover": { bgcolor: colorTokens.primary.dark },
                  }}
                >
                  + Add Organization Scope
                </Button>
              </Box>

              <Divider sx={{ mb: 2.5 }} />

              {userScopes.length === 0 ? (
                <Box
                  sx={{
                    p: 4,
                    textAlign: "center",
                    bgcolor: "#F8FAFC",
                    borderRadius: radiusTokens.sm,
                    border: `1.5px dashed ${colorTokens.workspace.border}`,
                  }}
                >
                  <AccountTreeOutlinedIcon sx={{ fontSize: 40, color: colorTokens.text.muted, mb: 1.5 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary, mb: 0.5 }}>
                    No Organization Scope Assigned
                  </Typography>
                  <Typography variant="body2" sx={{ color: colorTokens.text.secondary, maxWidth: 480, mx: "auto", mb: 2.5, fontSize: "0.85rem" }}>
                    Selecting a user does not grant access automatically. Without an assigned organization scope, this user cannot access any organizational records or dashboards.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleOpenAddScope}
                    sx={{
                      borderRadius: radiusTokens.sm,
                      fontWeight: 700,
                      bgcolor: colorTokens.primary.main,
                      "&:hover": { bgcolor: colorTokens.primary.dark },
                    }}
                  >
                    Assign Organization Scope
                  </Button>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {userScopes.map((scope, idx) => (
                    <OrganizationScopeCard
                      key={idx}
                      scope={scope}
                      index={idx}
                      onEdit={handleOpenEditScope}
                      onRemove={handleRemoveScope}
                    />
                  ))}
                </Stack>
              )}
            </Card>

            {/* Bottom Save Action Bar */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, pt: 1, pb: 4 }}>
              <Button
                variant="outlined"
                onClick={() => setSearchParams({})}
                disabled={isSaving}
                sx={{ borderRadius: radiusTokens.sm, px: 3, py: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveUserScopes}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
                sx={{
                  borderRadius: radiusTokens.sm,
                  px: 4,
                  py: 1,
                  fontWeight: 700,
                  bgcolor: colorTokens.primary.main,
                  "&:hover": { bgcolor: colorTokens.primary.dark },
                }}
              >
                {isSaving ? "Saving Configuration..." : "Save Scope Configuration"}
              </Button>
            </Box>

            {/* Dynamic Organization Scope Selection Dialog */}
            <OrganizationScopeDialog
              open={scopeDialogOpen}
              onClose={() => setScopeDialogOpen(false)}
              onSave={handleSaveScope}
              initialScope={editingScope}
              editIndex={editingScopeIndex}
              existingScopes={userScopes}
            />
          </Box>
        )
      ) : (
        /* MODE 2: Overview Table of All Assigned Scopes */
        <>
          {/* KPI Stats */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
            <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: colorTokens.primary.lighter, color: colorTokens.primary.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <VpnKeyOutlinedIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700 }}>
                  Total Scopes Configured
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                  {scopes.length}
                </Typography>
              </Box>
            </Card>

            <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PublicIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700 }}>
                  Corporate / Unrestricted
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#047857" }}>
                  {globalCount}
                </Typography>
              </Box>
            </Card>

            <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "rgba(14, 116, 144, 0.1)", color: "#0e7490", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ApartmentIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary, fontWeight: 700 }}>
                  Circle Restrained Scopes
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0e7490" }}>
                  {circleCount}
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Overview Table */}
          <AccessScopesTable
            scopes={scopes}
            loading={loadingScopes}
            onDelete={handleOpenDelete}
            onConfigureUser={handleConfigureFromTable}
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: radiusTokens.md } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm Deletion of Access Scope</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Are you sure you want to delete the scope for <strong>{scopeToDelete?.username}</strong> ({scopeToDelete?.hierarchy_breadcrumb || scopeToDelete?.scope_type})?
            This will immediately remove their access boundary for this organization branch.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleteScopeMutation.isPending}>
            {deleteScopeMutation.isPending ? "Deleting..." : "Delete Scope"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Toast */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="success" onClose={() => setToastMessage(null)} sx={{ borderRadius: radiusTokens.sm, fontWeight: 600 }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
