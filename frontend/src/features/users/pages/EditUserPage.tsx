import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { UpdateUserPayload, OrganizationScopeItem } from "../types/users.types";
import { useUserDetail, useUpdateUser } from "../hooks/useUsers";
import { useRolesList } from "../../roles/hooks/useRoles";
import { OrganizationScopeCard } from "../components/OrganizationScopeCard";
import { OrganizationScopeDialog } from "../components/OrganizationScopeDialog";
import { EffectiveAccessSummaryCard } from "../components/EffectiveAccessSummaryCard";

export const EditUserPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const userId = id ? Number(id) : null;
  const navigate = useNavigate();

  // Queries
  const { data: userDetail, isLoading: loadingUser, error: userError } = useUserDetail(userId || undefined);
  const { data: rolesData, isLoading: loadingRoles } = useRolesList({ status: "ACTIVE" });
  const updateUserMutation = useUpdateUser();

  // Form Fields - Basic Information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  // Form Fields - Enterprise Role
  const [roleId, setRoleId] = useState<number | "">("");

  // Organization Access Scopes (Multi-Scope System)
  const [scopes, setScopes] = useState<OrganizationScopeItem[]>([]);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<OrganizationScopeItem | null>(null);
  const [editingScopeIndex, setEditingScopeIndex] = useState<number | null>(null);

  // Validation & Error Feedback
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Pre-fill user detail
  useEffect(() => {
    if (userDetail) {
      setUsername(userDetail.username || "");
      setEmail(userDetail.email || "");
      setFirstName(userDetail.first_name || "");
      setLastName(userDetail.last_name || "");
      setDesignation(userDetail.designation || "");
      setDepartment(userDetail.department || "");
      setStatus(userDetail.status || (userDetail.is_active ? "ACTIVE" : "INACTIVE"));

      // Role
      if (userDetail.roles && userDetail.roles.length > 0) {
        const primary = userDetail.roles.find((r) => r.is_primary) || userDetail.roles[0];
        setRoleId(primary.id);
      }

      // Multi-Scopes
      if (userDetail.scopes && userDetail.scopes.length > 0) {
        setScopes(userDetail.scopes);
      }
    }
  }, [userDetail]);

  // Dialog Handlers
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
    setScopes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveScope = (savedScope: OrganizationScopeItem, editIndex: number | null) => {
    if (editIndex !== null) {
      setScopes((prev) => prev.map((s, idx) => (idx === editIndex ? savedScope : s)));
    } else {
      setScopes((prev) => [...prev, savedScope]);
    }
  };

  // Client-side Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = "Username is required.";
    }

    if (!email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!roleId) {
      errors.roleId = "Enterprise role assignment is required.";
    }

    if (scopes.length === 0) {
      errors.scopes = "Please assign at least one organization access scope.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    const selectedRole = rolesData?.find((r) => r.id === roleId);
    const firstScope = scopes[0];
    const resolvedCircleId = firstScope?.circle_id || null;
    const resolvedTeamId = firstScope?.team_id || firstScope?.sub_department_id || null;

    const payload: UpdateUserPayload = {
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      designation: designation.trim(),
      department: department.trim(),
      status,
      role: selectedRole ? selectedRole.code : undefined,
      role_id: Number(roleId),
      circle_id: resolvedCircleId,
      sub_department_id: resolvedTeamId,
      team_id: resolvedTeamId,
      scopes,
    };

    updateUserMutation.mutate(
      { userId, payload },
      {
        onSuccess: () => {
          navigate("/users", {
            state: {
              toastMessage: `User '${username}' updated successfully with ${scopes.length} access scope(s).`,
            },
          });
        },
        onError: (err: any) => {
          const errorData = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to update user.";
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

  const isSaving = updateUserMutation.isPending;
  const selectedRoleObj = rolesData?.find((r) => r.id === roleId);

  if (loadingUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (userError || !userDetail) {
    return (
      <Box sx={{ p: 4, maxWidth: 800, mx: "auto" }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load user details.
        </Alert>
        <Button variant="outlined" onClick={() => navigate("/users")}>
          Return to User Accounts
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1100, mx: "auto" }}>
      {/* 1. Dynamic Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" sx={{ color: colorTokens.text.muted }} />}
        aria-label="breadcrumb"
        sx={{ mb: 2 }}
      >
        <Link component={RouterLink} to="/" underline="hover" color="inherit" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
          Home
        </Link>
        <Typography color="text.secondary" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
          Administration
        </Typography>
        <Link component={RouterLink} to="/users" underline="hover" color="inherit" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
          User Accounts
        </Link>
        <Typography color="text.primary" sx={{ fontSize: "0.85rem", fontWeight: 700 }}>
          Edit User ({username})
        </Typography>
      </Breadcrumbs>

      {/* 2. Page Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={() => navigate("/users")}
            sx={{
              border: `1px solid ${colorTokens.workspace.border}`,
              borderRadius: radiusTokens.sm,
              bgcolor: colorTokens.workspace.surface,
              "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.02em" }}>
              Edit User Account
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Update profile details, enterprise role capabilities, and assigned organization access scopes.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={() => navigate("/users")}
            disabled={isSaving}
            sx={{ borderRadius: radiusTokens.sm, px: 2.5 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
            sx={{
              borderRadius: radiusTokens.sm,
              px: 3,
              fontWeight: 700,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
            }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </Stack>
      </Box>

      {/* Server Error Alert */}
      {serverError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: radiusTokens.sm }}>
          {serverError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* SECTION 1: Basic Information */}
        <Card
          elevation={0}
          sx={{
            p: 3.5,
            borderRadius: radiusTokens.md,
            border: `1px solid ${colorTokens.workspace.border}`,
            boxShadow: shadowTokens.card,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: radiusTokens.sm,
                bgcolor: colorTokens.primary.lighter,
                color: colorTokens.primary.main,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PersonOutlineIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                1. Basic Information
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                Identity credentials and personal account profile
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mb: 2.5 }}>
            <TextField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              size="small"
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mb: 2.5 }}>
            <TextField
              label="Username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              size="small"
              error={Boolean(formErrors.username)}
              helperText={formErrors.username}
            />
            <TextField
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
              error={Boolean(formErrors.email)}
              helperText={formErrors.email}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
            <TextField
              label="Designation / Title"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Account Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="ACTIVE">ACTIVE (Authorized to authenticate)</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE (Access blocked)</MenuItem>
              <MenuItem value="INVITED">INVITED (Pending onboarding)</MenuItem>
            </TextField>
          </Box>
        </Card>

        {/* SECTION 2: Enterprise Role */}
        <Card
          elevation={0}
          sx={{
            p: 3.5,
            borderRadius: radiusTokens.md,
            border: `1px solid ${colorTokens.workspace.border}`,
            boxShadow: shadowTokens.card,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: radiusTokens.sm,
                bgcolor: "rgba(67, 56, 202, 0.1)",
                color: "#4338ca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AdminPanelSettingsOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                2. Enterprise Role Assignment (WHAT)
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                Defines what functional capabilities and modules the user is allowed to perform
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <TextField
            select
            label="Assigned Enterprise Role"
            required
            value={roleId}
            onChange={(e) => setRoleId(e.target.value === "" ? "" : Number(e.target.value))}
            fullWidth
            size="small"
            disabled={loadingRoles}
            error={Boolean(formErrors.roleId)}
            helperText={
              formErrors.roleId ||
              (selectedRoleObj?.description
                ? `Capabilities: ${selectedRoleObj.description}`
                : "Select a database-backed enterprise role")
            }
          >
            {(rolesData || []).map((r) => (
              <MenuItem key={r.id} value={r.id}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={r.code} sx={{ height: 20, fontSize: "0.72rem", fontFamily: "monospace" }} />
                    <Chip
                      size="small"
                      label={r.risk_level}
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        bgcolor: r.risk_level === "HIGH" ? "#fee2e2" : r.risk_level === "MEDIUM" ? "#fef3c7" : "#dcfce7",
                        color: r.risk_level === "HIGH" ? "#b91c1c" : r.risk_level === "MEDIUM" ? "#b45309" : "#15803d",
                      }}
                    />
                  </Stack>
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Card>

        {/* SECTION 3: Organization Access & Scope (Multi-Scope Cards) */}
        <Card
          elevation={0}
          sx={{
            p: 3.5,
            borderRadius: radiusTokens.md,
            border: `1px solid ${formErrors.scopes ? colorTokens.status.error.main : colorTokens.workspace.border}`,
            boxShadow: shadowTokens.card,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
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
                  3. Organization Access & Scope (WHERE)
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  Assign one or multiple organizational boundaries. Hierarchy inheritance cascades downward strictly.
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
              + Add Access Scope
            </Button>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          {formErrors.scopes && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: radiusTokens.sm }}>
              {formErrors.scopes}
            </Alert>
          )}

          {scopes.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: "center",
                bgcolor: "#F8FAFC",
                borderRadius: radiusTokens.sm,
                border: `1.5px dashed ${colorTokens.workspace.border}`,
              }}
            >
              <AccountTreeOutlinedIcon sx={{ fontSize: 36, color: colorTokens.text.muted, mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 0.5 }}>
                No Organization Access Scopes Assigned
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 2 }}>
                Click "+ Add Access Scope" to assign the user to one or more organizational branches.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleOpenAddScope}
                sx={{ borderRadius: radiusTokens.sm, fontWeight: 600 }}
              >
                + Add Access Scope
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              {scopes.map((scope, idx) => (
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

        {/* SECTION 4: Effective Access Summary */}
        <EffectiveAccessSummaryCard
          roleName={selectedRoleObj?.name}
          roleCode={selectedRoleObj?.code}
          rolePermissions={[]}
          scopes={scopes}
        />

        {/* SECTION 5: Bottom Action Bar */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, pt: 1, pb: 4 }}>
          <Button
            variant="outlined"
            onClick={() => navigate("/users")}
            disabled={isSaving}
            sx={{ borderRadius: radiusTokens.sm, px: 3, py: 1 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
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
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </Box>
      </Box>

      {/* Cascading Scope Dialog */}
      <OrganizationScopeDialog
        open={scopeDialogOpen}
        onClose={() => setScopeDialogOpen(false)}
        onSave={handleSaveScope}
        initialScope={editingScope}
        editIndex={editingScopeIndex}
        existingScopes={scopes}
      />
    </Box>
  );
};
