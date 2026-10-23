import React, { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
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
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { CreateUserPayload } from "../types/users.types";
import { useCreateUser } from "../hooks/useUsers";
import { useRolesList } from "../../roles/hooks/useRoles";

export const CreateUserPage: React.FC = () => {
  const navigate = useNavigate();

  // Form Fields - Basic Information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  // Form Fields - Enterprise Role
  const [roleId, setRoleId] = useState<number | "">("");

  // Validation & Error Feedback
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Queries & Mutations
  const { data: rolesData, isLoading: loadingRoles } = useRolesList({ status: "ACTIVE" });
  const createUserMutation = useCreateUser();

  // Client-side Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = "Username is required.";
    } else if (username.length < 3) {
      errors.username = "Username must be at least 3 characters.";
    }

    if (!email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!roleId) {
      errors.roleId = "Enterprise role assignment is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    const selectedRole = rolesData?.find((r) => r.id === roleId);

    const payload: CreateUserPayload = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      designation: designation.trim(),
      department: department.trim(),
      status,
      role: selectedRole ? selectedRole.code : "VIEWER",
      role_id: Number(roleId),
      circle_id: null,
      sub_department_id: null,
      team_id: null,
      scopes: [],
    };

    createUserMutation.mutate(payload, {
      onSuccess: (createdUser) => {
        navigate("/users", {
          state: {
            toastMessage: `User account '${username}' created successfully with role '${selectedRole?.name}'. Configure permissions and hierarchy boundaries in the Access Scopes tab.`,
            createdUserId: createdUser?.id,
          },
        });
      },
      onError: (err: any) => {
        const errorData = err?.response?.data?.errors || err?.response?.data?.detail || "Failed to create user account.";
        if (typeof errorData === "object") {
          const firstErrKey = Object.keys(errorData)[0];
          setServerError(`${firstErrKey}: ${Array.isArray(errorData[firstErrKey]) ? errorData[firstErrKey][0] : errorData[firstErrKey]}`);
        } else {
          setServerError(String(errorData));
        }
      },
    });
  };

  const isSubmitting = createUserMutation.isPending;
  const selectedRoleObj = rolesData?.find((r) => r.id === roleId);

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 960, mx: "auto" }}>
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
          Create User Account
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
              Create User Account
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
              Provision enterprise identity profile and assign an existing Enterprise Role.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={() => navigate("/users")}
            disabled={isSubmitting}
            sx={{ borderRadius: radiusTokens.sm, px: 2.5 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <PersonAddOutlinedIcon />}
            sx={{
              borderRadius: radiusTokens.sm,
              px: 3,
              fontWeight: 700,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
            }}
          >
            {isSubmitting ? "Creating..." : "Create Account"}
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
              <PersonAddOutlinedIcon fontSize="small" />
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
              placeholder="e.g. Ramesh"
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. Sharma"
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
              placeholder="e.g. rsharma"
              error={Boolean(formErrors.username)}
              helperText={formErrors.username || "Used for system login"}
            />
            <TextField
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. ramesh.sharma@mapar.com"
              error={Boolean(formErrors.email)}
              helperText={formErrors.email || "Official communication email"}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mb: 2.5 }}>
            <TextField
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              size="small"
              error={Boolean(formErrors.password)}
              helperText={formErrors.password || "Minimum 8 characters"}
            />
            <TextField
              label="Confirm Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              size="small"
              error={Boolean(formErrors.confirmPassword)}
              helperText={formErrors.confirmPassword}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2.5 }}>
            <TextField
              label="Designation / Title"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. Circle Business Head"
            />
            <TextField
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. Operations"
            />
            <TextField
              select
              label="Account Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="ACTIVE">ACTIVE (Authorized)</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE (Blocked)</MenuItem>
              <MenuItem value="INVITED">INVITED (Pending)</MenuItem>
            </TextField>
          </Box>
        </Card>

        {/* SECTION 2: Enterprise Role Assignment */}
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
                2. Enterprise Role Assignment
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                Select from existing database-backed enterprise roles. Role definitions are managed in the Enterprise Roles tab.
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
                ? `Role Capabilities: ${selectedRoleObj.description}`
                : "Select an existing enterprise role definition")
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

        {/* SECTION 3: Access Scopes Link Callout */}
        <Card
          elevation={0}
          sx={{
            p: 3,
            borderRadius: radiusTokens.md,
            border: `1.5px dashed ${colorTokens.primary.main}`,
            bgcolor: "rgba(21, 101, 192, 0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
                Looking to configure Module Permissions & Organization Scope?
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                Specific module Read/Write access and geographic circle boundaries are configured in the dedicated <strong>Access Scopes</strong> tab. You will be able to assign scopes immediately after creating this account.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/permissions")}
            sx={{
              borderRadius: radiusTokens.sm,
              fontWeight: 700,
              textTransform: "none",
              borderColor: colorTokens.primary.main,
              color: colorTokens.primary.main,
            }}
          >
            Go to Access Scopes →
          </Button>
        </Card>

        {/* Bottom Action Bar */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, pt: 1, pb: 4 }}>
          <Button
            variant="outlined"
            onClick={() => navigate("/users")}
            disabled={isSubmitting}
            sx={{ borderRadius: radiusTokens.sm, px: 3, py: 1 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <PersonAddOutlinedIcon />}
            sx={{
              borderRadius: radiusTokens.sm,
              px: 4,
              py: 1,
              fontWeight: 700,
              bgcolor: colorTokens.primary.main,
              "&:hover": { bgcolor: colorTokens.primary.dark },
            }}
          >
            {isSubmitting ? "Creating User..." : "Create User Account"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
