import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { useUsersList, useToggleUserStatus } from "../hooks/useUsers";
import { useRolesList } from "../../roles/hooks/useRoles";
import { UserListItem } from "../types/users.types";
import { UsersTable } from "../components/UsersTable";
import { UserDrawer } from "../components/UserDrawer";
import { UserEffectiveAccessDialog } from "../components/UserEffectiveAccessDialog";

export const UserAccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Success toast from CreateUserPage
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.toastMessage) {
      setToastMessage(location.state.toastMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Drawer / Dialog states (Drawer only used for editing existing users)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserListItem | null>(null);

  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [inspectedUser, setInspectedUser] = useState<UserListItem | null>(null);

  const { data: usersData, isLoading, refetch } = useUsersList({
    search: search.trim() || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    page,
    page_size: 15,
  });

  const { data: rolesData } = useRolesList({ status: "ACTIVE" });
  const toggleStatusMutation = useToggleUserStatus();

  const handleOpenCreate = () => {
    navigate("/users/create");
  };


  const handleOpenEdit = (user: UserListItem) => {
    navigate(`/users/${user.id}/edit`);
  };

  const handleOpenAccess = (user: UserListItem) => {
    navigate(`/permissions?user=${user.id}`);
  };

  const handleToggleStatus = (user: UserListItem) => {
    toggleStatusMutation.mutate(user.id);
  };

  const users = usersData?.results || [];
  const totalCount = usersData?.count || 0;
  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto" }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.02em" }}>
            User Accounts
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Manage identity profiles, assign enterprise roles, and configure organization hierarchy scopes.
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
            startIcon={<PersonAddOutlinedIcon />}
            onClick={handleOpenCreate}
            sx={{
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
              fontWeight: 700,
            }}
          >
            Create User
          </Button>
        </Box>
      </Box>

      {/* KPI Stat Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: colorTokens.primary.lighter, color: colorTokens.primary.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GroupOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{totalCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Total User Accounts</Typography>
          </Box>
        </Card>

        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#DCFCE7", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircleOutlineIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{activeCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Active in View</Typography>
          </Box>
        </Card>

        <Card sx={{ p: 2, borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radiusTokens.sm, bgcolor: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BlockOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{inactiveCount}</Typography>
            <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontWeight: 600 }}>Inactive in View</Typography>
          </Box>
        </Card>
      </Box>

      {/* Main Content Card */}
      <Card sx={{ borderRadius: radiusTokens.md, border: `1px solid ${colorTokens.workspace.border}`, boxShadow: shadowTokens.subtle, overflow: "hidden", bgcolor: "#FFFFFF" }}>
        {/* Search & Filter Toolbar */}
        <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", borderBottom: `1px solid ${colorTokens.workspace.border}`, bgcolor: colorTokens.workspace.background }}>
          <TextField
            size="small"
            placeholder="Search by name, username, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
            label="Filter by Role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 200, bgcolor: "#FFFFFF" }}
          >
            <MenuItem value="">
              <em>All Roles</em>
            </MenuItem>
            {rolesData?.map((r) => (
              <MenuItem key={r.id} value={r.code}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 150, bgcolor: "#FFFFFF" }}
          >
            <MenuItem value="">
              <em>All Statuses</em>
            </MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
            <MenuItem value="INVITED">Invited</MenuItem>
            <MenuItem value="SUSPENDED">Suspended</MenuItem>
          </TextField>
        </Box>

        {/* Table / Loading / Empty */}
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : users.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <GroupOutlinedIcon sx={{ fontSize: 48, color: colorTokens.text.muted, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
              No User Accounts Found
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 2.5 }}>
              {search || roleFilter || statusFilter
                ? "No users matched your search criteria. Try clearing the filters."
                : "No enterprise user accounts have been provisioned yet."}
            </Typography>
            <Button variant="contained" startIcon={<PersonAddOutlinedIcon />} onClick={handleOpenCreate} sx={{ bgcolor: colorTokens.primary.main }}>
              Create First User
            </Button>
          </Box>
        ) : (
          <>
            <UsersTable
              users={users}
              onEditUser={handleOpenEdit}
              onViewAccess={handleOpenAccess}
              onToggleStatus={handleToggleStatus}
              isToggling={toggleStatusMutation.isPending}
            />

            {/* Pagination */}
            {usersData && usersData.total_pages > 1 && (
              <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${colorTokens.workspace.border}` }}>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  Showing {(page - 1) * usersData.page_size + 1} - {Math.min(page * usersData.page_size, totalCount)} of {totalCount} users
                </Typography>
                <Pagination
                  count={usersData.total_pages}
                  page={page}
                  onChange={(_, val) => setPage(val)}
                  color="primary"
                  size="small"
                />
              </Box>
            )}
          </>
        )}
      </Card>

      {/* User Create / Edit Drawer */}
      <UserDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userToEdit={userToEdit}
      />

      {/* Effective Access Dialog */}
      <UserEffectiveAccessDialog
        open={accessDialogOpen}
        onClose={() => setAccessDialogOpen(false)}
        userId={inspectedUser?.id}
        username={inspectedUser?.username}
      />

      {/* Success Notification */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="success" onClose={() => setToastMessage(null)} sx={{ borderRadius: "10px", fontWeight: 600 }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

